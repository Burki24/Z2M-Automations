import {randomUUID} from 'node:crypto';
import {newProject, validProject, projectBytes, validStored, emptyConfiguration, type Project, type Broker, type ProjectSystem, type StoredConfiguration} from './project.js';
import {ProjectFile} from './project-files.js';
import {Credentials, type CredentialCommand} from './credentials.js';
import type {Diagnostics} from './diagnostics.js';

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
  chooseCredentials(): Promise<{username: string; password: string} | null>;
}
export class ProjectService {
  private project: Project = newProject('');
  private dirty = false;
  private pending = false;
  private editorPending = false;
  private epoch = 0;
  private file = new ProjectFile();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly vault: Credentials, private readonly dialogs: ProjectDialogs, private readonly debug: Diagnostics) {
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
  observe(projectId: string, epoch: number, systemId: string, stored: StoredConfiguration): void {
    if (!this.active || this.project.id !== projectId || this.epoch !== epoch || !validStored(stored)) throw new Error('stale');
    const next = this.data(); const system = next.systems.find(system => system.id === systemId);
    if (!system) throw new Error('stale');
    if (JSON.stringify(system.stored) === JSON.stringify(stored)) return;
    system.stored = structuredClone(stored);
    system.baseline = stored.revision > 0 && stored.checksum ? {revision: stored.revision, checksum: stored.checksum} : null;
    projectBytes(next); this.project = next; this.dirty = true;
  }
  isDirty(): boolean { return this.dirty || this.pending || this.editorPending; }
  editorState(pending: boolean): void { this.editorPending = pending; }
  async state(): Promise<unknown> {
    const credentials: Record<string, string> = {};
    for (const broker of this.project.brokers) credentials[broker.id] = await this.vault.status(this.project.id, broker);
    return {active: this.active, epoch: this.epoch, project: this.data(), dirty: this.isDirty(), hasPath: this.file.hasPath(), protectedAvailable: await this.vault.protectedAvailable(), credentials};
  }
  private replace(project: Project): void {
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
        if (this.isDirty() && !await this.dialogs.confirmDiscard()) return this.state();
        this.file.clear(); this.replace(newProject('Z2M-Automations')); this.dirty = true; break;
      case 'open': {
        if (this.isDirty() && !await this.dialogs.confirmDiscard()) return this.state();
        const path = await this.dialogs.chooseOpen(); if (!path) return this.state();
        const nextFile = new ProjectFile(); const next = await nextFile.load(path);
        this.replace(next); this.file = nextFile; break;
      }
      case 'save': case 'saveAs': case 'export': {
        if (!this.active) throw new Error('noProject');
        if (this.pending || this.editorPending) throw new Error('applyFirst');
        const destination = command.action === 'save' && this.file.hasPath() ? undefined : await this.dialogs.chooseSave();
        if (destination === null) return this.state();
        if (command.action === 'export') { await this.file.export(this.project, destination!); }
        else { await this.file.save(this.project, destination); this.dirty = false; }
        break;
      }
      case 'restore':
        if (!await this.dialogs.confirmRestore()) return this.state();
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
      const secret = await this.dialogs.chooseCredentials();
      if (!secret) return this.state();
      await this.vault.store(this.project.id, broker, {...secret, brokerId: broker.id, mode: input.mode});
    }
    return this.state();
  }
}
