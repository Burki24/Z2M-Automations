import {showConfirmation, showConfirmationChoice} from './confirmation.js';
import {RuntimeControl} from './runtime-control.js';
import {app, BrowserWindow, ipcMain, protocol, session, Menu, nativeTheme, dialog, safeStorage} from 'electron';
import {readFileSync, mkdtempSync, readdirSync, rmSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, extname} from 'node:path';
import {channels, type Channel} from './contracts.js';
import {assetPath, csp, entryURL, languageChange, rendererPreferences, trustedSender, validPayload} from './security.js';
import {Diagnostics} from './diagnostics.js';
import {OfflineWorkspace} from './offline-workspace.js';
import {configureSmokeRendering, smokeCaptureEnabled} from './smoke-rendering.js';
import {ProjectService, type ProjectCommand} from './project-service.js';
import {promptCredentials} from './credential-prompt.js';
import {Credentials, readCredentialFile, type CredentialCommand} from './credentials.js';
import {smokeProjects} from './smoke-projects.js';
import {osProtection} from './os-protection.js';
import {MqttReader, parseTLS, validNetworkCommand, type NetworkCommand} from './mqtt-reader.js';
import {AutomaticConnections} from './auto-connect.js';
import {boundedRead} from './project-files.js';
import {connect} from 'mqtt';
import {smokeNetwork} from './smoke-network.js';
import {DraftEditor, type DesignerCommand} from './draft-editor.js';
import {partnerOverview} from './partner-overview.js';
import {systemLinkPlan, readSystemLink} from './system-link.js';
import {DraftExchange} from './draft-exchange.js';
import {DraftValidationError} from './draft-feedback.js';
import {ExtensionTransfer, bundledExtension} from './extension-transfer.js';
import {smokeDrafts} from './smoke-drafts.js';

if (process.platform === 'linux') app.setDesktopName('z2m-automations.desktop');

const smoke = process.argv.includes('--smoke-test');
const smokeCaptures = smokeCaptureEnabled(process.argv);
if (smoke && !smokeCaptures) console.log('DESKTOP_CAPTURE_DISABLED');
if (configureSmokeRendering(app, {smoke, platform: process.platform, ci: process.env['CI'] === 'true'})) console.log('DESKTOP_CI_SOFTWARE_RENDERING');
const profile = smoke ? process.env['Z2MA_SMOKE_PROFILE'] || mkdtempSync(join(tmpdir(), 'z2ma-smoke-')) : null;
if (profile) app.setPath('userData', profile);
protocol.registerSchemesAsPrivileged([{scheme: 'z2ma', privileges: {standard: true, secure: true, supportFetchAPI: true, corsEnabled: true}}]);
const assetsRoot = join(__dirname, 'renderer');
const metadata: {version: string} = JSON.parse(readFileSync(join(__dirname, 'version.json'), 'utf8'));
const debug = new Diagnostics();
const workspace = new OfflineWorkspace(debug, process.platform, metadata.version);
let window: BrowserWindow | null = null;
let language: 'de' | 'en' = 'en';
let projects: ProjectService;
let reader: MqttReader;
let automaticConnections: AutomaticConnections;
let drafts: DraftEditor;
let exchange: DraftExchange;
let transfers: ExtensionTransfer;
function message(key: string): string {
  const catalog = JSON.parse(readFileSync(join(assetsRoot, 'locales', language + '.json'), 'utf8')) as Record<string, string>;
  return catalog['project.' + key] ?? key;
}
function snapshot(): unknown {
  const base = workspace.snapshot();
  if (!projects.active) return base;
  const project = projects.data();
  const system = project.systems.find(system => system.id === projects.selected);
  const remote = system ? reader.current(system.id) : null;
  const source = system ? reader.source(system.id) : 'draft';
  const configuration = source === 'stored' ? remote?.configuration ?? system?.stored?.configuration : system?.configuration;
  return {...base, desktop: {...base.desktop, project: true, projectId: project.id, epoch: projects.generation(), source, systemName: system?.name ?? '',
    draftRevision: system?.configuration.revision ?? null, projectDirty: projects.isDirty()}, module: {...base.module, name: project.name, baseTopic: system?.baseTopic ?? ''}, devices: remote?.devices ?? [], scenes: remote?.scenes ?? [],
    status: {...base.status, mqttConnected: system ? reader.connected(system.brokerId) : false, autoConnectIssue: system ? automaticConnections.setting(system.brokerId).issue : '', confirmed: remote?.fresh ?? false,
      storedRevision: remote?.status.revision ?? system?.stored?.revision ?? null,
      executing: remote?.fresh ? remote.status.executing : false, activeRevision: remote?.fresh && remote.status.executing ? remote.status.revision : null},
    catalogAvailable: Boolean(remote), configuration: configuration ?? {schema_version: 1, revision: 1, automations: [], sequences: [], mesh_peers: []},
    workspace: {fingerprint: project.id, systems: project.systems.map(system => ({name: system.name, binding: {systemId: system.id, generation: 1, baseTopic: system.baseTopic}}))},
    partnerPermissions: partnerOverview(project, reader),
    workspaceContext: {systemId: system?.id ?? '', generation: projects.generation() + 1, fingerprint: project.id},
    ...(system ? drafts.view(system) : {})};
}

function handle(channel: Channel, payload: unknown): unknown {
  if (!validPayload(channel, payload)) { debug.record('rejected'); throw new Error('Invalid desktop request.'); }
  switch (channel) {
    case 'snapshot': return snapshot();
    case 'select-system': if (typeof payload === 'string') {
      if (!projects.active) return workspace.select(payload);
      projects.select(payload); debug.record('systemSelected', payload); return {ok: true};
    } break;
    case 'language': if (languageChange(payload)) { language = payload.language; debug.record('languageChanged', undefined, payload.language); return {ok: true}; } break;
    case 'theme': if (payload === 'system' || payload === 'light' || payload === 'dark') { nativeTheme.themeSource = payload; return {ok: true}; } break;
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
  throw new Error('Invalid desktop request.');
}
async function designer(command: DesignerCommand): Promise<unknown> {
  const context = {operation: 'draft' as const, ...(typeof command.payload['requestId'] === 'string' ? {transaction: command.payload['requestId']} : {})};
  debug.record('draftRequest', command.systemId, undefined, context);
  try {
    const result = await (['import', 'export', 'adopt'].includes(command.route) ? exchange.command(command) : drafts.command(command));
    debug.record('draftCompleted', command.systemId, undefined, context); return result;
  } catch (error) { debug.record('draftRejected', command.systemId, undefined, context); throw error; }
}
let runtime: RuntimeControl;
function networkState() {
  const state = reader.state();
  const update = transfers.updateState();
  const review = transfers.reviewState();
  return {...state, sequence: state.sequence + automaticConnections.sequence + update.sequence + review.sequence,
    extensionUpdates: update.updates, draftChecks: review.checks, transferProgress: review.progress,
    brokers: state.brokers.map(broker => ({...broker, autoConnect: automaticConnections.setting(broker.id)})), bundledExtension};
}
async function network(command: NetworkCommand): Promise<unknown> {
  switch (command.action) {
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
      if (!window || smoke) break;
      const result = await dialog.showOpenDialog(window, {title: message('tlsImport'), properties: ['openFile'], filters: [{name: 'JSON', extensions: ['json']}]});
      if (!result.canceled && result.filePaths[0]) reader.setTLS(command.id, parseTLS(await boundedRead(result.filePaths[0], 196608)));
      break;
    }
  }
  return networkState();
}

async function open(): Promise<void> {
  Menu.setApplicationMenu(null);
  const assets = new Set(readdirSync(assetsRoot, {recursive: true}).filter((name): name is string => typeof name === 'string').map(name => name.replaceAll('\\', '/')));
  const mime: Record<string, string> = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json'};
  protocol.handle('z2ma', request => {
    const name = assetPath(request.url, request.method, assets);
    if (!name || !mime[extname(name)]) return new Response(null, {status: 404});
    const headers = {'Content-Type': mime[extname(name)] + '; charset=utf-8', 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store'};
    return new Response(request.method === 'HEAD' ? null : readFileSync(join(assetsRoot, name)), {headers});
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.on('will-download', event => event.preventDefault());
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({cancel: !details.url.startsWith('z2ma://app/')}));
  // Give Linux smoke a mapped rendering surface for capturePage; CI supplies Xvfb.
  window = new BrowserWindow({width: 1360, height: 900, minWidth: 360, minHeight: 500, show: !smoke || process.platform === 'linux',
    ...(process.platform === 'linux' ? {icon: join(assetsRoot, 'app-icon.png')} : {}),
    title: 'Z2M-Automations ' + (process.platform === 'win32' ? 'for Windows' : 'for Linux'),
    webPreferences: {...rendererPreferences, preload: join(__dirname, 'preload.js')}});
  const view = window.webContents;
  language = app.getLocale().startsWith('de') ? 'de' : 'en';
  const vault = new Credentials(join(app.getPath('userData'), 'credentials'), osProtection(safeStorage, process.platform), process.platform);
  const reviewDialog = (key: string, detail?: string, notice = false): Promise<boolean> => window
    ? showConfirmation(window, {language, question: message(key), ...(detail === undefined ? {} : {detail}),
      cancel: message(notice ? 'closeDialog' : 'cancel'), ...(notice ? {} : {accept: message('continue')})})
    : Promise.resolve(false);
  const confirm = (key: string): Promise<boolean> => smoke ? Promise.resolve(true) : reviewDialog(key);
  projects = new ProjectService(vault, {
    chooseOpen: async () => {
      if (smoke) return join(app.getPath('userData'), 'synthetic.z2ma');
      if (!window) return null;
      const result = await dialog.showOpenDialog(window, {title: message('open'), properties: ['openFile'], filters: [{name: 'Z2M-Automations', extensions: ['z2ma', 'bak']}]});
      return result.canceled ? null : result.filePaths[0] ?? null;
    },
    chooseSave: async () => {
      if (smoke) return join(app.getPath('userData'), 'synthetic.z2ma');
      if (!window) return null;
      const result = await dialog.showSaveDialog(window, {title: message('save'), defaultPath: 'project.z2ma', filters: [{name: 'Z2M-Automations', extensions: ['z2ma']}]});
      return result.canceled ? null : result.filePath ?? null;
    },
    confirmDiscard: () => confirm('discard'), confirmRestore: () => confirm('restoreConfirm'), confirmDelete: () => confirm('deleteConfirm'),
    chooseCredentials: async source => {
      if (smoke) {
        if (source === 'manual') return {username: 'SYNTHETIC_USER', password: 'SYNTHETIC_SECRET'};
        const path = join(app.getPath('userData'), 'synthetic-credentials.json');
        writeFileSync(path, JSON.stringify({username: 'SYNTHETIC_USER', password: 'SYNTHETIC_SECRET'}), {mode: 0o600});
        return readCredentialFile(path);
      }
      if (!window) return null;
      if (source === 'manual') return promptCredentials({title: message('enterCredentials'), username: message('username'),
        password: message('password'), ok: message('save'), cancel: message('cancel')}, window.getNativeWindowHandle(), nativeTheme.shouldUseDarkColors);
      const result = await dialog.showOpenDialog(window, {title: message('chooseCredentials'), properties: ['openFile'], filters: [{name: 'JSON', extensions: ['json']}]});
      if (result.canceled || !result.filePaths[0]) return null;
      return readCredentialFile(result.filePaths[0]);
    }
  }, debug);
  reader = new MqttReader(vault, debug, (project, epoch, system, stored, current) => projects.serialize(async () => {
    if (!current()) throw new Error('stale');
    projects.observe(project, epoch, system, stored);
    reader.reconcile(projects.data(), projects.generation());
  }), smoke ? options => {
    if (options.host !== '127.0.0.1' || options.port !== Number(process.env['Z2MA_SMOKE_MQTT_PORT'])) throw new Error('smokeNetworkDisabled');
    return connect(options);
  } : undefined);
  automaticConnections = new AutomaticConnections(join(app.getPath('userData'), 'connection-preferences'), reader, debug);
  drafts = new DraftEditor(projects, reader);
  const chooseDraft = async (key: string, extension: string, open: boolean): Promise<string | null> => {
    if (!window || smoke) return null;
    const filters = [{name: extension === 'z2ma' ? 'Z2M-Automations' : 'YAML / JSON', extensions: extension === 'z2ma' ? ['z2ma'] : ['yaml', 'yml', 'json']}];
    if (open) { const result = await dialog.showOpenDialog(window, {title: message(key), properties: ['openFile'], filters}); return result.canceled ? null : result.filePaths[0] ?? null; }
    const result = await dialog.showSaveDialog(window, {title: message(key), defaultPath: 'draft.' + extension, filters}); return result.canceled ? null : result.filePath ?? null;
  };
  transfers = new ExtensionTransfer(projects, reader, {
    backup: async (conflict, review) => {
      if (conflict && review) await reviewDialog('transferConflict',
        message('transferConflictDetail').replace(/\{\{(\w+)\}\}/g, (_, key: keyof typeof review) => String(review[key] ?? '')), true);
      return chooseDraft(conflict ? 'transferConflictBackup' : 'transferBackup', 'z2ma', false);
    },
    confirm: async (action, review) => {
      if (!window || smoke) return false;
      const detail = (action === 'store' ? message('transferStoreDetail') + '\n'
        + message(review.kind === 'flags' ? 'transferStoreFlags' : 'transferStoreConfiguration') + '\n'
        + message(review.running ? 'transferStoreStop' : 'transferStoreStopped') : message('transferInstallDetail'))
        .replace(/\{\{(\w+)\}\}/g, (_, key: keyof typeof review) => String(review[key] ?? ''));
      return reviewDialog(action === 'store' ? 'transferStoreConfirm' : 'transferInstallConfirm', detail);
    }
  });
  runtime = new RuntimeControl(projects, reader, async (action, review) => {
    if (!window || smoke) return false;
    const detail = message('runtimeTarget').replace(/\{\{(\w+)\}\}/g, (_, key: keyof typeof review) => String(review[key] ?? ''))
      + (action === 'activate' ? '\n' + message(review.recovery ? 'runtimeRecoveryOn' : 'runtimeRecoveryOff').replace('{{enabled}}', String(review.enabled)) : '');
    return reviewDialog('runtime_' + action, detail);
  });
  exchange = new DraftExchange(projects, drafts, {
    chooseImport: () => chooseDraft('importDraft', 'yaml', true),
    chooseExport: () => smoke ? Promise.resolve(join(app.getPath('userData'), 'synthetic-automations.yaml')) : chooseDraft('exportDraft', 'yaml', false),
    chooseBackup: () => chooseDraft('backupDraft', 'z2ma', false),
    confirm: async summary => {
      if (!window || smoke) return false;
      return reviewDialog('replaceDraft', message('importSummary').replace('{{oldRules}}', String(summary.oldRules))
        .replace('{{rules}}', String(summary.rules)).replace('{{sequences}}', String(summary.sequences)).replace('{{peers}}', String(summary.peers)));
    }
  });
  let closing = false;
  let closeReview = false;
  window.on('close', event => {
    if (closing || !projects.isDirty()) return;
    event.preventDefault();
    if (closeReview) return;
    closeReview = true;
    void projects.serialize(async () => {
      try {
        if (projects.isDirty() && window) {
          const pending = projects.hasPendingInput();
          const choice = await showConfirmationChoice(window, {language, question: message('closeUnsaved'),
            cancel: message('cancel'), accept: message('discardAndClose'), save: message('save'),
            ...(pending ? {saveDisabled: true, detail: message('applyFirst')} : {})});
          if (choice === false) return;
          if (choice === 'save') {
            try { await projects.command({action: 'save'}); }
            catch (error) {
              const key = error instanceof Error && ['applyFirst', 'fileConflict'].includes(error.message) ? error.message : 'failed';
              await reviewDialog(key, undefined, true);
              return;
            }
            if (projects.isDirty()) return;
          }
        }
        closing = true;
        window?.close();
      } finally { closeReview = false; }
    });
  });
  view.setWindowOpenHandler(() => ({action: 'deny'}));
  view.on('will-navigate', event => event.preventDefault());
  view.on('will-redirect', event => event.preventDefault());
  view.on('will-attach-webview', event => event.preventDefault());
  for (const channel of channels) ipcMain.handle('z2ma:' + channel, async (event, ...args: unknown[]) => {
    if (!window || !trustedSender(view.id, event.sender.id, event.senderFrame === view.mainFrame, event.senderFrame?.url ?? '') || args.length > 1) {
      debug.record('rejected'); throw new Error('Unauthorized desktop request.');
    }
    if (channel !== 'project' && channel !== 'credential' && channel !== 'network' && channel !== 'designer') return handle(channel, args[0]);
    // A read-only projection must remain available while an update owns the mutation queue.
    if (channel === 'network' && validNetworkCommand(args[0]) && args[0].action === 'status') return {ok: true, state: networkState()};
    // Error responses expose only known codes and bounded, structured validation feedback.
    return projects.serialize(async () => {
      try { return {ok: true, state: await handle(channel, args[0])}; }
      catch (error) {
        if ((channel === 'network' || channel === 'designer') && error instanceof DraftValidationError) {
          const id = channel === 'network' ? (args[0] as NetworkCommand).id : (args[0] as DesignerCommand).systemId;
          const configuration = projects.data().systems.find(system => system.id === id)?.configuration;
          debug.record('projectFailed', id, undefined, {operation: channel === 'network' ? 'validate' : 'draft'});
          return {ok: false, error: error.message, validation: error.feedback(configuration)};
        }
        debug.record('projectFailed');
        const key = error instanceof Error ? error.message : '';
        return {ok: false, error: ['invalidProject', 'invalidCredentials', 'credentialPromptUnavailable', 'fileConflict', 'noProject', 'chooseFile', 'protectionUnavailable', 'credentialsMissing', 'credentialsLocked', 'autoConnectSettings', 'connectionError', 'applyFirst', 'invalidTLS', 'noSystems', 'disconnected', 'noStored', 'draftSchema', 'draftTimezone', 'draftValue', 'draftCapability', 'draftPermission', 'draftSequence', 'draftLimit', 'draftStale', 'timeout', 'protocol', 'remoteError', 'transferChanged', 'transferConflict', 'transferValidateFirst', 'transferRunning', 'transferStopUncertain', 'transferUnchanged', 'transferUncertain', 'transferBridge', 'extensionUpdatePending', 'extensionStopUncertain', 'extensionSaveUncertain', 'extensionRestartUncertain', 'extensionRestoreUncertain', 'extensionVerifyUncertain', 'runtimeChanged', 'runtimeUncertain', 'runtimeNoEnabled', 'runtimeFlagsOnly'].includes(key) ? key : 'failed'};
      }
    });
  });
  await window.loadURL(entryURL);
  debug.record('ready');
  if (smoke) {
    for (const action of ['escape', 'close', 'accept', 'save']) {
      const response = showConfirmationChoice(window, {language: 'en', question: 'Synthetic confirmation', detail: '<b>Synthetic detail</b>',
        cancel: 'Cancel', accept: 'Continue', ...(action === 'save' ? {save: 'Save'} : {})});
      const child = window.getChildWindows()[0];
      if (!child) throw new Error('Confirmation is not attached to the application');
      if (child.webContents.isLoadingMainFrame()) await new Promise<void>(resolve => child.webContents.once('did-finish-load', () => resolve()));
      const verified = await child.webContents.executeJavaScript(`(async () => {
        for (let i = 0; i < 100 && !document.querySelector('#question').textContent; i++) await new Promise(resolve => setTimeout(resolve, 20));
        if (window.z2maDesktop || document.activeElement.id !== 'cancel' || document.querySelector('#detail b')
          || document.querySelector('#detail').textContent !== '<b>Synthetic detail</b>') return false;
        return true;
      })()`);
      if (!verified) throw new Error('Confirmation view did not initialize: ' + action);
      if (action === 'close') child.close();
      else {
        const interaction = action === 'escape'
          ? "document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))"
          : action === 'save' ? "document.querySelector('#save').click()" : "document.querySelector('#accept').click()";
        // The interaction resolves the dialog and may destroy the frame before
        // Electron acknowledges the evaluation. The dialog result is authoritative.
        void child.webContents.executeJavaScript(interaction).catch(() => {});
      }
      if (await response !== (action === 'save' ? 'save' : action === 'accept')) throw new Error('Confirmation interaction failed: ' + action);
    }
    console.log('DESKTOP_CONFIRMATION_OK cancel-focus/escape/close/confirm');
    // Fixed, offline assertions only; no evaluation or control endpoint is exposed.
    const result: unknown = await view.executeJavaScript(`(async () => {
      const wait = async test => { for (let n = 0; n < 100; n++) { if (test()) return; await new Promise(r => setTimeout(r, 50)); } throw new Error('View timeout: ' + document.body.textContent.slice(-500)); };
      await wait(() => document.querySelector('#designer-system')?.options.length === 2);
      const bridge = window.z2maDesktop;
      const header = document.querySelector('.app-header');
      await wait(() => header.querySelector('.brand-mark img')?.naturalWidth > 0);
      if (!document.querySelector('#desktop-view-draft #draft-export') || document.querySelector('#edit-export')) {
        throw new Error('Desktop YAML export belongs only in the starting point step.');
      }
      if (!header.querySelector('#designer-language') || document.querySelectorAll('[data-language-picker]').length !== 1) {
        throw new Error('The desktop header must be the sole language picker.');
      }
      const navigation = document.querySelector('.desktop-steps');
      const stepTargets = [...(navigation?.querySelectorAll('ol button') ?? [])].map(button => button.getAttribute('aria-controls'));
      if (stepTargets.join(',') !== ['project', 'broker', 'system', 'connection', 'draft', 'automations', 'review', 'transfer'].map(key => 'desktop-view-' + key).join(',')) {
        throw new Error('The desktop workspace must present eight ordered steps');
      }
      const visibleViews = [...document.querySelectorAll('.desktop-view:not([hidden])')].map(view => view.id);
      if (visibleViews.join(',') !== 'desktop-view-project' || !document.querySelector('#desktop-view-transfer #mqtt-store')) {
        throw new Error('A fresh workspace must start at the project and keep transfer in its own step');
      }
      if (!(header.compareDocumentPosition(document.querySelector('#local-project')) & Node.DOCUMENT_POSITION_FOLLOWING)) throw new Error('Desktop header is below project controls');
      const theme = document.querySelector('#desktop-theme');
      for (const value of ['dark', 'light', 'system']) {
        theme.value = value;
        theme.dispatchEvent(new Event('change', {bubbles: true}));
        await wait(() => localStorage.getItem('z2ma.desktop.theme') === value);
        if (value !== 'system') await wait(() => matchMedia('(prefers-color-scheme: ' + value + ')').matches);
      }
      if (typeof require !== 'undefined' || typeof process !== 'undefined') throw new Error('Node exposed');
      if (Object.keys(bridge).sort().join(',') !== 'credential,designer,diagnostics,language,network,project,recording,selectSystem,snapshot,theme') throw new Error('Unexpected bridge');
      const first = await bridge.snapshot();
      const before = JSON.stringify(first.configuration);
      await bridge.recording('start');
      const until = (await bridge.diagnostics()).end;
      document.querySelector('#search').value = 'KEEP_INPUT';
      document.querySelector('#search').dispatchEvent(new Event('input', {bubbles: true}));
      const picker = document.querySelector('#designer-language');
      picker.value = 'en'; picker.dispatchEvent(new Event('change', {bubbles: true}));
      await wait(() => document.documentElement.lang === 'en');
      picker.value = 'de'; picker.dispatchEvent(new Event('change', {bubbles: true}));
      await wait(() => document.documentElement.lang === 'de');
      if (document.querySelector('#search').value !== 'KEEP_INPUT') throw new Error('Input lost');
      const systems = document.querySelector('#designer-system');
      systems.value = 'example-b'; systems.dispatchEvent(new Event('change', {bubbles: true}));
      await wait(() => document.querySelector('#entry-title').textContent === 'Office light on button');
      systems.value = 'example-a'; systems.dispatchEvent(new Event('change', {bubbles: true}));
      await wait(() => document.querySelector('#search').value === 'KEEP_INPUT');
      const after = await bridge.snapshot();
      if (before !== JSON.stringify(after.configuration)) throw new Error('Example changed');
      const diagnostics = await bridge.diagnostics();
      if (diagnostics.end !== until || !diagnostics.events.some(e => e.code === 'systemSelected')) throw new Error('Debug missing');
      await bridge.recording('stop');
      if ((await bridge.diagnostics()).active) throw new Error('Recording not stopped');
      const openRecording = document.querySelector('#desktop-open-recording');
      const recordingEvents = document.querySelector('#desktop-recording-events');
      openRecording.closest('details').open = true;
      await wait(() => !openRecording.disabled);
      if (!recordingEvents.hidden) throw new Error('Recording expanded by default');
      openRecording.click();
      if (recordingEvents.hidden || !recordingEvents.children.length || openRecording.getAttribute('aria-expanded') !== 'true') throw new Error('Recording did not open');
      openRecording.click();
      if (!recordingEvents.hidden || (await bridge.diagnostics()).active) throw new Error('Closing the recording changed its state');
      openRecording.closest('details').open = false;
      let rejected = false; try { await bridge.selectSystem('untrusted'); } catch { rejected = true; }
      if (!rejected) throw new Error('Invalid system accepted');
      const hidden = [...document.querySelectorAll('.designer-menu,.designer-controls,#new-automation-button')].every(e => getComputedStyle(e).display === 'none' || e.hidden);
      if (!hidden) throw new Error('Unsupported controls visible');
      return {systems: 2, languages: ['en','de'], preserved: true, isolated: true, debug: true};
    })()`);
    console.log('DESKTOP_SMOKE_OK ' + JSON.stringify(result));
    await smokeProjects(view);
    await smokeNetwork(view, Number(process.env['Z2MA_SMOKE_MQTT_PORT']));
    await smokeDrafts(view, join(app.getPath('userData'), 'synthetic-automations.yaml'), smokeCaptures);
    for (const width of [360, 1024, 1920, 3840]) {
      window.setContentSize(width, 900);
      for (const theme of ['light', 'dark'] as const) {
        nativeTheme.themeSource = theme;
        await new Promise(resolve => setTimeout(resolve, 150));
        const issue: string = await view.executeJavaScript(`(() => {
          const nav = document.querySelector('.desktop-steps');
          const picker = document.querySelector('#desktop-step');
          const compact = innerWidth <= 900;
          if (compact !== Boolean(picker.getClientRects().length)) return 'compact picker visibility';
          function select(key) {
            if (compact) { picker.value = key; picker.dispatchEvent(new Event('change')); }
            else nav.querySelector('#desktop-nav-' + key).click();
          }
          for (const {value: key} of picker.options) {
            select(key);
            const pane = document.querySelector('#desktop-view-' + key);
            if (pane.hidden || picker.value !== key) return key + ' did not open';
            if (document.documentElement.scrollWidth > innerWidth + 1) return key + ' overflow';
            if (!compact && nav.getBoundingClientRect().right > pane.getBoundingClientRect().left + 1) return key + ' overlaps the sidebar';
          }
          select('automations');
          return '';
        })()`);
        if (issue) throw new Error('Desktop layout at ' + width + '/' + theme + ': ' + issue);
        console.log('DESKTOP_VIEWPORT_OK ' + width + '/' + theme);
      }
    }
    if (!app.isPackaged && smokeCaptures) {
      window.setContentSize(1360, 900);
      await view.executeJavaScript("document.querySelector('#search').value = ''; document.querySelector('#search').dispatchEvent(new Event('input', {bubbles: true}));");
      await new Promise(resolve => setTimeout(resolve, 150));
      mkdirSync(join(__dirname, '../out'), {recursive: true});
      console.log('DESKTOP_CAPTURE_START');
      const image = await window.capturePage();
      if (image.isEmpty()) throw new Error('Desktop capture is empty.');
      writeFileSync(join(__dirname, '../out/smoke.png'), image.toPNG());
      console.log('DESKTOP_CAPTURE_OK');
    }
    console.log('DESKTOP_LAYOUT_OK 360/1024/1920/3840 light/dark');
    await projects.serialize(async () => {
      if (projects.hasPendingInput() || !projects.isDirty()) throw new Error('Close smoke requires an applied unsaved draft');
      await projects.command({action: 'rename', name: 'Saved from the close dialog'});
    });
    if (!profile || readFileSync(join(profile, 'synthetic.z2ma'), 'utf8').includes('Saved from the close dialog')) {
      throw new Error('Close smoke project was already saved');
    }
    window.close();
    for (let i = 0; i < 100 && !window.getChildWindows().length; i++) await new Promise(resolve => setTimeout(resolve, 20));
    const dialog = window.getChildWindows()[0];
    if (!dialog) throw new Error('Closing the dirty project did not open a dialog');
    if (dialog.webContents.isLoadingMainFrame()) await new Promise<void>(resolve => dialog.webContents.once('did-finish-load', () => resolve()));
    const ready = await dialog.webContents.executeJavaScript(`(async () => {
      const save = document.querySelector('#save');
      for (let i = 0; i < 100 && !save.textContent; i++) await new Promise(resolve => setTimeout(resolve, 20));
      return Boolean(save.textContent) && !save.hidden && !save.disabled;
    })()`);
    if (!ready) throw new Error('Save was unavailable in the close dialog');
    // The external smoke runner verifies the resulting file after the process exits.
    void dialog.webContents.executeJavaScript("document.querySelector('#save').click()").catch(() => {});
  }
}

if (!smoke && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { window?.show(); window?.focus(); });
  app.whenReady().then(open).catch(error => {
    console.error('Desktop startup failed: ' + (smoke && error instanceof Error ? error.message : 'The local interface could not start.'));
    app.exit(1);
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => reader?.close());
  app.on('will-quit', () => { if (profile && !process.env['Z2MA_SMOKE_PROFILE']) { try { rmSync(profile, {recursive: true, force: true}); } catch { /* OS locks may outlive shutdown. */ } } });
}
