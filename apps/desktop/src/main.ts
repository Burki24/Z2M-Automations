import {RuntimeControl} from './runtime-control.js';
import {app, BrowserWindow, ipcMain, protocol, session, Menu, nativeTheme, dialog, safeStorage} from 'electron';
import {readFileSync, mkdtempSync, readdirSync, rmSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, extname} from 'node:path';
import {channels, type Channel} from './contracts.js';
import {assetPath, csp, entryURL, languageChange, rendererPreferences, trustedSender, validPayload} from './security.js';
import {Diagnostics} from './diagnostics.js';
import {OfflineWorkspace} from './offline-workspace.js';
import {configureSmokeRendering} from './smoke-rendering.js';
import {ProjectService, type ProjectCommand} from './project-service.js';
import {promptCredentials} from './credential-prompt.js';
import {Credentials, readCredentialFile, type CredentialCommand} from './credentials.js';
import {smokeProjects} from './smoke-projects.js';
import {osProtection} from './os-protection.js';
import {MqttReader, parseTLS, type NetworkCommand} from './mqtt-reader.js';
import {boundedRead} from './project-files.js';
import {connect} from 'mqtt';
import {smokeNetwork} from './smoke-network.js';
import {DraftEditor, type DesignerCommand} from './draft-editor.js';
import {DraftExchange} from './draft-exchange.js';
import {ExtensionTransfer, bundledExtension} from './extension-transfer.js';
import {smokeDrafts} from './smoke-drafts.js';

const smoke = process.argv.includes('--smoke-test');
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
  return {...base, desktop: {...base.desktop, project: true, projectId: project.id, epoch: projects.generation(), source, systemName: system?.name ?? ''}, module: {...base.module, name: project.name, baseTopic: system?.baseTopic ?? ''}, devices: remote?.devices ?? [], scenes: remote?.scenes ?? [],
    status: {...base.status, mqttConnected: system ? reader.connected(system.brokerId) : false, confirmed: remote?.fresh ?? false,
      executing: remote?.fresh ? remote.status.executing : false, activeRevision: remote?.fresh && remote.status.executing ? remote.status.revision : null},
    catalogAvailable: Boolean(remote), configuration: configuration ?? {schema_version: 1, revision: 1, automations: [], sequences: [], mesh_peers: []},
    workspace: {fingerprint: project.id, systems: project.systems.map(system => ({name: system.name, binding: {systemId: system.id, generation: 1, baseTopic: system.baseTopic}}))},
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
    case 'diagnostics': return debug.read();
    case 'recording': if (payload === 'start' || payload === 'stop') return debug.control(payload); break;
    case 'project': return projects.command(payload as ProjectCommand).then(state => { reader.reconcile(projects.active ? projects.data() : null, projects.generation()); return state; });
    case 'credential': return projects.credential(payload as CredentialCommand).then(state => { reader.disconnect((payload as CredentialCommand).brokerId); return state; });
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
async function network(command: NetworkCommand): Promise<unknown> {
  switch (command.action) {
    case 'activate': case 'deactivate': case 'run_once': case 'stop_rule': {
      if (smoke) throw new Error('invalidRequest');
      try {
        const outcome = await runtime.command(command.action, command);
        return {...(reader.state() as object), bundledExtension, outcome};
      } finally { void reader.refresh(command.id).catch(() => {}); }
    }
    case 'runtimeStatus': void reader.refresh(command.id).catch(() => {}); break;
    case 'validateEnabled': case 'validate': case 'store': case 'install': case 'checkTransfer': {
      if (smoke) throw new Error('invalidRequest');
      try {
        const outcome = await transfers.command(command.action, command.id);
        return {...(reader.state() as object), bundledExtension, outcome};
      } finally {
        if (command.action !== 'validate' && command.action !== 'validateEnabled') void reader.refresh(command.id).catch(() => {});
      }
    }
    case 'status': break;
    case 'connect': await reader.connectBroker(command.id); break;
    case 'disconnect': reader.disconnect(command.id); break;
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
  return {...(reader.state() as object), bundledExtension};
}

async function open(): Promise<void> {
  Menu.setApplicationMenu(null);
  const assets = new Set(readdirSync(assetsRoot, {recursive: true}).filter((name): name is string => typeof name === 'string').map(name => name.replaceAll('\\', '/')));
  const mime: Record<string, string> = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json'};
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
    title: 'Z2M-Automations ' + (process.platform === 'win32' ? 'for Windows' : 'for Linux'),
    webPreferences: {...rendererPreferences, preload: join(__dirname, 'preload.js')}});
  const view = window.webContents;
  language = app.getLocale().startsWith('de') ? 'de' : 'en';
  const vault = new Credentials(join(app.getPath('userData'), 'credentials'), osProtection(safeStorage, process.platform), process.platform);
  const confirm = async (key: string): Promise<boolean> => {
    if (smoke) return true;
    if (!window) return false;
    const result = await dialog.showMessageBox(window, {type: 'warning', message: message(key), buttons: [message('cancel'), message('continue')], defaultId: 0, cancelId: 0, noLink: true});
    return result.response === 1;
  };
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
        password: message('password'), ok: message('save'), cancel: message('cancel')}, window.getNativeWindowHandle());
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
  drafts = new DraftEditor(projects, reader);
  const chooseDraft = async (key: string, extension: string, open: boolean): Promise<string | null> => {
    if (!window || smoke) return null;
    const filters = [{name: extension === 'z2ma' ? 'Z2M-Automations' : 'YAML / JSON', extensions: extension === 'z2ma' ? ['z2ma'] : ['yaml', 'yml', 'json']}];
    if (open) { const result = await dialog.showOpenDialog(window, {title: message(key), properties: ['openFile'], filters}); return result.canceled ? null : result.filePaths[0] ?? null; }
    const result = await dialog.showSaveDialog(window, {title: message(key), defaultPath: 'draft.' + extension, filters}); return result.canceled ? null : result.filePath ?? null;
  };
  transfers = new ExtensionTransfer(projects, reader, {
    backup: async (conflict, review) => {
      if (conflict && review && window) await dialog.showMessageBox(window, {type: 'warning', message: message('transferConflict'),
        detail: message('transferConflictDetail').replace(/\{\{(\w+)\}\}/g, (_, key: keyof typeof review) => String(review[key] ?? ''))});
      return chooseDraft(conflict ? 'transferConflictBackup' : 'transferBackup', 'z2ma', false);
    },
    confirm: async (action, review) => {
      if (!window || smoke) return false;
      const detail = message(action === 'store' ? 'transferStoreDetail' : 'transferInstallDetail')
        .replace(/\{\{(\w+)\}\}/g, (_, key: keyof typeof review) => String(review[key] ?? ''));
      const result = await dialog.showMessageBox(window, {type: 'warning', message: message(action === 'store' ? 'transferStoreConfirm' : 'transferInstallConfirm'), detail,
        buttons: [message('cancel'), message('continue')], defaultId: 0, cancelId: 0, noLink: true});
      return result.response === 1;
    }
  });
  runtime = new RuntimeControl(projects, reader, async (action, review) => {
    if (!window || smoke) return false;
    const detail = message('runtimeTarget').replace(/\{\{(\w+)\}\}/g, (_, key: keyof typeof review) => String(review[key] ?? ''))
      + (action === 'activate' ? '\n' + message(review.recovery ? 'runtimeRecoveryOn' : 'runtimeRecoveryOff').replace('{{enabled}}', String(review.enabled)) : '');
    const result = await dialog.showMessageBox(window, {type: 'warning', message: message('runtime_' + action), detail,
      buttons: [message('cancel'), message('continue')], defaultId: 0, cancelId: 0, noLink: true});
    return result.response === 1;
  });
  exchange = new DraftExchange(projects, drafts, {
    chooseImport: () => chooseDraft('importDraft', 'yaml', true), chooseExport: () => chooseDraft('exportDraft', 'yaml', false),
    chooseBackup: () => chooseDraft('backupDraft', 'z2ma', false),
    confirm: async summary => {
      if (!window || smoke) return false;
      const result = await dialog.showMessageBox(window, {type: 'warning', message: message('replaceDraft'),
        detail: message('importSummary').replace('{{oldRules}}', String(summary.oldRules)).replace('{{rules}}', String(summary.rules))
          .replace('{{sequences}}', String(summary.sequences)).replace('{{peers}}', String(summary.peers)),
        buttons: [message('cancel'), message('continue')], defaultId: 0, cancelId: 0, noLink: true}); return result.response === 1;
    }
  });
  let closing = false;
  window.on('close', event => {
    if (closing || !projects.isDirty()) return;
    event.preventDefault();
    void projects.serialize(async () => { if (await confirm('discard')) { closing = true; window?.close(); } });
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
    // No paths, file contents, secrets or raw exception messages leave these operations.
    return projects.serialize(async () => {
      try { return {ok: true, state: await handle(channel, args[0])}; }
      catch (error) {
        debug.record('projectFailed');
        const key = error instanceof Error ? error.message : '';
        return {ok: false, error: ['invalidProject', 'invalidCredentials', 'credentialPromptUnavailable', 'fileConflict', 'noProject', 'chooseFile', 'protectionUnavailable', 'applyFirst', 'invalidTLS', 'noSystems', 'disconnected', 'noStored', 'draftSchema', 'draftTimezone', 'draftValue', 'draftCapability', 'draftPermission', 'draftSequence', 'draftLimit', 'draftStale', 'timeout', 'protocol', 'remoteError', 'transferChanged', 'transferConflict', 'transferValidateFirst', 'transferRunning', 'transferUncertain', 'transferBridge', 'runtimeChanged', 'runtimeUncertain', 'runtimeNoEnabled', 'runtimeFlagsOnly'].includes(key) ? key : 'failed'};
      }
    });
  });
  await window.loadURL(entryURL);
  debug.record('ready');
  if (smoke) {
    // Fixed, offline assertions only; no evaluation or control endpoint is exposed.
    const result: unknown = await view.executeJavaScript(`(async () => {
      const wait = async test => { for (let n = 0; n < 100; n++) { if (test()) return; await new Promise(r => setTimeout(r, 50)); } throw new Error('View timeout: ' + document.body.textContent.slice(-500)); };
      await wait(() => document.querySelector('#designer-system')?.options.length === 2);
      const bridge = window.z2maDesktop;
      if (typeof require !== 'undefined' || typeof process !== 'undefined') throw new Error('Node exposed');
      if (Object.keys(bridge).sort().join(',') !== 'credential,designer,diagnostics,language,network,project,recording,selectSystem,snapshot') throw new Error('Unexpected bridge');
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
    await smokeDrafts(view);
    for (const width of [360, 1920, 3840]) {
      window.setContentSize(width, 900);
      for (const theme of ['light', 'dark'] as const) {
        nativeTheme.themeSource = theme;
        await new Promise(resolve => setTimeout(resolve, 150));
        const fits: boolean = await view.executeJavaScript('document.documentElement.scrollWidth <= innerWidth + 1');
        if (!fits) throw new Error('Desktop layout overflow: ' + width + '/' + theme);
        console.log('DESKTOP_VIEWPORT_OK ' + width + '/' + theme);
      }
    }
    if (!app.isPackaged) {
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
    console.log('DESKTOP_LAYOUT_OK 360/1920/3840 light/dark');
    app.exit(0);
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
  app.on('will-quit', () => { if (profile) { try { rmSync(profile, {recursive: true, force: true}); } catch { /* OS locks may outlive shutdown. */ } } });
}
