import {showConfirmation, showConfirmationChoice, showTransferConfirmation} from './confirmation.js';
import {app, BrowserWindow, ipcMain, protocol, session, Menu, nativeTheme, dialog, safeStorage} from 'electron';
import {readFileSync, mkdtempSync, readdirSync, rmSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, extname} from 'node:path';
import {channels} from './contracts.js';
import {assetPath, csp, entryURL, rendererPreferences, trustedSender, validPayload} from './security.js';
import {Diagnostics} from './diagnostics.js';
import {configureSmokeRendering, smokeCaptureEnabled} from './smoke-rendering.js';
import type {ProjectDialogs} from './project-service.js';
import {createWorkspaceApplication} from './workspace-application.js';
import {promptCredentials} from './credential-prompt.js';
import {Credentials, readCredentialFile} from './credentials.js';
import {smokeProjects} from './smoke-projects.js';
import {osProtection} from './os-protection.js';
import {boundedRead} from './project-files.js';
import {connect} from 'mqtt';
import {smokeNetwork} from './smoke-network.js';
import {smokeDrafts} from './smoke-drafts.js';
import {smokeHelp} from './smoke-help.js';
import {helpURL, allowedHelpNavigation, type HelpRequest} from './help.js';

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
let window: BrowserWindow | null = null;
let manual: BrowserWindow | null = null;
let language: 'de' | 'en' = 'en';
let application: ReturnType<typeof createWorkspaceApplication>;
function message(key: string): string {
  const catalog = JSON.parse(readFileSync(join(assetsRoot, 'locales', language + '.json'), 'utf8')) as Record<string, string>;
  return catalog['project.' + key] ?? key;
}
function nativeRequest(channel: 'theme' | 'help', payload: unknown): unknown {
  if (!validPayload(channel, payload)) { debug.record('rejected'); throw new Error('Invalid desktop request.'); }
  switch (channel) {
    case 'help': {
      const request = payload as HelpRequest;
      if (!window) throw new Error('Help unavailable.');
      if (!manual || manual.isDestroyed()) {
        manual = new BrowserWindow({parent: window, width: 1120, height: 850, minWidth: 360, minHeight: 400,
          show: !smoke, autoHideMenuBar: true, webPreferences: {...rendererPreferences}});
        manual.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
        manual.webContents.on('will-navigate', (event, url) => { if (!allowedHelpNavigation(url)) event.preventDefault(); });
        manual.webContents.on('will-redirect', event => event.preventDefault());
        manual.webContents.on('will-attach-webview', event => event.preventDefault());
        manual.on('closed', () => { manual = null; });
      }
      const viewer = manual;
      return viewer.loadURL(helpURL(request)).then(() => {
        if (!smoke && !viewer.isDestroyed()) { viewer.show(); viewer.focus(); }
        debug.record('helpOpened', undefined, request.language);
        return {ok: true};
      });
    }
    case 'theme': if (payload === 'system' || payload === 'light' || payload === 'dark') { nativeTheme.themeSource = payload; return {ok: true}; } break;
  }
  throw new Error('Invalid desktop request.');
}

async function open(): Promise<void> {
  Menu.setApplicationMenu(null);
  const assets = new Set(readdirSync(assetsRoot, {recursive: true}).filter((name): name is string => typeof name === 'string').map(name => name.replaceAll('\\', '/')));
  const mime: Record<string, string> = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json'};
  protocol.handle('z2ma', request => {
    // Electron retains fragments for custom-scheme requests; only handbook navigation permits them.
    const resource = allowedHelpNavigation(request.url) ? request.url.replace(/#.*$/, '') : request.url;
    const name = assetPath(resource, request.method, assets);
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
  window.once('closed', () => { manual?.destroy(); });
  language = app.getLocale().startsWith('de') ? 'de' : 'en';
  const vault = new Credentials(join(app.getPath('userData'), 'credentials'), osProtection(safeStorage, process.platform), process.platform);
  const reviewDialog = (key: string, detail?: string, notice = false): Promise<boolean> => window
    ? showConfirmation(window, {language, question: message(key), ...(detail === undefined ? {} : {detail}),
      cancel: message(notice ? 'closeDialog' : 'cancel'), ...(notice ? {} : {accept: message('continue')})})
    : Promise.resolve(false);
  const confirm = (key: string): Promise<boolean> => smoke ? Promise.resolve(true) : reviewDialog(key);
  const projectDialogs: ProjectDialogs = {
    chooseOpen: async () => {
      if (smoke) return join(app.getPath('userData'), 'synthetic.z2ma');
      if (!window) return null;
      const result = await dialog.showOpenDialog(window, {title: message('open'), properties: ['openFile'], filters: [{name: message('projectFile'), extensions: ['z2map', 'z2ma', 'bak']}]});
      return result.canceled ? null : result.filePaths[0] ?? null;
    },
    chooseSave: async () => {
      if (smoke) return join(app.getPath('userData'), 'synthetic.z2ma');
      if (!window) return null;
      const result = await dialog.showSaveDialog(window, {title: message('save'), defaultPath: 'project.z2map', filters: [{name: message('projectFile'), extensions: ['z2map']}]});
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
  };
  const chooseDraft = async (key: string, extension: string, open: boolean): Promise<string | null> => {
    if (smoke && key === 'exportDraft' && extension === 'yaml' && !open) return join(app.getPath('userData'), 'synthetic-automations.yaml');
    if (!window || smoke) return null;
    const filters = [{name: extension === 'yaml' ? message('draftFile') : 'Z2M-Automations', extensions: open ? ['z2mad', 'z2map', 'z2ma', 'yaml', 'yml', 'json'] : extension === 'yaml' ? ['yaml', 'yml', 'json'] : [extension]}];
    if (open) { const result = await dialog.showOpenDialog(window, {title: message(key), properties: ['openFile'], filters}); return result.canceled ? null : result.filePaths[0] ?? null; }
    const result = await dialog.showSaveDialog(window, {title: message(key), defaultPath: 'draft.' + extension, filters}); return result.canceled ? null : result.filePath ?? null;
  };
  application = createWorkspaceApplication({
    platform: process.platform, version: metadata.version, data: app.getPath('userData'), diagnostics: debug, vault, projectDialogs,
    translate: message, setLanguage: value => { language = value; }, chooseDraft, review: reviewDialog,
    confirmTransfer: prompt => window ? showTransferConfirmation(window, {language, ...prompt}) : Promise.resolve({accepted: false, resume: false}),
    chooseCertificates: async () => {
      if (!window) return null;
      const result = await dialog.showOpenDialog(window, {title: message('tlsImport'), properties: ['openFile'], filters: [{name: 'JSON', extensions: ['json']}]});
      return !result.canceled && result.filePaths[0] ? boundedRead(result.filePaths[0], 196608) : null;
    },
    ...(smoke ? {smoke, mqttFactory: options => {
      if (options.host !== '127.0.0.1' || options.port !== Number(process.env['Z2MA_SMOKE_MQTT_PORT'])) throw new Error('smokeNetworkDisabled');
      return connect(options);
    }} : {}),
  });
  const {projects} = application;
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
    return channel === 'theme' || channel === 'help' ? nativeRequest(channel, args[0]) : application.request(channel, args[0]);
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
      if (Object.keys(bridge).sort().join(',') !== 'credential,designer,diagnostics,help,language,network,project,recording,selectSystem,snapshot,theme') throw new Error('Unexpected bridge');
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
    await smokeHelp(view, () => manual);
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
  app.on('before-quit', () => application?.close());
  app.on('will-quit', () => { if (profile && !process.env['Z2MA_SMOKE_PROFILE']) { try { rmSync(profile, {recursive: true, force: true}); } catch { /* OS locks may outlive shutdown. */ } } });
}
