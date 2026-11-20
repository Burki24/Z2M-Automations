import {join} from 'node:path';
import {type Channel, type Language} from './contracts.js';
import {languageChange, validPayload} from './security.js';
import {Diagnostics} from './diagnostics.js';
import {OfflineWorkspace} from './offline-workspace.js';
import {ProjectService, type ProjectCommand, type ProjectDialogs} from './project-service.js';
import {validId, type Configuration} from './project.js';
import {type Credentials, type CredentialCommand} from './credentials.js';
import {MqttReader, parseTLS, validNetworkCommand, type NetworkCommand} from './mqtt-reader.js';
import {AutomaticConnections} from './auto-connect.js';
import {DraftEditor, type DesignerCommand} from './draft-editor.js';
import {partnerOverview} from './partner-overview.js';
import {systemLinkPlan, readSystemLink} from './system-link.js';
import {DraftExchange} from './draft-exchange.js';
import {DraftValidationError} from './draft-feedback.js';
import {ExtensionTransfer, bundledExtension} from './extension-transfer.js';
import {RuntimeControl} from './runtime-control.js';

interface WorkspaceHost {
  platform: string;
  version: string;
  data: string;
  diagnostics: Diagnostics;
  vault: Credentials;
  projectDialogs: ProjectDialogs;
  translate(key: string): string;
  setLanguage(language: Language): void;
  chooseDraft(key: string, extension: string, open: boolean): Promise<string | null>;
  chooseCertificates(): Promise<Buffer | null>;
  review(key: string, detail: string, notice?: boolean): Promise<boolean>;
  confirmTransfer(input: TransferPrompt): Promise<{accepted: boolean; resume: boolean}>;
  smoke?: boolean;
  mqttFactory?: ConstructorParameters<typeof MqttReader>[3];
}
export interface TransferPrompt {
  question: string;
  detail: string;
  cancel: string;
  accept: string;
  resume: {enabled: boolean; label: string; help: string; detail: string};
}
type WorkspaceChannel = Exclude<Channel, 'theme' | 'help'>;

export function createWorkspaceApplication(host: WorkspaceHost) {
  const {diagnostics: debug, smoke = false, translate: message, chooseDraft, review: reviewDialog} = host;
  const workspace = new OfflineWorkspace(debug, host.platform, host.version);
  const projects = new ProjectService(host.vault, host.projectDialogs, debug, join(host.data, 'draft-recovery'));
  const reader: MqttReader = new MqttReader(host.vault, debug, (project, epoch, system, stored, current) => projects.serialize(async () => {
    if (!current()) throw new Error('stale');
    await projects.reconcileStored(project, epoch, system, stored, {}, current);
    reader.reconcile(projects.data(), projects.generation());
  }), host.mqttFactory);
  const automaticConnections = new AutomaticConnections(join(host.data, 'connection-preferences'), reader, debug);
  const drafts = new DraftEditor(projects, reader);
  const transfers = new ExtensionTransfer(projects, reader, {
    backup: async (conflict, review) => {
      if (conflict && review) await reviewDialog('transferConflict',
        message('transferConflictDetail').replace(/\{\{(\w+)\}\}/g, (_, key: keyof typeof review) => String(review[key] ?? '')), true);
      return chooseDraft(conflict ? 'transferConflictBackup' : 'transferBackup', 'z2map', false);
    },
    confirm: async (action, review) => {
      if (smoke) return false;
      const detail = (action === 'store' ? message(review.kind === 'flags' ? 'transferStoreFlagsDetail' : 'transferStoreDetail') + '\n'
        + message(review.kind === 'flags' ? 'transferStoreFlags' : 'transferStoreConfiguration') + '\n'
        + message(review.running ? 'transferStoreStop' : 'transferStoreStopped') : message('transferInstallDetail'))
        .replace(/\{\{(\w+)\}\}/g, (_, key: keyof typeof review) => String(review[key] ?? ''));
      if (action === 'store') {
        const values = {...review, enabled: review.resumeRules.length, names: review.resumeRules.map(name => '• ' + name).join('\n') || '—'};
        return host.confirmTransfer({question: message(review.kind === 'flags' ? 'transferStoreFlagsConfirm' : 'transferStoreConfirm'),
          detail, cancel: message('cancel'), accept: message('continue'), resume: {enabled: review.resumeAllowed,
            label: message('transferResumePrevious'), help: message(review.resumeAllowed ? 'transferResumeHelp' : 'transferResumeUnavailable'),
            detail: message('transferResumeDetail').replace(/\{\{(\w+)\}\}/g, (_, key: keyof typeof values) => String(values[key] ?? ''))}});
      }
      return reviewDialog('transferInstallConfirm', detail);
    }
  });
  const runtime = new RuntimeControl(projects, reader, async (action, review) => {
    if (smoke) return false;
    const detail = message('runtimeTarget').replace(/\{\{(\w+)\}\}/g, (_, key: keyof typeof review) => String(review[key] ?? ''))
      + (action === 'activate' ? '\n' + message(review.recovery ? 'runtimeRecoveryOn' : 'runtimeRecoveryOff').replace('{{enabled}}', String(review.enabled))
        + '\n' + (review.enabled ? message('runtimeEnabledRules') + '\n' + review.enabledRules.map(name => '• ' + name).join('\n') : message('runtimeReceiverOnly')) : '');
    return reviewDialog('runtime_' + action, detail);
  });
  const exchange = new DraftExchange(projects, drafts, {
    chooseImport: () => chooseDraft('importDraft', 'yaml', true),
    chooseExport: () => chooseDraft('exportDraft', 'yaml', false),
    chooseBackup: () => chooseDraft('backupDraft', 'z2map', false),
    chooseDraftExport: () => chooseDraft('exportDraft', 'z2mad', false),
    chooseProjectExport: () => chooseDraft('save', 'z2map', false),
    confirm: async summary => {
      if (smoke) return false;
      return reviewDialog('replaceDraft', message('importSummary').replace('{{oldRules}}', String(summary.oldRules))
        .replace('{{rules}}', String(summary.rules)).replace('{{sequences}}', String(summary.sequences)).replace('{{peers}}', String(summary.peers)));
    }
  });

  const configurationSummary = (configuration?: Configuration) => configuration ? {
    rules: configuration.automations.length, enabled: configuration.automations.filter(rule => rule['enabled'] === true).length,
    sequences: configuration.sequences.length
  } : null;
  function snapshot(): unknown {
    const base = workspace.snapshot();
    if (!projects.active) return base;
    const project = projects.data();
    const system = project.systems.find(system => system.id === projects.selected);
    const remote = system ? reader.current(system.id) : null;
    const source = system ? reader.source(system.id) : 'draft';
    const configuration = source === 'stored' ? remote?.configuration ?? system?.stored?.configuration : system?.configuration;
    return {...base, desktop: {...base.desktop, project: true, projectId: project.id, epoch: projects.generation(), source, systemName: system?.name ?? '',
      draftRevision: system?.configuration.revision ?? null, projectDirty: projects.isDirty(),
      draftSummary: configurationSummary(system?.configuration), storedSummary: configurationSummary(remote?.configuration ?? system?.stored?.configuration)},
      module: {...base.module, name: project.name, baseTopic: system?.baseTopic ?? ''}, devices: remote?.devices ?? [], scenes: remote?.scenes ?? [],
      status: {...base.status, mqttConnected: system ? reader.connected(system.brokerId) : false, autoConnectIssue: system ? automaticConnections.setting(system.brokerId).issue : '', confirmed: remote?.fresh ?? false,
        storedRevision: remote?.status.revision ?? system?.stored?.revision ?? null,
        executing: remote?.fresh ? remote.status.executing : false, activeRevision: remote?.fresh && remote.status.executing ? remote.status.revision : null},
      catalogAvailable: Boolean(remote), configuration: configuration ?? {schema_version: 1, revision: 1, automations: [], sequences: [], mesh_peers: []},
      operationConfiguration: remote?.fresh ? remote.configuration : null,
      workspace: {fingerprint: project.id, systems: project.systems.map(system => ({name: system.name,
        runtimeConfirmed: reader.connected(system.brokerId) && reader.current(system.id)?.fresh === true,
        executing: reader.connected(system.brokerId) && reader.current(system.id)?.fresh ? reader.current(system.id)!.status.executing : null,
        binding: {systemId: system.id, generation: 1, baseTopic: system.baseTopic}}))},
      partnerPermissions: partnerOverview(project, reader),
      workspaceContext: {systemId: system?.id ?? '', generation: projects.generation() + 1, fingerprint: project.id},
      ...(system ? drafts.view(system) : {})};
  }

  function handle(channel: WorkspaceChannel, payload: unknown): unknown {
    if (!validPayload(channel, payload)) { debug.record('rejected'); throw new Error('Invalid workspace request.'); }
    switch (channel) {
      case 'snapshot': return snapshot();
      case 'select-system': if (typeof payload === 'string') {
        if (!projects.active) return workspace.select(payload);
        projects.select(payload); debug.record('systemSelected', payload); return {ok: true};
      } break;
      case 'language': if (languageChange(payload)) { host.setLanguage(payload.language); debug.record('languageChanged', undefined, payload.language); return {ok: true}; } break;
      case 'diagnostics': return debug.read();
      case 'recording': if (payload === 'start' || payload === 'stop') return debug.control(payload); break;
      case 'project': {
        const command = payload as ProjectCommand;
        const before = projects.generation();
        return projects.command(command).then(async state => {
          const project = projects.active ? projects.data() : null;
          reader.reconcile(project, projects.generation());
          await automaticConnections.reconcile(project, projects.generation());
          if (command.action === 'open' && before !== projects.generation()) {
            const epoch = projects.generation();
            void projects.serialize(() => automaticConnections.opened(epoch)).catch(() => debug.record('mqttFailure'));
          }
          return {...(state as object), autoConnect: automaticConnections.settings()};
        });
      }
      case 'credential': return projects.credential(payload as CredentialCommand).then(state => {
        const id = (payload as CredentialCommand).brokerId;
        reader.disconnect(id);
        if (!(state as {canceled?: boolean}).canceled) automaticConnections.clearIssue(id);
        return {...(state as object), autoConnect: automaticConnections.settings()};
      });
      case 'network': return network(payload as NetworkCommand);
      case 'designer': return designer(payload as DesignerCommand);
    }
    throw new Error('Invalid workspace request.');
  }
  async function designer(command: DesignerCommand): Promise<unknown> {
    const context = {operation: 'draft' as const, ...(typeof command.payload['requestId'] === 'string' ? {transaction: command.payload['requestId']} : {})};
    debug.record('draftRequest', command.systemId, undefined, context);
    try {
      let result;
      if (command.route === 'draft-files') result = await exchange.fileCommand(command);
      else if (command.route === 'draft-sync' || command.route === 'draft-sync-status') {
        drafts.system(command);
        if (command.route === 'draft-sync-status' && Object.keys(command.payload).length) throw new Error('invalidRequest');
        if (command.route === 'draft-sync') {
          const {action, operation, choices = {}} = command.payload;
          if (!validId(command.payload['requestId']) || String(command.payload['requestId']).startsWith('example')
            || Object.keys(command.payload).some(key => !['requestId', 'action', 'operation', 'choices'].includes(key)) || typeof action !== 'string' || typeof operation !== 'string'
            || !choices || typeof choices !== 'object' || Array.isArray(choices)) throw new Error('invalidRequest');
          if (action !== 'refresh') await projects.resolveDraftSync(command.systemId, operation, action, choices);
          if (action === 'refresh' || action === 'merge') {
            const projectID = projects.data().id; const epoch = projects.generation();
            projects.beginDraftRead(command.systemId);
            void reader.refresh(command.systemId).catch(() => {
              if (projects.data().id === projectID && projects.generation() === epoch) projects.failDraftRead(command.systemId);
            });
          }
          reader.reconcile(projects.data(), projects.generation());
        }
        const system = projects.data().systems.find(item => item.id === command.systemId)!;
        result = {ok: true, draftSync: drafts.view(system)['draftSync']};
      } else result = await (['import', 'export', 'adopt'].includes(command.route) ? exchange.command(command) : drafts.command(command));
      if (command.route === 'editor-state' && command.payload['pending'] === false) {
        for (const system of projects.data().systems) if (system.stored) await projects.reconcileStored(projects.data().id, projects.generation(), system.id, system.stored);
        reader.reconcile(projects.data(), projects.generation());
      }
      debug.record('draftCompleted', command.systemId, undefined, context); return result;
    } catch (error) { debug.record('draftRejected', command.systemId, undefined, context); throw error; }
  }
  function networkState() {
    const state = reader.state();
    const update = transfers.updateState();
    const review = transfers.reviewState();
    return {...state, sequence: state.sequence + automaticConnections.sequence + update.sequence + review.sequence,
      extensionUpdates: update.updates, draftChecks: review.checks, transferProgress: review.progress,
      systems: state.systems.map(system => ({...system, flagsContext: transfers.flagsContext(system.id),
        transferPending: transfers.transferPending(system.id), updatePending: transfers.updatePending(system.id)})),
      brokers: state.brokers.map(broker => ({...broker, autoConnect: automaticConnections.setting(broker.id)})), bundledExtension};
  }
  async function network(command: NetworkCommand): Promise<unknown> {
    switch (command.action) {
      case 'setRuleFlags': {
        if (smoke) throw new Error('invalidRequest');
        try {
          const outcome = await transfers.applyFlags(command.id, command.context!, command.enabled!);
          return {...networkState(), outcome};
        }
        finally { void reader.refresh(command.id).catch(() => {}); }
      }
      case 'linkPlan': case 'linkCheck': {
        if (!projects.active) throw new Error('noProject');
        const project = projects.data();
        if (command.action === 'linkCheck') {
          readSystemLink(project, reader, command.id, command.peerId!);
          for (const id of [command.id, command.peerId!]) debug.record('projectRequest', id, undefined, {operation: 'read'});
        }
        return {...networkState(), epoch: projects.generation(), linkPlan: systemLinkPlan(project, reader, command.id, command.peerId!)};
      }
      case 'activate': case 'deactivate': case 'run_once': case 'stop_rule': {
        if (smoke) throw new Error('invalidRequest');
        if ((command.action === 'activate' || command.action === 'run_once') && transfers.updatePending(command.id)) throw new Error('extensionUpdatePending');
        if ((command.action === 'activate' || command.action === 'run_once') && transfers.transferPending(command.id)) throw new Error('transferUncertain');
        try {
          const outcome = await runtime.command(command.action, command);
          return {...networkState(), outcome};
        } finally { void reader.refresh(command.id).catch(() => {}); }
      }
      case 'runtimeStatus': void reader.refresh(command.id).catch(() => {}); break;
      case 'validateEnabled': case 'validate': case 'store': case 'install': case 'checkTransfer': {
        const target = projects.data().systems.find(system => system.id === command.id);
        if (command.action === 'store' || ['validateEnabled', 'validate'].includes(command.action) && target && reader.connected(target.brokerId)) projects.assertDraftSynchronized(command.id);
        if (smoke && command.action !== 'validate') throw new Error('invalidRequest');
        try {
          const outcome = await transfers.command(command.action, command.id);
          return {...networkState(), outcome};
        } finally {
          if (command.action !== 'validate' && command.action !== 'validateEnabled') void reader.refresh(command.id).catch(() => {});
        }
      }
      case 'status': break;
      case 'connect': await automaticConnections.connect(command.id); break;
      case 'disconnect': reader.disconnect(command.id); automaticConnections.clearIssue(command.id); break;
      case 'autoConnect': await automaticConnections.set(command.id, command.mode!); break;
      case 'refresh': void reader.refresh(command.id).catch(() => {}); break;
      case 'clearCertificates': reader.setTLS(command.id, null); break;
      case 'view': reader.view(command.id, command.source!); break;
      case 'certificates': {
        if (smoke) break;
        const material = await host.chooseCertificates();
        if (material) reader.setTLS(command.id, parseTLS(material));
        break;
      }
    }
    return networkState();
  }

  function request(channel: WorkspaceChannel, payload: unknown): unknown {
    if (channel !== 'project' && channel !== 'credential' && channel !== 'network' && channel !== 'designer') return handle(channel, payload);
    // A read-only projection must remain available while an update owns the mutation queue.
    if (channel === 'network' && validNetworkCommand(payload) && payload.action === 'status') return {ok: true, state: networkState()};
    // Error responses expose only known codes and bounded, structured validation feedback.
    return projects.serialize(async () => {
      try { return {ok: true, state: await handle(channel, payload)}; }
      catch (error) {
        if ((channel === 'network' || channel === 'designer') && error instanceof DraftValidationError) {
          const id = channel === 'network' ? (payload as NetworkCommand).id : (payload as DesignerCommand).systemId;
          const configuration = projects.data().systems.find(system => system.id === id)?.configuration;
          debug.record('projectFailed', id, undefined, {operation: channel === 'network' ? 'validate' : 'draft'});
          return {ok: false, error: error.message, validation: error.feedback(configuration)};
        }
        debug.record('projectFailed');
        const key = error instanceof Error ? error.message : '';
        return {ok: false, error: ['catalogLimit', 'invalidProject', 'invalidCredentials', 'credentialPromptUnavailable', 'fileConflict', 'noProject', 'chooseFile', 'protectionUnavailable', 'credentialsMissing', 'credentialsLocked', 'autoConnectSettings', 'connectionError', 'applyFirst', 'invalidTLS', 'noSystems', 'disconnected', 'noStored', 'draftSchema', 'draftTimezone', 'draftValue', 'draftCapability', 'draftPermission', 'draftSequence', 'draftLimit', 'draftStale', 'draftInitialRead', 'draftSyncRequired', 'timeout', 'protocol', 'remoteError', 'transferChanged', 'transferConflict', 'transferValidateFirst', 'transferRunning', 'transferStopUncertain', 'transferUnchanged', 'transferUncertain', 'transferBridge', 'extensionUpdatePending', 'extensionStopUncertain', 'extensionSaveUncertain', 'extensionRestartUncertain', 'extensionRestoreUncertain', 'extensionVerifyUncertain', 'runtimeChanged', 'runtimeUncertain', 'runtimeNoEnabled', 'runtimeFlagsOnly', 'runtimeFlagsChanged'].includes(key) ? key : 'failed'};
      }
    });
  }

  return {request, projects, close: () => reader.close()};
}
