import {randomUUID} from 'node:crypto';
import {newProject, validProject, projectBytes, validStored, emptyConfiguration, type Project, type Broker, type ProjectSystem, type StoredConfiguration} from './project.js';
import {ProjectFile} from './project-files.js';
import {Credentials, type CredentialCommand} from './credentials.js';
import type {Diagnostics} from './diagnostics.js';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {canonical, mergeConfigurations, type DraftConflict} from './draft-merge.js';

interface DraftSync {
  operation: string; phase: string; remoteRevision: number | null; baseRevision: number;
  conflicts: DraftConflict[]; error: string; counts: {added: number; changed: number; removed: number};
  before?: ProjectSystem; after?: string;
  source?: string;
  input?: string;
}

export type ProjectCommand =
  | {action: 'status' | 'new' | 'open' | 'save' | 'saveAs' | 'export' | 'restore' | 'editing' | 'edited'}
  | {action: 'rename'; name: string}
  | {action: 'broker'; broker: Broker}
  | {action: 'system'; system: {id: string; name: string; brokerId: string; baseTopic: string}}
  | {action: 'draft'; systemId: string; operation: 'new' | 'rename' | 'copy' | 'delete'; ruleId: string; name: string};
export interface ProjectDialogs {
  chooseOpen(): Promise<string | null>;
  chooseSave(): Promise<string | null>;
  confirmDiscard(): Promise<boolean>;
  confirmRestore(): Promise<boolean>;
  confirmDelete(): Promise<boolean>;
  chooseCredentials(source?: CredentialCommand['source']): Promise<{username: string; password: string} | null>;
}
export class ProjectService {
  private project: Project = newProject('');
  private dirty = false;
  private pending = false;
  private editorPending = false;
  private epoch = 0;
  private file = new ProjectFile();
  private queue: Promise<unknown> = Promise.resolve();
  private sync = new Map<string, DraftSync>();
  private offline = new Set<string>();
  private resolutions = new Map<string, {checksum: string | null; input: string; choices: Record<string, string>}>();
  constructor(private readonly vault: Credentials, private readonly dialogs: ProjectDialogs, private readonly debug: Diagnostics, private readonly recoveryDirectory?: string) {
    this.project.name = 'Z2M-Automations';
  }
  active = false;
  selected = '';
  serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {}); return result;
  }
  data(): Project { return structuredClone(this.project); }
  generation(): number { return this.epoch; }
  replaceDraft(systemId: string, configuration: ProjectSystem['configuration']): void {
    if (!this.active) throw new Error('noProject');
    const next = this.data(); const system = next.systems.find(system => system.id === systemId);
    if (!system) throw new Error('stale');
    system.configuration = structuredClone(configuration);
    projectBytes(next); this.project = next; this.dirty = true;
    this.debug.record('projectChanged', systemId, undefined, {operation: 'draft'});
  }
  async backup(path: string): Promise<void> { await this.file.export(this.project, path); }
  async exportBytes(path: string, bytes: Buffer): Promise<void> { await this.file.exportBytes(path, bytes); }
  observe(projectId: string, epoch: number, systemId: string, stored: StoredConfiguration, initializeBase = true): void {
    if (!this.active || this.project.id !== projectId || this.epoch !== epoch || !validStored(stored)) throw new Error('stale');
    const next = this.data(); const system = next.systems.find(system => system.id === systemId);
    if (!system) throw new Error('stale');
    if (JSON.stringify(system.stored) === JSON.stringify(stored)) return;
    if (initializeBase && !system.stored && !system.baseline) {
      system.baseline = stored.revision > 0 && stored.checksum ? {revision: stored.revision, checksum: stored.checksum,
        ...(canonical({...system.configuration, revision: 0}) === canonical({...stored.configuration, revision: 0}) ? {configuration: structuredClone(stored.configuration)} : {})} : null;
    }
    system.stored = structuredClone(stored);
    projectBytes(next); this.project = next; this.dirty = true;
  }
  acceptStoredBase(systemId: string): void {
    const next = this.data(); const system = next.systems.find(item => item.id === systemId);
    if (!system?.stored) throw new Error('noStored');
    const {revision, checksum} = system.stored;
    system.baseline = revision && checksum ? {revision, checksum, configuration: structuredClone(system.stored.configuration)} : null;
    projectBytes(next); this.project = next; this.dirty = true;
  }
  draftSync(systemId: string): DraftSync {
    const system = this.project.systems.find(item => item.id === systemId);
    return structuredClone(this.sync.get(systemId) ?? {operation: '', phase: this.offline.has(systemId) ? 'offline' : system?.stored ? 'current' : 'idle',
      remoteRevision: system?.stored?.revision ?? null, baseRevision: system?.baseline?.revision ?? 0, conflicts: [], error: '', counts: {added: 0, changed: 0, removed: 0}});
  }
  isDraftReady(systemId: string): boolean { return this.offline.has(systemId) || Boolean(this.project.systems.find(item => item.id === systemId)?.stored); }
  assertDraftSynchronized(systemId: string): void {
    const system = this.project.systems.find(item => item.id === systemId);
    const phase = this.draftSync(systemId).phase;
    if (!system?.stored || system.stored.revision > 0 && !system.baseline?.configuration
      || ['idle', 'reading', 'conflict', 'error', 'older', 'offline'].includes(phase)) throw new Error('draftSyncRequired');
  }
  beginDraftRead(systemId: string): void {
    const current = this.draftSync(systemId);
    this.sync.set(systemId, {...current, operation: randomUUID().replaceAll('-', ''), phase: 'reading'});
  }
  failDraftRead(systemId: string): void { const current = this.draftSync(systemId); this.sync.set(systemId, {...current, phase: 'error', error: 'draft_sync_failed'}); this.resolutions.delete(systemId); }
  async reconcileStored(projectId: string, epoch: number, systemId: string, stored: StoredConfiguration, choices: Record<string, string> = {}, current = () => true): Promise<void> {
    const system = this.data().systems.find(item => item.id === systemId);
    if (!system || this.project.id !== projectId || this.epoch !== epoch || !validStored(stored) || !current()) throw new Error('stale');
    const previous = this.sync.get(systemId);
    const resolution = this.resolutions.get(systemId);
    this.resolutions.delete(systemId);
    if (resolution?.checksum === stored.checksum && resolution.input === canonical(system.configuration)) choices = resolution.choices;
    // Transfer readbacks and open forms retain their independent local input.
    if (this.hasPendingInput()) { this.observe(projectId, epoch, systemId, stored, false); return; }
    const base = system.baseline?.configuration;
    const result = mergeConfigurations(system.configuration, stored.configuration, base ?? null, choices);
    const counts = {added: 0, changed: 0, removed: 0};
    for (const kind of ['automations', 'sequences'] as const) {
      const before = new Map(system.configuration[kind].map(item => [item['id'], item]));
      const after = new Map(result.configuration[kind].map(item => [item['id'], item]));
      for (const [id, value] of after) { if (!before.has(id)) counts.added++; else if (canonical(value) !== canonical(before.get(id))) counts.changed++; }
      for (const id of before.keys()) if (!after.has(id)) counts.removed++;
    }
    const job: DraftSync = {operation: randomUUID().replaceAll('-', ''), phase: 'current', remoteRevision: stored.revision,
      baseRevision: system.baseline?.revision ?? 0, conflicts: result.conflicts, counts, error: '', input: canonical(system.configuration)};
    if (stored.revision < (system.baseline?.revision ?? 0)) job.phase = 'older';
    else if (result.conflicts.length) job.phase = 'conflict';
    else {
      // Working copies may contain unfinished rules; full runtime checks belong to transfer.
      const candidate = {...result.configuration, revision: Math.max(1, system.configuration.revision, stored.revision)};
      const changed = canonical({...candidate, revision: 0}) !== canonical({...system.configuration, revision: 0});
      if (changed) {
        await this.backupDraft(systemId);
        if (!current() || this.project.id !== projectId || this.epoch !== epoch || canonical(this.project.systems.find(item => item.id === systemId)?.configuration) !== canonical(system.configuration)) throw new Error('stale');
        job.before = system; job.after = canonical(candidate); job.phase = 'updated';
      } else if (previous?.after === canonical(candidate) && previous.remoteRevision === stored.revision) return this.observe(projectId, epoch, systemId, stored, false);
      this.replaceDraft(systemId, candidate);
    }
    this.observe(projectId, epoch, systemId, stored, false);
    if (!['older', 'conflict'].includes(job.phase)) this.acceptStoredBase(systemId);
    this.sync.set(systemId, job); this.offline.delete(systemId);
    this.debug.record('projectChanged', systemId, undefined, {operation: 'draft'});
  }
  async backupDraft(systemId: string): Promise<void> {
    if (!this.project.systems.some(item => item.id === systemId)) throw new Error('stale');
    if (this.recoveryDirectory) {
      await mkdir(this.recoveryDirectory, {recursive: true, mode: 0o700});
      await this.file.export(this.project, join(this.recoveryDirectory, this.project.id + '.' + systemId + '.z2map'));
    }
  }
  rememberFileImport(before: ProjectSystem): void {
    const system = this.project.systems.find(item => item.id === before.id);
    if (!system) throw new Error('stale');
    this.sync.set(system.id, {operation: randomUUID().replaceAll('-', ''), phase: 'updated', source: 'file', before,
      after: canonical(system.configuration), remoteRevision: system.stored?.revision ?? null, baseRevision: system.baseline?.revision ?? 0,
      conflicts: [], error: '', counts: {added: system.configuration.automations.filter(item => !before.configuration.automations.some(old => old['id'] === item['id'])).length, changed: 0, removed: 0}});
  }
  async resolveDraftSync(systemId: string, operation: string, action: string, choices: Record<string, string> = {}): Promise<void> {
    const system = this.data().systems.find(item => item.id === systemId);
    if (!system || this.hasPendingInput()) throw new Error('applyFirst');
    if (action === 'offline') { this.offline.add(systemId); return; }
    const job = this.sync.get(systemId);
    if (!job || operation !== job.operation) throw new Error('draftStale');
    if (action === 'merge' && job.input !== canonical(system.configuration)) throw new Error('draftStale');
    if (action === 'restore' && job.before && job.after === canonical(system.configuration)) {
      await this.backupDraft(systemId);
      const next = this.data(); const target = next.systems.find(item => item.id === systemId)!;
      target.configuration = job.before.configuration; target.baseline = job.before.baseline;
      projectBytes(next); this.project = next; this.dirty = true;
      this.sync.set(systemId, {...job, phase: 'restored', conflicts: []}); return;
    }
    if (action !== 'merge' || job.phase !== 'conflict' || !system.stored) throw new Error('draftStale');
    if (Object.keys(choices).length !== job.conflicts.length || job.conflicts.some(item => !['local', 'remote'].includes(choices[item.key] ?? ''))) throw new Error('invalidRequest');
    this.resolutions.set(systemId, {checksum: system.stored.checksum, input: canonical(system.configuration), choices});
  }
  hasPendingInput(): boolean { return this.pending || this.editorPending; }
  isDirty(): boolean { return this.dirty || this.pending || this.editorPending; }
  editorState(pending: boolean): void { this.editorPending = pending; }
  async state(canceled = false): Promise<unknown> {
    const credentials: Record<string, string> = {};
    for (const broker of this.project.brokers) credentials[broker.id] = await this.vault.status(this.project.id, broker);
    return {active: this.active, epoch: this.epoch, project: this.data(), dirty: this.isDirty(), hasPath: this.file.hasPath(), protectedAvailable: await this.vault.protectedAvailable(), credentials, ...(canceled ? {canceled: true} : {})};
  }
  private replace(project: Project): void {
    this.sync.clear(); this.offline.clear(); this.resolutions.clear();
    this.vault.clearSession(); this.epoch++; this.project = project; this.active = true; this.dirty = false; this.pending = false; this.editorPending = false; this.selected = project.systems[0]?.id ?? '';
  }
  select(id: string): void {
    if (!this.project.systems.some(system => system.id === id)) throw new Error('invalidRequest');
    this.selected = id;
  }
  async command(command: ProjectCommand): Promise<unknown> {
    const request = this.debug.record('projectRequest', undefined, undefined, {operation: command.action});
    switch (command.action) {
      case 'status': return this.state();
      case 'editing': this.pending = true; return this.state();
      case 'edited': this.pending = false; return this.state();
      case 'new':
        if (this.isDirty() && !await this.dialogs.confirmDiscard()) return this.state(true);
        this.file.clear(); this.replace(newProject('Z2M-Automations')); this.dirty = true; break;
      case 'open': {
        if (this.isDirty() && !await this.dialogs.confirmDiscard()) return this.state(true);
        const path = await this.dialogs.chooseOpen(); if (!path) return this.state(true);
        const nextFile = new ProjectFile(); const next = await nextFile.load(path);
        this.replace(next); this.file = nextFile; break;
      }
      case 'save': case 'saveAs': case 'export': {
        if (!this.active) throw new Error('noProject');
        if (this.pending || this.editorPending) throw new Error('applyFirst');
        const destination = command.action === 'save' && this.file.hasPath() ? undefined : await this.dialogs.chooseSave();
        if (destination === null) return this.state(true);
        if (command.action === 'export') { await this.file.export(this.project, destination!); }
        else { await this.file.save(this.project, destination); this.dirty = false; }
        break;
      }
      case 'restore':
        if (!await this.dialogs.confirmRestore()) return this.state(true);
        this.replace(await this.file.restore()); this.dirty = true; break;
      default: {
        if (!this.active) throw new Error('noProject');
        const next = this.data();
        if (command.action === 'rename') next.name = command.name;
        if (command.action === 'broker') {
          const index = next.brokers.findIndex(broker => broker.id === command.broker.id);
          const old = next.brokers[index];
          if (old && (old.host !== command.broker.host || old.port !== command.broker.port || old.tls !== command.broker.tls)) {
            for (const system of next.systems) if (system.brokerId === old.id) { system.baseline = null; delete system.stored; }
          }
          if (index < 0) next.brokers.push(structuredClone(command.broker)); else next.brokers[index] = structuredClone(command.broker);
        }
        if (command.action === 'system') {
          const index = next.systems.findIndex(system => system.id === command.system.id);
          const old = next.systems[index];
          const system: ProjectSystem = {...command.system, baseline: old?.baseline ?? null, configuration: old?.configuration ?? emptyConfiguration(), ...(old?.stored ? {stored: old.stored} : {})};
          // A changed binding has no known remote baseline. Keep the local draft.
          if (old && (old.brokerId !== system.brokerId || old.baseTopic !== system.baseTopic)) { system.baseline = null; delete system.stored; }
          if (index < 0) next.systems.push(system); else next.systems[index] = system;
        }
        if (command.action === 'draft') {
          if (!this.isDraftReady(command.systemId)) throw new Error('draftInitialRead');
          if (command.operation === 'delete' && !await this.dialogs.confirmDelete()) return this.state();
          const system = next.systems.find(system => system.id === command.systemId); if (!system) throw new Error('invalidRequest');
          const rules = system.configuration.automations;
          const rule = rules.find(rule => rule['id'] === command.ruleId);
          if (command.operation === 'new') rules.push({id: 'rule-' + randomUUID(), name: command.name, enabled: false, triggers: [], conditions: [], actions: []});
          else {
            if (!rule) throw new Error('invalidRequest');
            if (command.operation === 'rename') rule['name'] = command.name;
            if (command.operation === 'copy') rules.push({...structuredClone(rule), id: 'rule-' + randomUUID(), name: command.name, enabled: false});
            if (command.operation === 'delete') system.configuration.automations = rules.filter(item => item !== rule);
          }
          system.configuration.revision++;
        }
        if (!validProject(next)) throw new Error('invalidProject');
        for (const system of next.systems) {
          const old = this.project.systems.find(item => item.id === system.id);
          const beforeBroker = this.project.brokers.find(item => item.id === old?.brokerId);
          const afterBroker = next.brokers.find(item => item.id === system.brokerId);
          if (old && (old.brokerId !== system.brokerId || old.baseTopic !== system.baseTopic
            || canonical(beforeBroker) !== canonical(afterBroker))) {
            this.sync.delete(system.id); this.offline.delete(system.id); this.resolutions.delete(system.id);
          }
        }
        this.project = next; this.dirty = true;
        if (!this.selected) this.selected = next.systems[0]?.id ?? '';
        break;
      }
    }
    this.debug.record('projectChanged', undefined, undefined, {operation: command.action, ...(request ? {request} : {})});
    return this.state();
  }
  async credential(input: CredentialCommand): Promise<unknown> {
    if (!this.active) throw new Error('noProject');
    const broker = this.project.brokers.find(broker => broker.id === input.brokerId); if (!broker) throw new Error('invalidRequest');
    this.debug.record('credentialRequest', undefined, undefined, {operation: input.mode === 'remove' ? 'removeCredentials' : 'storeCredentials'});
    if (input.mode === 'remove') await this.vault.remove(this.project.id, broker);
    else {
      const secret = await this.dialogs.chooseCredentials(input.source);
      if (!secret) return this.state(true);
      await this.vault.store(this.project.id, broker, {...secret, brokerId: broker.id, mode: input.mode});
    }
    return this.state();
  }
}
