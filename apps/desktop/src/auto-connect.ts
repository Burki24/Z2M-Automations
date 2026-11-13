import {createHash} from 'node:crypto';
import {mkdir, unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {atomicWrite, boundedRead} from './project-files.js';
import {exact, type Broker, type Project} from './project.js';
import type {MqttReader} from './mqtt-reader.js';
import type {Diagnostics} from './diagnostics.js';

export type AutoConnectMode = 'off' | 'credentials' | 'anonymous';
export interface AutoConnectSetting {mode: AutoConnectMode; issue: string}
interface Entry extends AutoConnectSetting {key: string}

export class AutomaticConnections {
  private project: Project | null = null;
  private epoch = -1;
  private openedEpoch = -1;
  private entries = new Map<string, Entry>();
  sequence = 0;
  constructor(private readonly directory: string, private readonly reader: Pick<MqttReader, 'connectBroker'>, private readonly debug: Diagnostics) {}
  private key(project: string, broker: Broker): string {
    return createHash('sha256').update(JSON.stringify([project, broker.id, broker.host, broker.port, broker.tls])).digest('hex');
  }
  async reconcile(project: Project | null, epoch: number): Promise<void> {
    if (project?.id !== this.project?.id || epoch !== this.epoch) {
      this.entries.clear(); this.openedEpoch = -1; this.sequence++;
    }
    this.project = project ? structuredClone(project) : null; this.epoch = epoch;
    for (const id of this.entries.keys()) if (!project?.brokers.some(broker => broker.id === id)) this.entries.delete(id);
    if (!project) return;
    for (const broker of project.brokers) {
      const key = this.key(project.id, broker);
      if (this.entries.get(broker.id)?.key === key) continue;
      const entry: Entry = {key, mode: 'off', issue: ''};
      try {
        const saved: unknown = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(await boundedRead(join(this.directory, key + '.json'), 256)));
        if (!exact(saved, ['version', 'mode']) || saved['version'] !== 1 || typeof saved['mode'] !== 'string'
          || !['credentials', 'anonymous'].includes(saved['mode'])) throw new Error('invalidSetting');
        entry.mode = saved['mode'] as AutoConnectMode;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') entry.issue = 'settingsUnavailable';
      }
      const current = this.project?.brokers.find(item => item.id === broker.id);
      if (this.epoch !== epoch || this.project?.id !== project.id || !current || this.key(project.id, current) !== key) return;
      this.entries.set(broker.id, entry); this.sequence++;
    }
  }
  setting(id: string): AutoConnectSetting {
    const entry = this.entries.get(id);
    return {mode: entry?.mode ?? 'off', issue: entry?.issue ?? ''};
  }
  settings(): Record<string, AutoConnectSetting> {
    return Object.fromEntries([...this.entries.keys()].map(id => [id, this.setting(id)]));
  }
  async set(id: string, mode: AutoConnectMode): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry || !['off', 'credentials', 'anonymous'].includes(mode)) throw new Error('invalidRequest');
    const path = join(this.directory, entry.key + '.json');
    try {
      if (mode === 'off') await unlink(path).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; });
      else {
        await mkdir(this.directory, {recursive: true, mode: 0o700});
        await atomicWrite(path, Buffer.from(JSON.stringify({version: 1, mode}) + '\n'));
      }
    } catch { throw new Error('autoConnectSettings'); }
    entry.mode = mode; entry.issue = ''; this.sequence++;
    this.debug.record('mqttAutoConnect', undefined, undefined, {operation: 'autoConnect', broker: id});
  }
  clearIssue(id: string): void {
    const entry = this.entries.get(id);
    if (entry?.issue) { entry.issue = ''; this.sequence++; }
  }
  async connect(id: string): Promise<void> {
    const entry = this.entries.get(id);
    const mode = entry?.mode ?? 'off';
    const authentication = {off: 'optional', credentials: 'required', anonymous: 'none'} as const;
    this.clearIssue(id);
    try { await this.reader.connectBroker(id, authentication[mode]); }
    catch (error) {
      const code = error instanceof Error ? error.message : '';
      let issue = 'connectionError';
      if (code === 'protectionUnavailable') issue = 'credentialsLocked';
      else if (['credentialsMissing', 'noSystems', 'noProject', 'stale'].includes(code)) issue = code;
      if (entry && this.entries.get(id) === entry) { entry.issue = issue; this.sequence++; }
      this.debug.record('mqttFailure', undefined, undefined, {operation: 'connect', broker: id, reason: issue});
      throw new Error(issue);
    }
  }
  async opened(epoch: number): Promise<void> {
    if (!this.project || epoch !== this.epoch || this.openedEpoch === epoch) return;
    this.openedEpoch = epoch;
    for (const broker of this.project.brokers) {
      if (this.epoch !== epoch) return;
      if (this.setting(broker.id).mode === 'off') continue;
      this.debug.record('mqttAutoConnect', undefined, undefined, {operation: 'connect', broker: broker.id});
      try { await this.connect(broker.id); } catch { /* Each broker reports its own issue; continue with the others. */ }
    }
  }
}
