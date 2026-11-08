import {app, BrowserWindow, ipcMain, protocol, session, Menu, nativeTheme} from 'electron';
import {readFileSync, mkdtempSync, readdirSync, rmSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, extname} from 'node:path';
import {channels, type Channel} from './contracts.js';
import {assetPath, csp, entryURL, languageChange, rendererPreferences, trustedSender, validPayload} from './security.js';
import {Diagnostics} from './diagnostics.js';
import {OfflineWorkspace} from './offline-workspace.js';
import {configureSmokeRendering} from './smoke-rendering.js';

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

function handle(channel: Channel, payload: unknown): unknown {
  if (!validPayload(channel, payload)) { debug.record('rejected'); throw new Error('Invalid desktop request.'); }
  switch (channel) {
    case 'snapshot': return workspace.snapshot();
    case 'select-system': if (typeof payload === 'string') return workspace.select(payload); break;
    case 'language': if (languageChange(payload)) { debug.record('languageChanged', undefined, payload.language); return {ok: true}; } break;
    case 'diagnostics': return debug.read();
    case 'recording': if (payload === 'start' || payload === 'stop') return debug.control(payload); break;
  }
  throw new Error('Invalid desktop request.');
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
  view.setWindowOpenHandler(() => ({action: 'deny'}));
  view.on('will-navigate', event => event.preventDefault());
  view.on('will-redirect', event => event.preventDefault());
  view.on('will-attach-webview', event => event.preventDefault());
  for (const channel of channels) ipcMain.handle('z2ma:' + channel, (event, ...args: unknown[]) => {
    if (!window || !trustedSender(view.id, event.sender.id, event.senderFrame === view.mainFrame, event.senderFrame?.url ?? '') || args.length > 1) {
      debug.record('rejected'); throw new Error('Unauthorized desktop request.');
    }
    return handle(channel, args[0]);
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
      if (Object.keys(bridge).sort().join(',') !== 'diagnostics,language,recording,selectSystem,snapshot') throw new Error('Unexpected bridge');
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
      let rejected = false; try { await bridge.selectSystem('untrusted'); } catch { rejected = true; }
      if (!rejected) throw new Error('Invalid system accepted');
      const hidden = [...document.querySelectorAll('.designer-menu,.designer-controls,#new-automation-button')].every(e => getComputedStyle(e).display === 'none' || e.hidden);
      if (!hidden) throw new Error('Unsupported controls visible');
      return {systems: 2, languages: ['en','de'], preserved: true, isolated: true, debug: true};
    })()`);
    console.log('DESKTOP_SMOKE_OK ' + JSON.stringify(result));
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
  app.on('will-quit', () => { if (profile) { try { rmSync(profile, {recursive: true, force: true}); } catch { /* OS locks may outlive shutdown. */ } } });
}
