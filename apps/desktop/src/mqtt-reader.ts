import {connect, type IClientOptions, type MqttClient} from 'mqtt';
import {randomUUID} from 'node:crypto';
import {createSecureContext} from 'node:tls';
import type {Broker, Project, ProjectSystem, StoredConfiguration} from './project.js';
import {exact, validId} from './project.js';
import type {Credentials} from './credentials.js';
import type {Diagnostics} from './diagnostics.js';
import {extensionPrefix, readOperations, statusData, editorData, executionData, record, type Execution, type RemoteRead, type RemoteStatus} from './mqtt-protocol.js';
import {DraftValidationError, readDraftDetails} from './draft-feedback.js';
import type {AutoConnectMode} from './auto-connect.js';

export const runtimeActions = ['activate', 'deactivate', 'run_once', 'stop_rule'] as const;
export type RuntimeAction = typeof runtimeActions[number];
const wireOperations = [...readOperations, 'validate', 'store', 'install', 'restart', ...runtimeActions] as const;
type WireOperation = typeof wireOperations[number];
const wireTopic = (base: string, operation: WireOperation, direction: 'request' | 'response'): string =>
  operation === 'install' ? base + '/bridge/' + direction + '/extension/save'
    : operation === 'restart' ? base + '/bridge/' + direction + '/restart' : base + extensionPrefix + direction + '/' + operation;
const systemTopics = (base: string): string[] => [base + '/bridge/state', base + '/bridge/extensions', base + extensionPrefix + 'status', base + extensionPrefix + 'runs',
  ...wireOperations.map(operation => wireTopic(base, operation, 'response'))];

export interface NetworkCommand {action: 'status' | 'connect' | 'disconnect' | 'autoConnect' | 'refresh' | 'linkPlan' | 'linkCheck' | 'certificates' | 'clearCertificates' | 'view' | 'validate' | 'store' | 'install' | 'checkTransfer' | 'validateEnabled' | 'runtimeStatus' | 'setRuleFlags' | RuntimeAction; id: string; peerId?: string; source?: 'draft' | 'stored'; rule?: string; run?: string; resume?: boolean; mode?: AutoConnectMode; context?: string; enabled?: string[]}
export interface TLSMaterial {ca?: string; cert?: string; key?: string; passphrase?: string}
interface Pending {topic: string; generation: number; operation: 'read' | 'validate' | 'store' | 'install' | 'restart' | RuntimeAction; resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout>}
interface Connection {
  client: MqttClient; signature: string; generation: number; state: string; error: string; ready: boolean;
  pending: Map<string, Pending>; systems: ProjectSystem[]; reads: Map<string, Promise<void>>; closed: boolean;
  bridges: Map<string, {online?: boolean; installed?: boolean}>;
  cycles: Map<string, {offline: boolean; sequence: number}>;
  subscription: ReturnType<typeof setTimeout> | null;
}
export function parseTLS(bytes: Buffer): TLSMaterial {
  try {
    if (bytes.length > 196608) throw new Error();
    const value: unknown = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
    if (!record(value) || !Object.keys(value).length || !Object.keys(value).every(key => ['ca', 'cert', 'key', 'passphrase'].includes(key))
      || !Object.values(value).every(part => typeof part === 'string' && part.length > 0 && part.length <= 65536)
      || Boolean(value['cert']) !== Boolean(value['key']) || value['passphrase'] && !value['key'] || !value['ca'] && !value['cert']) throw new Error();
    createSecureContext(value as TLSMaterial); return value as TLSMaterial;
  } catch { throw new Error('invalidTLS'); }
}
export function mqttOptions(broker: Broker, secret: {username: string; password: string} | null, material: TLSMaterial): IClientOptions & {minVersion: 'TLSv1.2'} {
  return {protocol: broker.tls ? 'mqtts' : 'mqtt', host: broker.host, port: broker.port,
    clientId: 'z2ma-desktop-' + randomUUID(), protocolVersion: 4, clean: true, manualConnect: true,
    connectTimeout: 8000, reconnectPeriod: 1500, resubscribe: false, queueQoSZero: false,
    keepalive: 30, rejectUnauthorized: true, minVersion: 'TLSv1.2', ...material,
    ...(secret ? {username: secret.username, password: secret.password} : {}), log: () => {}};
}
export class MqttReader {
  private project: Project | null = null;
  private epoch = -1;
  private connections = new Map<string, Connection>();
  private remote = new Map<string, RemoteRead & {fresh: boolean}>();
  private errors = new Map<string, string>();
  private views = new Map<string, 'draft' | 'stored'>();
  private tls = new Map<string, {signature: string; material: TLSMaterial}>();
  private sequence = 0;
  constructor(private readonly credentials: Pick<Credentials, 'read'>, private readonly debug: Diagnostics,
    private readonly observed: (project: string, epoch: number, system: string, stored: StoredConfiguration, current: () => boolean) => Promise<void>,
    private readonly factory: (options: IClientOptions) => MqttClient = options => connect(options), private readonly timeout = 10000) {}
  private signature(broker: Broker, systems: ProjectSystem[]): string { return JSON.stringify([this.tlsSignature(broker), systems.map(system => [system.id, system.baseTopic])]); }
  private tlsSignature(broker: Broker): string { return JSON.stringify([broker.id, broker.host, broker.port, broker.tls]); }
  reconcile(project: Project | null, epoch: number): void {
    const previous = this.project;
    if (!project || project.id !== this.project?.id || epoch !== this.epoch) {
      this.close(); this.remote.clear(); this.views.clear(); this.errors.clear(); this.tls.clear();
    }
    this.project = project ? structuredClone(project) : null; this.epoch = epoch;
    for (const id of this.remote.keys()) {
      const before = previous?.systems.find(system => system.id === id); const after = project?.systems.find(system => system.id === id);
      const oldBroker = previous?.brokers.find(broker => broker.id === before?.brokerId); const newBroker = project?.brokers.find(broker => broker.id === after?.brokerId);
      if (!before || !after || !oldBroker || !newBroker || before.baseTopic !== after.baseTopic || this.tlsSignature(oldBroker) !== this.tlsSignature(newBroker)) {
        this.remote.delete(id); this.errors.delete(id); this.views.delete(id); this.sequence++;
      }
    }
    for (const [id, connection] of this.connections) {
      const broker = project?.brokers.find(broker => broker.id === id);
      if (!broker || connection.signature !== this.signature(broker, project!.systems.filter(system => system.brokerId === id))) {
        this.disconnect(id);
        for (const system of connection.systems) { this.remote.delete(system.id); this.errors.delete(system.id); }
      }
    }
    for (const [id, material] of this.tls) {
      const broker = project?.brokers.find(broker => broker.id === id);
      if (!broker || material.signature !== this.tlsSignature(broker)) this.tls.delete(id);
    }
  }
  setTLS(id: string, material: TLSMaterial | null): void {
    const broker = this.project?.brokers.find(broker => broker.id === id);
    if (!broker?.tls) throw new Error('invalidRequest');
    this.disconnect(id);
    if (material) this.tls.set(id, {signature: this.tlsSignature(broker), material: parseTLS(Buffer.from(JSON.stringify(material)))});
    else this.tls.delete(id);
    this.sequence++;
  }
  async connectBroker(id: string, authentication: 'optional' | 'required' | 'none' = 'optional'): Promise<void> {
    if (this.connections.get(id)?.closed) this.disconnect(id);
    if (this.connections.has(id)) return;
    const project = this.project; const broker = project?.brokers.find(broker => broker.id === id);
    if (!project || !broker) throw new Error('noProject');
    const systems = project.systems.filter(system => system.brokerId === id);
    if (!systems.length) throw new Error('noSystems');
    const epoch = this.epoch;
    const signature = this.signature(broker, systems);
    const secret = authentication === 'none' ? null : await this.credentials.read(project.id, broker);
    if (authentication === 'required' && !secret) throw new Error('credentialsMissing');
    const currentBroker = this.project?.brokers.find(item => item.id === id);
    if (this.project?.id !== project.id || this.epoch !== epoch || !currentBroker
      || this.signature(currentBroker, this.project.systems.filter(system => system.brokerId === id)) !== signature) throw new Error('stale');
    if (this.connections.has(id)) return;
    const client = this.factory(mqttOptions(broker, secret, this.tls.get(id)?.material ?? {}));
    const connection: Connection = {client, signature: this.signature(broker, systems), generation: 0, state: 'connecting', error: '', ready: false, pending: new Map(), systems, reads: new Map(), closed: false, bridges: new Map(), cycles: new Map(), subscription: null};
    this.connections.set(id, connection); this.sequence++;
    this.debug.record('mqttConnect', undefined, undefined, {operation: 'connect', broker: id});
    const invalidate = () => {
      if (this.connections.get(id) !== connection) return;
      connection.ready = false; connection.bridges.clear();
      if (connection.subscription) clearTimeout(connection.subscription);
      connection.subscription = null;
      for (const system of systems) { const remote = this.remote.get(system.id); if (remote) remote.fresh = false; }
      for (const pending of connection.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('disconnected')); }
      connection.pending.clear(); connection.reads.clear(); this.sequence++;
    };
    client.on('error', error => {
      if (this.connections.get(id) !== connection) return;
      const code = String((error as NodeJS.ErrnoException).code ?? '');
      connection.error = /CERT|TLS|SELF_SIGNED|VERIFY_LEAF/.test(code) ? 'tlsError' : ['4', '5', '134', '135'].includes(code) ? 'authentication' : 'connectionError';
      connection.state = 'error'; invalidate(); this.debug.record('mqttFailure', undefined, undefined, {operation: 'connect', broker: id, reason: connection.error});
      if (connection.error !== 'connectionError') { connection.closed = true; client.end(true); }
    });
    client.on('close', () => {
      invalidate();
      if (!connection.closed) connection.state = 'reconnecting';
      this.debug.record('mqttDisconnected', undefined, undefined, {operation: 'disconnect', broker: id});
    });
    client.on('reconnect', () => { if (!connection.closed) { connection.state = 'reconnecting'; this.sequence++; } });
    client.on('connect', () => {
      if (connection.closed) return;
      connection.generation++; connection.error = ''; connection.state = 'connecting'; invalidate();
      const generation = connection.generation;
      const topics = systems.flatMap(system => systemTopics(system.baseTopic));
      connection.subscription = setTimeout(() => {
        connection.error = 'timeout'; connection.state = 'error'; connection.closed = true; invalidate(); client.end(true);
      }, this.timeout);
      client.subscribe(topics, {qos: 0}, (error, grants) => {
        if (connection.closed || generation !== connection.generation || !client.connected) return;
        if (connection.subscription) clearTimeout(connection.subscription);
        connection.subscription = null;
        if (error || !grants || grants.length !== topics.length || grants.some(grant => Number(grant.qos) >= 128)) {
          connection.error = 'permission'; connection.state = 'error'; connection.closed = true; invalidate();
          this.debug.record('mqttFailure', undefined, undefined, {operation: 'connect', broker: id, reason: 'permission'}); client.end(true); return;
        }
        connection.ready = true; connection.state = 'connected'; this.sequence++; this.debug.record('mqttConnected', undefined, undefined, {operation: 'connect', broker: id});
        // Reconnection starts fresh read transactions only. No stored request is replayed.
        for (const system of systems) void this.refresh(system.id).catch(() => {});
      });
    });
    client.on('message', (topic, bytes, packet) => {
      if (connection.closed || bytes.length > 2097152) return;
      let value: unknown;
      try { value = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)); } catch { return; }
      const system = systems.find(system => systemTopics(system.baseTopic).includes(topic));
      if (!system) return;
      const bridge = connection.bridges.get(system.id) ?? {};
      if (topic === system.baseTopic + '/bridge/extensions') {
        if (Array.isArray(value) && value.every(item => record(item) && typeof item['name'] === 'string')) {
          bridge.installed = value.some(item => item.name === 'z2m-automations.mjs');
          connection.bridges.set(system.id, bridge);
        }
        return;
      }
      if (topic === system.baseTopic + '/bridge/state') {
        if (record(value) && ['online', 'offline'].includes(String(value['state']))) {
          bridge.online = value['state'] === 'online'; connection.bridges.set(system.id, bridge);
          // Only a live offline/online cycle proves a requested Z2M restart.
          // Keep evidence across MQTT reconnects; retained startup state is insufficient.
          if (!packet.retain) {
            const cycle = connection.cycles.get(system.id) ?? {offline: false, sequence: 0};
            if (!bridge.online) cycle.offline = true;
            else if (cycle.offline) { cycle.sequence++; cycle.offline = false; }
            connection.cycles.set(system.id, cycle);
          }
          this.sequence++;
        }
        if (record(value) && value['state'] === 'offline') { const old = this.remote.get(system.id); if (old) old.fresh = false; this.sequence++; }
        return;
      }
      if (topic === system.baseTopic + extensionPrefix + 'runs') {
        const current = this.remote.get(system.id);
        if (!packet.retain && connection.ready && current?.fresh) {
          try { this.updateExecution(system.id, current.status, executionData(value, current.status)); } catch { /* Ignore invalid or stale snapshots. */ }
        }
        return;
      }
      if (topic === system.baseTopic + extensionPrefix + 'status') {
        // Retained status is never freshness evidence. A live restart invalidates the current read.
        if (!packet.retain) {
          try {
            const next = statusData(value); const old = this.remote.get(system.id);
            if (old && (next.session !== old.status.session || next.revision !== old.status.revision || next.checksum !== old.status.checksum || next.executing !== old.status.executing || next.resumeEnabled !== old.status.resumeEnabled || next.recovery !== old.status.recovery)) {
              old.fresh = false; this.sequence++; void this.refresh(system.id).catch(() => {});
            }
          } catch { const old = this.remote.get(system.id); if (old) { old.fresh = false; this.sequence++; } }
        }
        return;
      }
      if (!connection.ready || packet.retain || !record(value) || typeof value['transaction'] !== 'string') return;
      const pending = connection.pending.get(value['transaction']);
      if (!pending || pending.topic !== topic || pending.generation !== connection.generation) return;
      if (!['install', 'restart'].includes(pending.operation) && value['protocol_version'] !== 1) return;
      connection.pending.delete(value['transaction']); clearTimeout(pending.timer);
      this.debug.record('mqttReply', system.id, undefined, {operation: pending.operation, transaction: value['transaction']});
      if (value['status'] === 'ok' && record(value['data'])) pending.resolve(value['data']);
      else {
        const error = value['error'];
        const details = pending.operation === 'validate' && value['status'] === 'error' && record(error)
          && typeof error['code'] === 'string' && ['invalid_schema', 'invalid_semantics', 'invalid_yaml', 'scene_unavailable'].includes(error['code'])
          ? readDraftDetails(error['details']) : null;
        pending.reject(details ? new DraftValidationError('remoteError', details) : new Error('remoteError'));
      }
    });
    client.connect();
  }
  private request(connection: Connection, system: ProjectSystem, operation: WireOperation, fields: Record<string, unknown> = {}): Promise<unknown> {
    if (!connection.ready || !connection.client.connected || connection.closed) return Promise.reject(new Error('disconnected'));
    return new Promise((resolve, reject) => {
      const transaction = randomUUID(); const topic = wireTopic(system.baseTopic, operation, 'response');
      const timer = setTimeout(() => { connection.pending.delete(transaction); reject(new Error('timeout')); }, this.timeout);
      const diagnostic = operation === 'status' || operation === 'editor' ? 'read' : operation;
      connection.pending.set(transaction, {topic, generation: connection.generation, operation: diagnostic, resolve, reject, timer});
      this.debug.record(diagnostic === 'read' ? 'mqttRead' : 'mqttTransfer', system.id, undefined, {operation: diagnostic, transaction});
      connection.client.publish(wireTopic(system.baseTopic, operation, 'request'), JSON.stringify({...fields, ...(['install', 'restart'].includes(operation) ? {} : {protocol_version: 1}), transaction}), {qos: 0, retain: false}, error => {
        if (error && connection.pending.has(transaction)) { connection.pending.delete(transaction); clearTimeout(timer); reject(new Error('connectionError')); }
      });
    });
  }
  private runtimeLocks = new Set<string>();
  noteUpdate(id: string, phase: string, failed: boolean): void {
    this.debug.record('extensionUpdate', id, undefined, {operation: 'install', phase, ...(failed ? {reason: 'protocol'} : {})});
  }
  noteTransfer(id: string, phase: string, failed: boolean): void {
    this.debug.record('draftTransfer', id, undefined, {operation: 'store', phase, ...(failed ? {reason: 'protocol'} : {})});
  }
  async runtime<T>(id: string, task: (wire: ReturnType<MqttReader['transfer']>) => Promise<T>): Promise<T> {
    if (this.runtimeLocks.has(id)) throw new Error('runtimeChanged');
    const wire = this.transfer(id);
    this.runtimeLocks.add(id);
    const system = this.project?.systems.find(item => item.id === id);
    if (system) this.connections.get(system.brokerId)?.reads.delete(id);
    try { return await task(wire); }
    finally { this.runtimeLocks.delete(id); }
  }
  transfer(id: string) {
    const system = this.project?.systems.find(item => item.id === id);
    const connection = system && this.connections.get(system.brokerId);
    if (!system || !connection?.ready) throw new Error('disconnected');
    const generation = connection.generation;
    const assertCurrent = () => {
      if (this.connections.get(system.brokerId) !== connection || connection.generation !== generation || !connection.ready) throw new Error('disconnected');
    };
    const send = async (operation: WireOperation, fields?: Record<string, unknown>) => {
      assertCurrent();
      if (connection.bridges.get(id)?.online === false) throw new Error('transferBridge');
      if (operation === 'store' || operation === 'install' || operation === 'restart') {
        // A read captured before a write must never publish its old snapshot later.
        connection.reads.delete(id);
        const previous = this.remote.get(id);
        if (previous) previous.fresh = false;
        this.sequence++;
      }
      const result = await this.request(connection, system, operation, fields);
      assertCurrent();
      return result;
    };
    return {
      assertCurrent,
      status: async (): Promise<RemoteStatus> => statusData(await send('status')),
      runtimeStatus: async () => {
        const value = await send('status');
        return {status: statusData(value), value};
      },
      runtime: (action: RuntimeAction, fields: Record<string, unknown>) => send(action, fields),
      editor: async (): Promise<RemoteRead> => editorData(await send('editor')),
      bridge: () => { assertCurrent(); return {...connection.bridges.get(id), restartSequence: connection.cycles.get(id)?.sequence ?? 0}; },
      validate: (yaml: string) => send('validate', {yaml}),
      store: (yaml: string, base: RemoteStatus) => send('store', {yaml, session: base.session, expected_revision: base.revision}),
      install: (code: string) => send('install', {name: 'z2m-automations.mjs', code}),
      restart: () => send('restart')
    };
  }
  async refresh(id: string): Promise<void> {
    if (this.runtimeLocks.has(id)) return;
    const project = this.project; const epoch = this.epoch;
    const system = project?.systems.find(system => system.id === id);
    const connection = system ? this.connections.get(system.brokerId) : null;
    if (!project || !system || !connection?.ready) throw new Error('disconnected');
    const existing = connection.reads.get(id); if (existing) return existing;
    const generation = connection.generation;
    const task: Promise<void> = Promise.resolve().then(async () => {
      this.errors.delete(id); const previous = this.remote.get(id); if (previous) previous.fresh = false; this.sequence++;
      try {
        const assertReading = () => { if (connection.reads.get(id) !== task || generation !== connection.generation) throw new Error('stale'); };
        assertReading();
        const before = statusData(await this.request(connection, system, 'status'));
        assertReading();
        const remote = editorData(await this.request(connection, system, 'editor'));
        assertReading();
        const after = statusData(await this.request(connection, system, 'status'));
        if ([remote.status, after].some(status => status.session !== before.session || status.revision !== before.revision || status.checksum !== before.checksum)
          || generation !== connection.generation || !connection.ready || this.project?.id !== project.id || this.epoch !== epoch) throw new Error('stale');
        remote.status = after;
        const current = () => generation === connection.generation && connection.ready && this.connections.get(system.brokerId) === connection
          && this.project?.id === project.id && this.epoch === epoch && connection.reads.get(id) === task;
        await this.observed(project.id, epoch, id, {revision: after.revision, checksum: after.checksum, configuration: remote.configuration, yaml: remote.yaml}, current);
        if (!current()) throw new Error('stale');
        const execution = after.execution;
        if (execution) {
          const previousStatus = previous?.status;
          delete after.execution;
          if (previousStatus?.session === after.session && previousStatus.revision === after.revision && previousStatus.checksum === after.checksum
            && previousStatus.execution) after.execution = previousStatus.execution;
          this.updateExecution(id, after, execution);
        }
        this.remote.set(id, {...remote, fresh: true}); this.debug.record('mqttReadComplete', id);
      } catch (error) {
        const code = error instanceof Error && ['timeout', 'protocol', 'stale', 'disconnected', 'remoteError'].includes(error.message) ? error.message : 'readError';
        if (connection.reads.get(id) === task && generation === connection.generation && this.connections.get(system.brokerId) === connection && this.epoch === epoch) this.errors.set(id, code);
        this.debug.record('mqttFailure', id, undefined, {operation: 'read', reason: code}); throw new Error(code);
      } finally { if (connection.reads.get(id) === task) connection.reads.delete(id); this.sequence++; }
    });
    connection.reads.set(id, task); return task;
  }
  private updateExecution(id: string, status: RemoteStatus, execution: Execution): void {
    if (status.execution && execution.sequence <= status.execution.sequence) return;
    for (const run of execution.runs) {
      const previous = status.execution?.runs.find(item => item.run === run.run);
      if (!previous || previous.state !== run.state || previous.step !== run.step) this.debug.execution(id, run);
    }
    status.execution = execution;
    this.sequence++;
  }
  disconnect(id: string): void {
    const connection = this.connections.get(id); if (!connection) return;
    connection.closed = true; connection.ready = false;
    if (connection.subscription) clearTimeout(connection.subscription);
    for (const pending of connection.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('disconnected')); }
    connection.pending.clear();
    for (const system of connection.systems) { const remote = this.remote.get(system.id); if (remote) remote.fresh = false; }
    connection.client.end(true); this.connections.delete(id); this.sequence++; this.debug.record('mqttDisconnected', undefined, undefined, {operation: 'disconnect', broker: id});
  }
  close(): void { for (const id of [...this.connections.keys()]) this.disconnect(id); }
  current(id: string): (RemoteRead & {fresh: boolean}) | null { const value = this.remote.get(id); return value ? structuredClone(value) : null; }
  connected(id: string): boolean { return this.connections.get(id)?.ready ?? false; }
  source(id: string): 'draft' | 'stored' { return this.views.get(id) ?? 'draft'; }
  view(id: string, source: 'draft' | 'stored'): void {
    const system = this.project?.systems.find(system => system.id === id);
    if (!system || source === 'stored' && !this.remote.has(id) && !system.stored) throw new Error('noStored');
    this.views.set(id, source); this.sequence++;
  }
  state() {
    return {sequence: this.sequence, brokers: (this.project?.brokers ?? []).map(broker => ({id: broker.id, name: broker.name, host: broker.host, port: broker.port, tls: broker.tls, state: this.connections.get(broker.id)?.state ?? 'disconnected', error: this.connections.get(broker.id)?.error ?? '', certificates: this.tls.has(broker.id)})),
      systems: (this.project?.systems ?? []).map(system => ({id: system.id, name: system.name, baseTopic: system.baseTopic, brokerId: system.brokerId, fresh: this.remote.get(system.id)?.fresh ?? false,
        reading: this.connections.get(system.brokerId)?.reads.has(system.id) ?? false, error: this.errors.get(system.id) ?? '', source: this.source(system.id),
        stored: this.remote.has(system.id) || Boolean(system.stored), revision: this.remote.get(system.id)?.status.revision ?? system.stored?.revision ?? null,
        executing: this.remote.get(system.id)?.fresh ? this.remote.get(system.id)?.status.executing ?? false : null,
        runtime: (() => {
          const remote = this.remote.get(system.id);
          if (!remote?.fresh || !remote.status.execution) return null;
          return {peers: remote.configuration.mesh_peers, rules: remote.configuration.automations.map(rule => ({id: rule['id'], name: rule['name'], enabled: rule['enabled'] === true})),
            runs: remote.status.execution.runs, recovery: remote.status.recovery, resume: remote.status.resumeEnabled};
        })(),
        extensionVersion: this.remote.get(system.id)?.status.extensionVersion ?? '', build: this.remote.get(system.id)?.status.build ?? null,
        devices: this.remote.get(system.id)?.devices.length ?? 0, scenes: this.remote.get(system.id)?.scenes.length ?? 0}))};
  }
}
export function validNetworkCommand(value: unknown): value is NetworkCommand {
  if (!record(value) || typeof value['action'] !== 'string' || typeof value['id'] !== 'string') return false;
  if (value['action'] === 'status') return exact(value, ['action', 'id']) && value['id'] === '';
  if (!/^[a-f0-9-]{36}$/.test(value['id'])) return false;
  if (value['action'] === 'linkPlan' || value['action'] === 'linkCheck') return exact(value, ['action', 'id', 'peerId'])
    && validId(value['id']) && validId(value['peerId']) && value['id'] !== value['peerId'];
  if (value['action'] === 'autoConnect') return exact(value, ['action', 'id', 'mode']) && validId(value['id'])
    && typeof value['mode'] === 'string' && ['off', 'credentials', 'anonymous'].includes(value['mode']);
  if (value['action'] === 'view') return exact(value, ['action', 'id', 'source']) && ['draft', 'stored'].includes(String(value['source']));
  if (value['action'] === 'setRuleFlags') return exact(value, ['action', 'id', 'context', 'enabled']) && validId(value['id'])
    && typeof value['context'] === 'string' && /^[a-f0-9]{64}$/.test(value['context']) && Array.isArray(value['enabled'])
    && value['enabled'].length <= 100 && new Set(value['enabled']).size === value['enabled'].length
    && value['enabled'].every(rule => typeof rule === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(rule));
  if (value['action'] === 'activate') return exact(value, ['action', 'id', 'resume']) && validId(value['id']) && typeof value['resume'] === 'boolean';
  if (value['action'] === 'run_once' || value['action'] === 'stop_rule') return exact(value, ['action', 'id', 'rule', ...(value['action'] === 'stop_rule' ? ['run'] : [])])
    && validId(value['id']) && typeof value['rule'] === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(value['rule'])
    && (value['action'] !== 'stop_rule' || validId(value['run']) && !value['run'].startsWith('example'));
  return exact(value, ['action', 'id']) && ['runtimeStatus', 'deactivate', 'validateEnabled', 'connect', 'disconnect', 'refresh', 'certificates', 'clearCertificates', 'validate', 'store', 'install', 'checkTransfer'].includes(value['action']);
}
