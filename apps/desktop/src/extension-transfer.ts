import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {join} from 'node:path';
import {exportDraft} from './draft-exchange.js';
import {checkConfigurationCapabilities, checkedDocument} from './draft-validation.js';
import {record, type RemoteRead, type RemoteStatus} from './mqtt-protocol.js';
import type {MqttReader} from './mqtt-reader.js';
import type {ProjectService} from './project-service.js';
import {projectBytes, type Configuration, type Project, type ProjectSystem} from './project.js';
import {runtimeStopped, sameStoredStatus} from './runtime-state.js';
import {ExtensionUpdate} from './extension-update.js';

const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const artifactRoot = join(__dirname, 'extension');
const manifest = JSON.parse(readFileSync(join(artifactRoot, 'provenance.json'), 'utf8')) as {version: string; build: string; sha256: string; schemaSha256: string};
const artifact = readFileSync(join(artifactRoot, 'z2m-automations.mjs'), 'utf8');
if (!/^[a-f0-9]{64}$/.test(manifest.build) || !/^\d+\.\d+\.\d+$/.test(manifest.version)
  || sha(artifact) !== manifest.sha256 || !artifact.includes("export const EXTENSION_BUILD = '" + manifest.build + "';")
  || !artifact.includes("export const EXTENSION_VERSION = '" + manifest.version + "';")
  || sha(readFileSync(join(__dirname, 'schema/automations.schema.json'))) !== manifest.schemaSha256) throw new Error('extensionIntegrity');

export const bundledExtension = {version: manifest.version, build: manifest.build};
type Wire = ReturnType<MqttReader['transfer']>;
type Action = 'validateEnabled' | 'validate' | 'store' | 'install' | 'checkTransfer';
type CheckKind = 'configuration' | 'flags' | 'unchanged';
type Review = {system: string; topic: string; broker: string; revision: number; next: number; rules: number; enabled: number; changes: string; build: string;
  kind: CheckKind; running: boolean; added: number; changed: number; removed: number};
interface Dialogs {
  confirm(action: 'store' | 'install', review: Review): Promise<boolean>;
  backup(conflict: boolean, review?: Review): Promise<string | null>;
}
interface Receipt {base: RemoteStatus; yaml: string; checksum: string; configuration: Configuration; draft: string; kind: CheckKind; review: Review; assertCurrent(): void}
type TransferPhase = 'backingUp' | 'stopping' | 'checking' | 'sending' | 'verifying' | 'complete';
interface PendingTransfer {id: string; phase: 'stopping' | 'sending'; base: RemoteStatus; checksum?: string; revision?: number}
const running = (status: RemoteStatus) => !runtimeStopped(status);
const same = (a: RemoteStatus, b: RemoteStatus) => a.session === b.session && a.build === b.build
  && a.revision === b.revision && a.checksum === b.checksum && a.executing === b.executing && a.resumeEnabled === b.resumeEnabled && Boolean(running(a)) === Boolean(running(b));
const checksumOf = (config: Configuration) => sha(JSON.stringify(config));
const comparable = (configuration: Configuration, flags = false) => ({...configuration, revision: 0,
  automations: configuration.automations.map(rule => flags ? {...rule, enabled: false} : rule)});

export class ExtensionTransfer {
  private receipts = new Map<string, Receipt>();
  private uncertain = new Map<string, PendingTransfer>();
  private progress = new Map<string, {id: string; phase: TransferPhase; failed: boolean; kind: CheckKind}>();
  private sequence = 0;
  private epoch = -1;
  private readonly updates: ExtensionUpdate;
  constructor(private readonly projects: ProjectService, private readonly reader: MqttReader, private readonly dialogs: Dialogs,
    options?: {timeout: number; poll: number}) {
    this.updates = new ExtensionUpdate(projects, reader, {code: artifact, build: manifest.build}, {
      confirm: (system, base) => dialogs.confirm('install', this.review(system, base)),
      backup: async (system, remote) => {
        this.observe(system.id, remote);
        const path = await dialogs.backup(false);
        if (!path) return false;
        await projects.backup(path); return true;
      },
      read: wire => this.read(wire), observe: (id, remote) => this.observe(id, remote)
    }, options);
  }
  updateState() { return {updates: this.updates.state(), sequence: this.updates.sequence}; }
  updatePending(id: string) { return this.updates.pending(id); }
  transferPending(id: string) { return [...this.uncertain.values()].some(item => item.id === id); }
  private flagsKey(project: Project, system: ProjectSystem, remote: RemoteRead): string {
    const broker = project.brokers.find(item => item.id === system.brokerId);
    return sha(JSON.stringify([project.id, this.projects.generation(), system.id, system.baseTopic, broker,
      system.configuration, remote.status.session, remote.status.revision, remote.status.checksum, remote.status.build]));
  }
  flagsContext(id: string): string {
    if (!this.projects.active) return '';
    const project = this.projects.data(); const system = project.systems.find(item => item.id === id);
    const remote = this.reader.current(id);
    return system && remote?.fresh && remote.status.execution ? this.flagsKey(project, system, remote) : '';
  }
  async applyFlags(id: string, context: string, enabled: string[]): Promise<string> {
    if (!Array.isArray(enabled) || enabled.length > 100 || new Set(enabled).size !== enabled.length
      || enabled.some(rule => typeof rule !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(rule))) throw new Error('invalidRequest');
    this.reset();
    if (this.projects.hasPendingInput()) throw new Error('applyFirst');
    if (this.transferPending(id)) throw new Error('transferUncertain');
    if (this.updates.pending(id)) throw new Error('extensionUpdatePending');
    if (!context || context !== this.flagsContext(id)) throw new Error('runtimeFlagsChanged');
    return this.reader.runtime(id, async wire => {
      const project = this.projects.data(); const system = project.systems.find(item => item.id === id);
      if (!system || context !== this.flagsContext(id)) throw new Error('runtimeFlagsChanged');
      const remote = await this.read(wire);
      if (context !== this.flagsKey(project, system, remote)) throw new Error('runtimeFlagsChanged');
      const configuration = checkedDocument(structuredClone(remote.configuration));
      if (enabled.some(id => !configuration.automations.some(rule => rule['id'] === id))) throw new Error('runtimeFlagsChanged');
      for (const rule of configuration.automations) rule['enabled'] = enabled.includes(String(rule['id']));
      if (isDeepStrictEqual(comparable(configuration), comparable(remote.configuration))) return 'transferUnchanged';
      configuration.revision = remote.status.revision + 1;
      checkedDocument(configuration);
      const synchronize = isDeepStrictEqual(comparable(system.configuration), comparable(remote.configuration));
      const nextDraft = structuredClone(system.configuration);
      if (synchronize) {
        nextDraft.revision++;
        for (const rule of nextDraft.automations) rule['enabled'] = enabled.includes(String(rule['id']));
      }
      await this.checkCatalog(project, system, configuration, remote);
      const yaml = exportDraft(configuration).toString('utf8');
      if (Buffer.byteLength(yaml) > 131072) throw new Error('draftLimit');
      const receipt: Receipt = {base: remote.status, yaml, checksum: sha(yaml), configuration, draft: checksumOf(system.configuration),
        kind: 'flags', review: this.review(system, remote.status, configuration, remote.configuration, 'flags'), assertCurrent: wire.assertCurrent};
      if (synchronize) {
        const preview = structuredClone(project); const owner = preview.systems.find(item => item.id === id)!;
        owner.configuration = nextDraft;
        owner.stored = {revision: configuration.revision, checksum: receipt.checksum, configuration, yaml};
        projectBytes(preview);
      }
      this.receipts.delete(id); this.sequence++;
      await this.validate(wire, receipt);
      const broker = project.brokers.find(item => item.id === system.brokerId);
      const key = sha(JSON.stringify([project.id, id, system.baseTopic, broker?.host, broker?.port, broker?.tls]));
      const outcome = await this.store(key, project, system, remote, receipt, wire);
      if (outcome === 'transferStored' && synchronize) this.projects.replaceDraft(id, nextDraft);
      return outcome;
    });
  }
  private reset(): void {
    const epoch = this.projects.generation();
    if (this.epoch !== epoch) { this.receipts.clear(); this.progress.clear(); this.epoch = epoch; this.sequence++; }
  }
  reviewState() {
    this.reset();
    return {sequence: this.sequence, checks: [...this.receipts].map(([id, receipt]) => ({id, kind: receipt.kind,
      rules: receipt.review.rules, enabled: receipt.review.enabled, added: receipt.review.added, changed: receipt.review.changed, removed: receipt.review.removed})),
      progress: [...this.progress.values()].map(item => ({...item}))};
  }
  private stage(id: string, phase: TransferPhase, kind: CheckKind, failed = false): void {
    this.progress.set(id, {id, phase, kind, failed}); this.sequence++;
    this.reader.noteTransfer(id, phase, failed);
  }
  private observe(id: string, remote: RemoteRead): void {
    this.projects.observe(this.projects.data().id, this.projects.generation(), id, {
      revision: remote.status.revision, checksum: remote.status.checksum, configuration: remote.configuration, yaml: remote.yaml
    }, false);
  }
  private async read(wire: Wire): Promise<RemoteRead> {
    const before = await wire.status();
    const remote = await wire.editor();
    if (!same(before, remote.status) || !same(before, await wire.status())) throw new Error('transferChanged');
    return remote;
  }
  private async resolveUncertainty(key: string, wire: Wire, id: string): Promise<string | undefined> {
    const pending = this.uncertain.get(key);
    if (!pending) return;
    const current = await wire.status().catch(() => { throw new Error('transferUncertain'); });
    if (pending.phase === 'stopping') {
      if (!sameStoredStatus(current, pending.base) || !runtimeStopped(current)) throw new Error('transferStopUncertain');
      const stopped = await this.read(wire);
      if (!same(current, stopped.status)) throw new Error('transferStopUncertain');
      this.observe(id, stopped); this.uncertain.delete(key);
      return 'transferStopped';
    }
    if (current.checksum === pending.checksum && current.revision === pending.revision && current.build === pending.base.build && !running(current)) {
      const remote = await this.read(wire);
      if (!same(current, remote.status)) throw new Error('transferUncertain');
      this.observe(id, remote);
      this.projects.acceptStoredBase(id);
      this.uncertain.delete(key);
      this.stage(id, 'complete', this.progress.get(id)?.kind ?? 'configuration');
      return 'transferStored';
    } else if (current.session === pending.base.session) throw new Error('transferUncertain');
    this.uncertain.delete(key);
    return undefined;
  }
  async command(action: Action, id: string): Promise<string> {
    if (!this.projects.active) throw new Error('noProject');
    if (!this.projects.data().systems.some(system => system.id === id)) throw new Error('noSystems');
    return action === 'store' ? this.reader.runtime(id, () => this.perform(action, id)) : this.perform(action, id);
  }
  private async perform(action: Action, id: string): Promise<string> {
    this.reset();
    if (!this.projects.active) throw new Error('noProject');
    if (action !== 'checkTransfer' && this.projects.hasPendingInput()) throw new Error('applyFirst');
    const project = this.projects.data();
    const system = project.systems.find(item => item.id === id);
    if (!system) throw new Error('noSystems');
    const wire = this.reader.transfer(id);
    const broker = project.brokers.find(item => item.id === system.brokerId);
    const uncertaintyKey = sha(JSON.stringify([project.id, id, system.baseTopic, broker?.host, broker?.port, broker?.tls]));
    const resolved = await this.resolveUncertainty(uncertaintyKey, wire, id);
    if (resolved) return resolved;
    if (action === 'install' || action === 'checkTransfer' && this.updates.has(uncertaintyKey)) {
      this.receipts.delete(id);
      return this.updates.command(uncertaintyKey, system, action === 'checkTransfer');
    }
    if (action === 'checkTransfer') {
      this.observe(id, await this.read(wire));
      return 'transferChecked';
    }
    if (this.updates.pending(id)) throw new Error('extensionUpdatePending');
    const remote = await this.read(wire);
    const base = remote.status;
    if ((system.baseline?.revision ?? 0) !== base.revision || (system.baseline?.checksum ?? null) !== base.checksum) {
      this.receipts.delete(id);
      this.observe(id, remote);
      const path = await this.dialogs.backup(true, this.review(system, base, system.configuration, remote.configuration));
      if (path) await this.projects.backup(path);
      throw new Error('transferConflict');
    }
    if (action === 'validate' || action === 'validateEnabled') {
      this.receipts.delete(id);
      const configuration = checkedDocument(structuredClone(system.configuration));
      configuration.revision = base.revision + 1;
      const flagsOnly = base.revision > 0 && isDeepStrictEqual(comparable(configuration, true), comparable(remote.configuration, true));
      if (action === 'validateEnabled' && !flagsOnly) throw new Error('runtimeFlagsOnly');
      const kind: CheckKind = action === 'validateEnabled' ? 'flags'
        : isDeepStrictEqual(comparable(configuration), comparable(remote.configuration)) ? 'unchanged'
          : flagsOnly ? 'flags' : 'configuration';
      if (kind === 'configuration') {
        for (const rule of configuration.automations) rule['enabled'] = false;
      }
      await this.checkCatalog(project, system, configuration, remote);
      const yaml = exportDraft(configuration).toString('utf8'); const checksum = sha(yaml);
      if (Buffer.byteLength(yaml) > 131072) throw new Error('draftLimit');
      if (kind !== 'unchanged') await this.validate(wire, {base, yaml, checksum, configuration});
      const review = this.review(system, base, configuration, remote.configuration, kind);
      this.receipts.set(id, {base, yaml, checksum, configuration, draft: checksumOf(system.configuration), kind, review, assertCurrent: wire.assertCurrent});
      this.sequence++;
      return kind === 'unchanged' ? 'transferUnchanged' : 'transferValidated';
    }
    const receipt = this.receipts.get(id);
    this.receipts.delete(id); this.sequence++;
    if (!receipt || !same(receipt.base, base) || receipt.draft !== checksumOf(system.configuration)) throw new Error('transferValidateFirst');
    if (receipt.kind === 'unchanged') throw new Error('transferUnchanged');
    receipt.assertCurrent();
    return this.store(uncertaintyKey, project, system, remote, receipt, wire);
  }
  private async validate(wire: Wire, candidate: Pick<Receipt, 'base' | 'yaml' | 'checksum' | 'configuration'>): Promise<void> {
    const {base, yaml, checksum, configuration} = candidate;
    const result = await wire.validate(yaml);
    if (!record(result) || result['valid'] !== true || result['revision'] !== configuration.revision || result['checksum'] !== checksum
      || result['automation_count'] !== configuration.automations.length || result['executing'] !== false || !same(base, await wire.status())) throw new Error('transferChanged');
  }
  private async store(key: string, project: Project, system: ProjectSystem, original: RemoteRead, receipt: Receipt, wire: Wire): Promise<string> {
    const id = system.id, base = original.status, epoch = this.projects.generation();
    const endpoint = (data: Project) => {
      const owner = data.systems.find(item => item.id === id), broker = data.brokers.find(item => item.id === owner?.brokerId);
      return JSON.stringify([data.id, owner?.baseTopic, broker?.id, broker?.host, broker?.port, broker?.tls]);
    };
    const assertReview = () => {
      receipt.assertCurrent();
      const current = this.projects.data();
      const draft = current.systems.find(item => item.id === id)?.configuration;
      if (this.projects.generation() !== epoch || endpoint(current) !== endpoint(project) || !draft || checksumOf(draft) !== receipt.draft) throw new Error('transferChanged');
    };
    if (this.uncertain.size >= 32) throw new Error('transferUncertain');
    if (!await this.dialogs.confirm('store', receipt.review)) return 'transferCanceled';
    let phase: TransferPhase = 'backingUp';
    try {
      assertReview(); this.stage(id, phase, receipt.kind);
      if (base.revision) {
        this.observe(id, original);
        const path = await this.dialogs.backup(false);
        if (!path) { this.progress.delete(id); this.sequence++; return 'transferCanceled'; }
        await this.projects.backup(path);
      }
      assertReview();
      const approved = await this.read(wire);
      if (!same(base, approved.status)) throw new Error('transferChanged');
      await this.checkCatalog(project, system, receipt.configuration, approved);
      if (running(base)) {
        phase = 'stopping'; this.stage(id, phase, receipt.kind);
        this.uncertain.set(key, {id, phase: 'stopping', base});
        await wire.runtime('deactivate', {session: base.session}).catch(() => {});
        const stopped = await wire.status().catch(() => { throw new Error('transferStopUncertain'); });
        if (!sameStoredStatus(base, stopped) || !runtimeStopped(stopped)) throw new Error('transferStopUncertain');
        this.uncertain.delete(key);
      }
      phase = 'checking'; this.stage(id, phase, receipt.kind); assertReview();
      const finalRemote = await this.read(wire);
      if (!sameStoredStatus(base, finalRemote.status) || !runtimeStopped(finalRemote.status)) throw new Error('transferChanged');
      await this.checkCatalog(project, system, receipt.configuration, finalRemote);
      await this.validate(wire, {...receipt, base: finalRemote.status});
      assertReview();
      const nextProject = this.projects.data();
      nextProject.systems.find(item => item.id === id)!.stored = {
        revision: receipt.configuration.revision, checksum: receipt.checksum, configuration: receipt.configuration, yaml: receipt.yaml
      };
      projectBytes(nextProject);
      if (!same(finalRemote.status, await wire.status())) throw new Error('transferChanged');
      phase = 'sending'; this.stage(id, phase, receipt.kind);
      this.uncertain.set(key, {id, phase: 'sending', base, checksum: receipt.checksum, revision: receipt.configuration.revision});
      await wire.store(receipt.yaml, base).catch(() => {});
      phase = 'verifying'; this.stage(id, phase, receipt.kind);
      const stored = await this.read(wire);
      if (stored.status.session !== base.session || stored.status.build !== base.build || stored.status.checksum !== receipt.checksum
        || stored.status.revision !== receipt.configuration.revision || stored.yaml !== receipt.yaml || running(stored.status)) throw new Error('transferUncertain');
      assertReview();
      this.observe(id, stored); this.projects.acceptStoredBase(id);
      this.uncertain.delete(key); this.stage(id, 'complete', receipt.kind);
      return 'transferStored';
    } catch (error) {
      this.stage(id, phase, receipt.kind, true);
      if (this.uncertain.get(key)?.phase === 'sending') throw new Error('transferUncertain');
      throw error;
    }
  }
  private async checkCatalog(project: Project, system: ProjectSystem, configuration: Configuration, remote: RemoteRead): Promise<void> {
    const targetTopics = new Set<string>();
    const conditionTopics = new Set<string>();
    for (const entry of [...configuration.automations, ...configuration.sequences]) {
      for (const condition of (entry['conditions'] ?? []) as {system?: string}[]) {
        if (condition.system) { targetTopics.add(condition.system); conditionTopics.add(condition.system); }
      }
      for (const action of entry['actions'] as {target?: {system?: string}}[]) {
        if (action.target?.system) targetTopics.add(action.target.system);
      }
    }
    const catalogs = new Map([[system.id, {...remote, fresh: true}]]);
    const supportsConditions = (read: RemoteRead): boolean => {
      const version = /^(\d+)\.(\d+)\.(\d+)$/.exec(read.status.extensionVersion);
      return Boolean(version && (Number(version[1]) > 0 || Number(version[2]) > 2 || Number(version[2]) === 2 && Number(version[3]) >= 1));
    };
    if (conditionTopics.size && !supportsConditions(remote)) throw new Error('draftRemoteConditionVersion');
    const checkedProject = structuredClone(project);
    const checkingSystem = {...system, configuration};
    checkedProject.systems.find(item => item.id === system.id)!.configuration = configuration;
    await Promise.all([...targetTopics].map(async topic => {
      const owners = checkedProject.systems.filter(item => item.baseTopic === topic && item.id !== system.id);
      if (owners.length !== 1 || !owners[0]) throw new Error('draftPermission');
      const owner = owners[0];
      const observed = await this.read(this.reader.transfer(owner.id));
      if (conditionTopics.has(topic) && !supportsConditions(observed)) throw new Error('draftRemoteConditionVersion');
      owner.configuration.mesh_peers = observed.configuration.mesh_peers;
      catalogs.set(owner.id, {...observed, fresh: true});
    }));
    const catalog = {current: (id: string) => catalogs.get(id) ?? null};
    checkConfigurationCapabilities(configuration, checkedProject, checkingSystem, catalog);
  }
  private review(system: ProjectSystem, base: RemoteStatus | null, next?: Configuration, previous?: Configuration, kind: CheckKind = 'configuration'): Review {
    const changes: string[] = [];
    let added = 0, changed = 0, removed = 0;
    for (const field of ['automations', 'sequences'] as const) {
      const before = new Map(previous?.[field].map(entry => [entry['id'], JSON.stringify(entry)]));
      const after = new Map(next?.[field].map(entry => [entry['id'], JSON.stringify(entry)]));
      for (const id of new Set([...before.keys(), ...after.keys()])) if (before.get(id) !== after.get(id)) {
        changes.push(String(id));
        if (!before.has(id)) added++; else if (!after.has(id)) removed++; else changed++;
      }
    }
    if (next && previous && JSON.stringify(next.mesh_peers) !== JSON.stringify(previous.mesh_peers)) changes.push('mesh_peers');
    const broker = this.projects.data().brokers.find(item => item.id === system.brokerId);
    return {system: system.name, topic: system.baseTopic, broker: broker ? broker.name + ' (' + broker.host + ':' + broker.port + ')' : '—',
      revision: base?.revision ?? 0, next: next?.revision ?? 0,
      rules: next?.automations.length ?? 0, enabled: next?.automations.filter(rule => rule['enabled'] === true).length ?? 0, changes: changes.slice(0, 16).join(', ') + (changes.length > 16 ? ' …' : ''),
      build: (base?.build?.slice(0, 12) ?? '—') + ' → ' + manifest.build.slice(0, 12), kind, running: Boolean(base && running(base)), added, changed, removed};
  }
}
