import {record, uuid, type RemoteRead, type RemoteStatus} from './mqtt-protocol.js';
import type {MqttReader} from './mqtt-reader.js';
import type {ProjectService} from './project-service.js';
import type {ProjectSystem} from './project.js';
import {runtimeStopped, sameStoredStatus} from './runtime-state.js';

type Wire = ReturnType<MqttReader['transfer']>;
export type UpdateStage = 'preparing' | 'stopping' | 'installing' | 'restarting' | 'waiting' | 'verifying' | 'restoring' | 'complete';
interface Hooks {
  confirm(system: ProjectSystem, base: RemoteStatus | null): Promise<boolean>;
  backup(system: ProjectSystem, remote: RemoteRead): Promise<boolean>;
  read(wire: Wire): Promise<RemoteRead>;
  observe(id: string, remote: RemoteRead): void;
}
interface Attempt {
  id: string; base: RemoteStatus | null; original: RemoteRead | null; assertCurrent(): void;
  stopIssued: boolean; installIssued: boolean; installed: boolean;
  restartIssued: boolean; restartSequence: number; restartSession?: string; restarted: boolean;
  restoreIssued: boolean; restoredSession?: string;
}
const failure = (stage: UpdateStage) => stage === 'stopping' ? 'extensionStopUncertain'
  : stage === 'installing' ? 'extensionSaveUncertain' : stage === 'restoring' ? 'extensionRestoreUncertain'
    : stage === 'verifying' ? 'extensionVerifyUncertain' : 'extensionRestartUncertain';

export class ExtensionUpdate {
  private attempts = new Map<string, Attempt>();
  private progress = new Map<string, {id: string; stage: UpdateStage; failed: boolean}>();
  private epoch = -1;
  sequence = 0;
  constructor(private readonly projects: ProjectService, private readonly reader: MqttReader,
    private readonly artifact: {code: string; build: string}, private readonly hooks: Hooks,
    private readonly options = {timeout: 90000, poll: 500}) {}

  state() {
    if (this.epoch !== this.projects.generation()) {
      this.progress.clear(); this.epoch = this.projects.generation(); this.sequence++;
    }
    return [...this.progress.values()].map(value => ({...value}));
  }
  has(key: string) { return this.attempts.has(key); }
  pending(id: string) { return [...this.attempts.values()].some(attempt => attempt.id === id); }
  private stage(id: string, stage: UpdateStage, failed = false) {
    this.state(); this.progress.set(id, {id, stage, failed}); this.sequence++;
    this.reader.noteUpdate(id, stage, failed);
  }
  private storage(status: RemoteStatus, attempt: Attempt): boolean {
    return status.revision === (attempt.base?.revision ?? 0) && status.checksum === (attempt.base?.checksum ?? null)
      && status.storage === (attempt.base?.storage ?? 'empty');
  }
  private wire(attempt: Attempt): Wire { attempt.assertCurrent(); return this.reader.transfer(attempt.id); }
  private async wait(attempt: Attempt, check: (wire: Wire) => Promise<boolean>): Promise<void> {
    const end = Date.now() + this.options.timeout;
    do {
      attempt.assertCurrent();
      try { if (await check(this.wire(attempt))) return; } catch { /* Read-only reconciliation; never replay a control request. */ }
      if (Date.now() >= end) break;
      await new Promise(resolve => setTimeout(resolve, this.options.poll));
    } while (Date.now() < end);
    throw new Error('timeout');
  }
  async command(key: string, system: ProjectSystem, readOnly = false): Promise<string> {
    return this.reader.runtime(system.id, async wire => {
      let attempt = this.attempts.get(key);
      if (!attempt) {
        if (readOnly) throw new Error('transferUncertain');
        if (wire.bridge().online !== true) throw new Error('transferBridge');
        const base = await wire.status().catch(error => {
          if (error instanceof Error && error.message === 'timeout' && wire.bridge().installed === false && !system.stored?.revision) return null;
          throw error;
        });
        if (base?.build === this.artifact.build) return 'transferInstalled';
        if (base?.executing && (!base.activeMatches || !base.execution)) throw new Error('runtimeChanged');
        const project = this.projects.data(), epoch = this.projects.generation();
        const endpoint = (data: typeof project) => {
          const owner = data.systems.find(item => item.id === system.id);
          const broker = data.brokers.find(item => item.id === owner?.brokerId);
          return JSON.stringify([data.id, owner?.baseTopic, broker?.id, broker?.host, broker?.port, broker?.tls]);
        };
        const originalEndpoint = endpoint(project);
        const assertCurrent = () => {
          if (!this.projects.active || this.projects.generation() !== epoch || endpoint(this.projects.data()) !== originalEndpoint) throw new Error('transferChanged');
        };
        if (!await this.hooks.confirm(system, base)) return 'transferCanceled';
        assertCurrent(); wire.assertCurrent();
        const original = base ? await this.hooks.read(wire) : null;
        if (base && (!original || !sameStoredStatus(base, original.status) || base.executing !== original.status.executing
          || base.resumeEnabled !== original.status.resumeEnabled)) throw new Error('transferChanged');
        if (original?.status.revision && !await this.hooks.backup(system, original)) return 'transferCanceled';
        assertCurrent();
        if (base) {
          const current = await wire.status();
          if (!sameStoredStatus(base, current) || current.executing !== base.executing || current.resumeEnabled !== base.resumeEnabled) throw new Error('transferChanged');
        } else if (wire.bridge().installed !== false) throw new Error('transferChanged');
        if (this.attempts.size >= 32) throw new Error('transferUncertain');
        attempt = {id: system.id, base, original, assertCurrent, stopIssued: false, installIssued: false, installed: false,
          restartIssued: false, restartSequence: 0, restarted: false, restoreIssued: false};
        this.attempts.set(key, attempt);
      } else if (!readOnly && !await this.hooks.confirm(system, attempt.base)) return 'transferCanceled';
      return this.run(key, attempt, !readOnly);
    });
  }
  private async run(key: string, attempt: Attempt, controls: boolean): Promise<string> {
    let phase: UpdateStage = 'stopping';
    const set = (stage: UpdateStage) => { phase = stage; this.stage(attempt.id, stage); };
    try {
      if (!attempt.installIssued && attempt.base) {
        set('stopping');
        if (!runtimeStopped(attempt.base) && !attempt.stopIssued) {
          if (!controls) throw new Error();
          const wire = this.wire(attempt), current = await wire.status();
          if (!sameStoredStatus(current, attempt.base) || current.executing !== attempt.base.executing) throw new Error();
          attempt.stopIssued = true;
          await wire.runtime('deactivate', {session: current.session}).catch(() => {});
        }
        const stopped = await this.wire(attempt).status();
        if (!sameStoredStatus(stopped, attempt.base) || !runtimeStopped(stopped)) throw new Error();
      }
      set('installing');
      if (!attempt.installIssued) {
        if (!controls) throw new Error();
        attempt.installIssued = true;
        try { await this.wire(attempt).install(this.artifact.code); attempt.installed = true; } catch { /* Verify an applied save without resending it. */ }
      }
      if (!attempt.installed) {
        const current = await this.wire(attempt).status();
        if (current.build !== this.artifact.build || current.session === attempt.base?.session
          || !this.storage(current, attempt) || !runtimeStopped(current)) throw new Error();
        attempt.installed = true;
      }
      if (!attempt.restartIssued) {
        set('restarting');
        if (!controls) throw new Error();
        const wire = this.wire(attempt), current = await wire.status();
        if (!this.storage(current, attempt) || !runtimeStopped(current) || wire.bridge().online !== true) throw new Error();
        attempt.restartSession = current.session;
        attempt.restartSequence = wire.bridge().restartSequence;
        attempt.restartIssued = true;
        await wire.restart().catch(() => {});
      }
      if (!attempt.restarted) {
        set('waiting');
        await this.wait(attempt, async wire => {
          if (wire.bridge().online !== true || wire.bridge().restartSequence <= attempt.restartSequence) return false;
          const current = await wire.status();
          return current.session !== attempt.restartSession && current.build === this.artifact.build
            && this.storage(current, attempt) && runtimeStopped(current);
        });
        attempt.restarted = true;
      }
      set('verifying');
      const wire = this.wire(attempt), remote = await this.hooks.read(wire);
      if (remote.status.build !== this.artifact.build || !this.storage(remote.status, attempt)
        || remote.yaml !== (attempt.original?.yaml ?? null)) throw new Error();
      if (attempt.base?.executing) {
        set('restoring');
        const active = (status: RemoteStatus) => sameStoredStatus(status, remote.status) && status.executing
          && status.activeMatches && status.resumeEnabled === attempt.base!.resumeEnabled;
        if (!attempt.restoreIssued) {
          if (!controls) throw new Error();
          const challenge = await wire.runtimeStatus();
          if (!sameStoredStatus(challenge.status, remote.status) || !runtimeStopped(challenge.status)
            || !record(challenge.value) || !uuid(challenge.value['activation_token'])) throw new Error();
          attempt.restoreIssued = true; attempt.restoredSession = challenge.status.session;
          await wire.runtime('activate', {session: challenge.status.session, expected_revision: challenge.status.revision,
            checksum: challenge.status.checksum, activation_token: challenge.value['activation_token'],
            resume_after_restart: attempt.base.resumeEnabled}).catch(() => {});
        }
        const current = await this.wire(attempt).status();
        if (current.session !== attempt.restoredSession || !active(current)) throw new Error();
      } else if (!runtimeStopped(remote.status)) throw new Error();
      this.hooks.observe(attempt.id, remote);
      this.attempts.delete(key); this.stage(attempt.id, 'complete');
      return 'transferInstalled';
    } catch {
      this.stage(attempt.id, phase, true);
      throw new Error(failure(phase));
    }
  }
}
