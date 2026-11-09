import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {exportDraft} from './draft-exchange.js';
import {checkCapabilities, checkedDocument} from './draft-validation.js';
import {record, type RemoteRead, type RemoteStatus} from './mqtt-protocol.js';
import type {MqttReader} from './mqtt-reader.js';
import type {ProjectService} from './project-service.js';
import {projectBytes, type Configuration, type Project, type ProjectSystem} from './project.js';

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
type Action = 'validate' | 'store' | 'install' | 'checkTransfer';
type Review = {system: string; topic: string; broker: string; revision: number; next: number; rules: number; changes: string; build: string};
interface Dialogs {
  confirm(action: 'store' | 'install', review: Review): Promise<boolean>;
  backup(conflict: boolean, review?: Review): Promise<string | null>;
}
interface Receipt {base: RemoteStatus; yaml: string; checksum: string; configuration: Configuration; draft: string; assertCurrent(): void}
const same = (a: RemoteStatus, b: RemoteStatus) => a.session === b.session && a.build === b.build
  && a.revision === b.revision && a.checksum === b.checksum && a.executing === b.executing && a.resumeEnabled === b.resumeEnabled;
const checksumOf = (config: Configuration) => sha(JSON.stringify(config));

export class ExtensionTransfer {
  private receipts = new Map<string, Receipt>();
  private uncertain = new Map<string, {action: 'store' | 'install'; session?: string; checksum?: string | null; revision?: number}>();
  private epoch = -1;
  constructor(private readonly projects: ProjectService, private readonly reader: MqttReader, private readonly dialogs: Dialogs) {}
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
    if (pending.action === 'store' && current.checksum === pending.checksum && !current.executing && !current.resumeEnabled) {
      const remote = await this.read(wire);
      if (!same(current, remote.status)) throw new Error('transferUncertain');
      this.observe(id, remote);
      this.projects.acceptStoredBase(id);
      this.uncertain.delete(key);
      return 'transferStored';
    } else if (pending.action === 'install' && current.build === manifest.build && current.session !== pending.session && current.revision === pending.revision && current.checksum === pending.checksum && !current.executing) {
      const remote = await this.read(wire);
      if (!same(current, remote.status)) throw new Error('transferUncertain');
      this.observe(id, remote);
      this.uncertain.delete(key);
      return 'transferInstalled';
    } else if (pending.action === 'install' || current.session === pending.session) throw new Error('transferUncertain');
    this.uncertain.delete(key);
    return undefined;
  }
  async command(action: Action, id: string): Promise<string> {
    const epoch = this.projects.generation();
    if (this.epoch !== epoch) { this.receipts.clear(); this.epoch = epoch; }
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
    if (action === 'checkTransfer') {
      this.observe(id, await this.read(wire));
      return 'transferChecked';
    }
    if (action === 'install') return this.install(uncertaintyKey, system, wire);
    const remote = await this.read(wire);
    const base = remote.status;
    if ((system.baseline?.revision ?? 0) !== base.revision || (system.baseline?.checksum ?? null) !== base.checksum) {
      this.receipts.delete(id);
      this.observe(id, remote);
      const path = await this.dialogs.backup(true, this.review(system, base, system.configuration, remote.configuration));
      if (path) await this.projects.backup(path);
      throw new Error('transferConflict');
    }
    if (action === 'validate') {
      this.receipts.delete(id);
      const configuration = checkedDocument(structuredClone(system.configuration));
      configuration.revision = base.revision + 1;
      for (const rule of configuration.automations) rule['enabled'] = false;
      await this.checkCatalog(project, system, configuration, remote);
      const yaml = exportDraft(configuration).toString('utf8'); const checksum = sha(yaml);
      if (Buffer.byteLength(yaml) > 131072) throw new Error('draftLimit');
      const result = await wire.validate(yaml);
      if (!record(result) || result['valid'] !== true || result['revision'] !== configuration.revision || result['checksum'] !== checksum
        || result['automation_count'] !== configuration.automations.length || result['executing'] !== false || !same(base, await wire.status())) throw new Error('transferChanged');
      this.receipts.set(id, {base, yaml, checksum, configuration, draft: checksumOf(system.configuration), assertCurrent: wire.assertCurrent});
      return 'transferValidated';
    }
    const receipt = this.receipts.get(id);
    this.receipts.delete(id);
    if (!receipt || !same(receipt.base, base) || receipt.draft !== checksumOf(system.configuration)) throw new Error('transferValidateFirst');
    receipt.assertCurrent();
    if (base.executing || base.resumeEnabled) throw new Error('transferRunning');
    if (!await this.dialogs.confirm('store', this.review(system, base, receipt.configuration, remote.configuration))) return 'transferCanceled';
    if (base.revision) {
      this.observe(id, remote);
      const path = await this.dialogs.backup(false);
      if (!path) return 'transferCanceled';
      await this.projects.backup(path);
    }
    const finalRemote = await this.read(wire);
    if (!same(base, finalRemote.status)) throw new Error('transferChanged');
    await this.checkCatalog(project, system, receipt.configuration, finalRemote);
    const nextProject = this.projects.data();
    nextProject.systems.find(item => item.id === id)!.stored = {
      revision: receipt.configuration.revision, checksum: receipt.checksum, configuration: receipt.configuration, yaml: receipt.yaml
    };
    projectBytes(nextProject);
    if (!same(base, await wire.status())) throw new Error('transferChanged');
    if (this.uncertain.size >= 32) throw new Error('transferUncertain');
    this.uncertain.set(uncertaintyKey, {action: 'store', session: base.session, checksum: receipt.checksum});
    try {
      const result = await wire.store(receipt.yaml, base);
      if (!record(result) || result['stored_revision'] !== receipt.configuration.revision || result['checksum'] !== receipt.checksum
        || result['automation_count'] !== receipt.configuration.automations.length || result['executing'] !== false || result['storage'] !== 'ok') throw new Error();
      const stored = await this.read(wire);
      if (stored.status.session !== base.session || stored.status.build !== base.build || stored.status.checksum !== receipt.checksum
        || stored.status.revision !== receipt.configuration.revision || stored.status.executing || stored.status.resumeEnabled) throw new Error();
      this.observe(id, stored); this.projects.acceptStoredBase(id);
      this.uncertain.delete(uncertaintyKey);
      return 'transferStored';
    } catch { throw new Error('transferUncertain'); }
  }
  private async checkCatalog(project: Project, system: ProjectSystem, configuration: Configuration, remote: RemoteRead): Promise<void> {
    const targetTopics = new Set<string>();
    for (const entry of [...configuration.automations, ...configuration.sequences]) {
      for (const action of entry['actions'] as {target?: {system?: string}}[]) {
        if (action.target?.system) targetTopics.add(action.target.system);
      }
    }
    const catalogs = new Map([[system.id, {...remote, fresh: true}]]);
    const checkedProject = structuredClone(project);
    await Promise.all([...targetTopics].map(async topic => {
      const owners = checkedProject.systems.filter(item => item.baseTopic === topic && item.id !== system.id);
      if (owners.length !== 1 || !owners[0]) throw new Error('draftPermission');
      const owner = owners[0];
      const observed = await this.read(this.reader.transfer(owner.id));
      owner.configuration.mesh_peers = observed.configuration.mesh_peers;
      catalogs.set(owner.id, {...observed, fresh: true});
    }));
    const catalog = {current: (id: string) => catalogs.get(id) ?? null};
    for (const entry of configuration.automations) checkCapabilities(entry, false, configuration, checkedProject, system, catalog);
    for (const entry of configuration.sequences) checkCapabilities(entry, true, configuration, checkedProject, system, catalog);
  }
  private review(system: ProjectSystem, base: RemoteStatus | null, next?: Configuration, previous?: Configuration): Review {
    const changes: string[] = [];
    for (const field of ['automations', 'sequences'] as const) {
      const before = new Map(previous?.[field].map(entry => [entry['id'], JSON.stringify(entry)]));
      const after = new Map(next?.[field].map(entry => [entry['id'], JSON.stringify(entry)]));
      for (const id of new Set([...before.keys(), ...after.keys()])) if (before.get(id) !== after.get(id)) changes.push(String(id));
    }
    if (next && previous && JSON.stringify(next.mesh_peers) !== JSON.stringify(previous.mesh_peers)) changes.push('mesh_peers');
    const broker = this.projects.data().brokers.find(item => item.id === system.brokerId);
    return {system: system.name, topic: system.baseTopic, broker: broker ? broker.name + ' (' + broker.host + ':' + broker.port + ')' : '—',
      revision: base?.revision ?? 0, next: next?.revision ?? 0,
      rules: next?.automations.length ?? 0, changes: changes.slice(0, 16).join(', ') + (changes.length > 16 ? ' …' : ''),
      build: (base?.build?.slice(0, 12) ?? '—') + ' → ' + manifest.build.slice(0, 12)};
  }
  private async install(key: string, system: ProjectSystem, wire: Wire): Promise<string> {
    const probe = async () => {
      if (wire.bridge().online !== true) throw new Error('transferBridge');
      try { return await wire.status(); }
      catch (error) {
        if (error instanceof Error && error.message === 'timeout' && wire.bridge().installed === false && !system.stored?.revision) return null;
        throw error;
      }
    };
    const base = await probe();
    if (base?.build === manifest.build) return 'transferInstalled';
    if (base?.executing || base?.resumeEnabled) throw new Error('transferRunning');
    if (!await this.dialogs.confirm('install', this.review(system, base))) return 'transferCanceled';
    if (base?.revision) {
      const remote = await this.read(wire);
      if (!same(base, remote.status)) throw new Error('transferChanged');
      this.observe(system.id, remote);
      const path = await this.dialogs.backup(false);
      if (!path) return 'transferCanceled';
      await this.projects.backup(path);
    }
    const current = await probe();
    if (base ? !current || !same(base, current) : current !== null) throw new Error('transferChanged');
    this.receipts.delete(system.id);
    if (this.uncertain.size >= 32) throw new Error('transferUncertain');
    this.uncertain.set(key, {action: 'install', revision: base?.revision ?? 0, checksum: base?.checksum ?? null, ...(base ? {session: base.session} : {})});
    try {
      await wire.install(artifact);
      const remote = await this.read(wire);
      if (remote.status.build !== manifest.build || remote.status.session === base?.session || remote.status.executing
        || remote.status.revision !== (base?.revision ?? 0) || remote.status.checksum !== (base?.checksum ?? null)) throw new Error();
      this.observe(system.id, remote);
      this.uncertain.delete(key);
      return 'transferInstalled';
    } catch { throw new Error('transferUncertain'); }
  }
}
