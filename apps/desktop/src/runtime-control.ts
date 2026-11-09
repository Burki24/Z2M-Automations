import {executionData, record, statusData, uuid, type RemoteStatus} from './mqtt-protocol.js';
import type {MqttReader, NetworkCommand, RuntimeAction} from './mqtt-reader.js';
import type {ProjectService} from './project-service.js';

interface Review {system: string; broker: string; topic: string; revision: number; rule: string; run: string; recovery: boolean; enabled: number}
const same = (a: RemoteStatus, b: RemoteStatus) => a.session === b.session && a.revision === b.revision
  && a.checksum === b.checksum && a.build === b.build && a.executing === b.executing && a.resumeEnabled === b.resumeEnabled;

export class RuntimeControl {
  private uncertain = new Set<string>();

  constructor(private readonly projects: ProjectService, private readonly reader: MqttReader,
    private readonly confirm: (action: RuntimeAction, review: Review) => Promise<boolean>) {}

  async command(action: RuntimeAction, command: NetworkCommand): Promise<string> {
    if (!this.projects.active) throw new Error('noProject');
    const project = this.projects.data();
    const system = project.systems.find(item => item.id === command.id);
    const broker = project.brokers.find(item => item.id === system?.brokerId);
    if (!system || !broker) throw new Error('noSystems');
    return this.reader.runtime(system.id, async wire => {
      const initial = await wire.status();
      const cached = this.reader.current(system.id);
      if (!initial.execution) throw new Error('runtimeChanged');
      if (action !== 'deactivate' && (!cached?.fresh || !same(initial, cached.status))) throw new Error('runtimeChanged');
      const starting = action === 'activate' || action === 'run_once';
      const endpoint = JSON.stringify([broker.host, broker.port, broker.tls, system.baseTopic]);
      if (starting && this.uncertain.has(endpoint)) throw new Error('runtimeUncertain');
      const remote = starting ? await wire.editor() : undefined;
      if (remote && !same(initial, remote.status)) throw new Error('runtimeChanged');
      const enabled = remote?.configuration.automations.filter(rule => rule['enabled'] === true).length ?? 0;
      if (action === 'activate' && (!enabled || initial.executing)) throw new Error('runtimeNoEnabled');
      if (action === 'run_once' && !remote?.configuration.automations.some(rule => rule['id'] === command.rule)) throw new Error('runtimeChanged');
      const selectedRun = (status: RemoteStatus) => status.execution?.runs.find(run => run.rule === command.rule);
      const running = (status: RemoteStatus) => selectedRun(status)?.state === 'running' ? selectedRun(status) : undefined;
      if (action === 'stop_rule' && running(initial)?.run !== command.run || action === 'run_once' && running(initial)) throw new Error('runtimeChanged');
      if (!await this.confirm(action, {system: system.name, topic: system.baseTopic,
        broker: broker.name + ' (' + broker.host + ':' + broker.port + ')', revision: initial.revision,
        rule: command.rule ?? '—', run: command.run ?? '—', recovery: command.resume === true, enabled})) return 'transferCanceled';
      const {status: base, value} = await wire.runtimeStatus();
      if (!same(initial, base) || !base.execution || action === 'stop_rule' && running(base)?.run !== command.run
        || action === 'run_once' && (running(base) || selectedRun(initial)?.run !== selectedRun(base)?.run)) throw new Error('runtimeChanged');
      const fields: Record<string, unknown> = {session: base.session};
      if (action !== 'deactivate') Object.assign(fields, {expected_revision: base.revision, checksum: base.checksum});
      if (command.rule) fields['rule_id'] = command.rule;
      if (action === 'stop_rule') fields['run'] = command.run;
      if (action === 'activate') fields['resume_after_restart'] = command.resume === true;
      if (starting) {
        if (!record(value) || !uuid(value['activation_token'])) throw new Error('protocol');
        if (this.uncertain.size >= 32) throw new Error('runtimeUncertain');
        fields['activation_token'] = value['activation_token'];
        this.uncertain.add(endpoint);
      }
      try {
        const result = await wire.runtime(action, fields);
        const verified = await wire.status();
        if (verified.session !== base.session || verified.revision !== base.revision || verified.checksum !== base.checksum
          || verified.build !== base.build || !verified.execution) throw new Error('protocol');
        if (action === 'activate' || action === 'deactivate') {
          const check = (status: RemoteStatus) => status.session === base.session && status.revision === base.revision
            && status.checksum === base.checksum && status.build === base.build && status.executing === (action === 'activate')
            && status.resumeEnabled === (action === 'activate' && command.resume === true)
            && (action === 'activate' ? status.activeMatches : !status.execution?.runs.some(run => run.state === 'running'));
          if (!check(statusData(result)) || !check(verified)) throw new Error('protocol');
          this.uncertain.delete(endpoint);
        } else {
          const response = executionData(result, base);
          const run = response.runs.find(run => run.rule === command.rule);
          if (!run || action === 'stop_rule' && (run.run !== command.run || run.state !== 'stopped')
            || action === 'run_once' && run.run === selectedRun(base)?.run
            || verified.execution.sequence < response.sequence || selectedRun(verified)?.run !== run.run
            || action === 'stop_rule' && selectedRun(verified)?.state !== 'stopped') throw new Error('protocol');
          if (action === 'run_once') this.uncertain.delete(endpoint);
        }
      } catch { throw new Error('runtimeUncertain'); }
      return 'runtimeConfirmed';
    });
  }
}
