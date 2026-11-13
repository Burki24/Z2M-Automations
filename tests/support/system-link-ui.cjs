const {app, BrowserWindow, ipcMain, protocol, nativeTheme} = require('electron');
const {join, extname} = require('node:path');
const {readFileSync} = require('node:fs');
const {randomUUID} = require('node:crypto');
const root = process.env.Z2MA_LINK_TEST_ROOT;
const {newProject, emptyConfiguration} = require(join(root, 'apps/desktop/.build/project.js'));
const {systemLinkPlan, readSystemLink} = require(join(root, 'apps/desktop/.build/system-link.js'));
const {validPayload, assetPath, csp, rendererPreferences} = require(join(root, 'apps/desktop/.build/security.js'));

protocol.registerSchemesAsPrivileged([{scheme: 'z2ma', privileges: {standard: true, secure: true, supportFetchAPI: true}}]);
app.setPath('userData', process.env.Z2MA_LINK_TEST_PROFILE);
app.on('window-all-closed', () => {});
if (process.platform === 'linux' && process.env.CI === 'true') app.disableHardwareAcceleration();
const project = newProject('Synthetic link test');
project.brokers = ['a', 'b'].map(name => ({id: randomUUID(), name: 'Synthetic broker ' + name, host: name + '.invalid', port: 1883, tls: false}));
project.systems = ['Zulu <img src=x>', 'Alpha', 'Room 10', 'Room 2', 'Delta', 'Echo', 'Foxtrot', 'Golf'].map((name, index) => ({
  id: randomUUID(), name, brokerId: project.brokers[index % 2].id, baseTopic: 'synthetic/' + (index + 1), baseline: null,
  configuration: {...emptyConfiguration(), mesh_peers: ['synthetic/' + (index === 0 ? 2 : 1)]}
}));
const remotes = new Map(); const reading = new Set();
let online = true; let fail = false; let epoch = 1; let requests = [];
const reader = {connected: () => online, current: id => remotes.get(id) ?? null,
  state: () => ({brokers: project.brokers.map(broker => ({id: broker.id, state: online ? 'connected' : 'disconnected', error: ''})),
    systems: project.systems.map(system => ({id: system.id, reading: reading.has(system.id), error: ''}))}),
  refresh: async id => {
    reading.add(id);
    await new Promise(resolve => setTimeout(resolve, 60));
    const system = project.systems.find(system => system.id === id);
    remotes.set(id, {fresh: online, configuration: structuredClone(system.configuration), status: {extensionVersion: '0.2.2', executing: true, activeMatches: true}});
    reading.delete(id);
  }};
const snapshot = () => ({desktop: {project: true, projectId: project.id, epoch}, workspaceContext: {systemId: project.systems[0].id},
  workspace: {systems: project.systems.map(system => ({name: system.name, binding: {systemId: system.id, baseTopic: system.baseTopic}}))}});

const rendererTest = `async () => {
  const {installSystemLink} = await import('./system-link.js');
  const {setLanguage} = await import('./localization.js');
  const bridge = window.linkTest;
  let destination;
  installSystemLink(bridge, {show: step => { destination = step; }});
  const $ = id => document.getElementById(id);
  const assert = (test, message) => { if (!test) throw new Error(message); };
  const wait = async (test, message) => {
    for (let i = 0; i < 200; i++) { if (await test()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
    throw new Error('Timed out: ' + message);
  };
  const update = async () => document.dispatchEvent(new CustomEvent('z2ma-designer-view', {detail: await bridge.view()}));
  const open = async () => { $('desktop-link-start').click(); await wait(() => $('desktop-link-dialog').open, 'open'); };
  const check = async () => { $('desktop-link-next').click(); await wait(() => !$('desktop-link-next').disabled, 'read complete'); };
  await update();
  setLanguage('de', {persist: false, report: false});
  await open();
  assert($('desktop-link-first').options.length === 9, 'all eight systems must be selectable');
  const names = [...$('desktop-link-first').options].slice(1).map(option => option.textContent);
  assert(names[0].startsWith('Alpha') && names.findIndex(name => name.startsWith('Room 2 ')) < names.findIndex(name => name.startsWith('Room 10 ')), 'natural alphabetic sorting');
  const first = $('desktop-link-first').value; const second = $('desktop-link-second').value;
  assert(first && second && first !== second, 'different systems selected');
  setLanguage('en', {persist: false, report: false});
  assert($('desktop-link-title').textContent === 'Connect systems to each other', 'English title');
  assert($('desktop-link-first').value === first && $('desktop-link-second').value === second, 'language preserves selection');
  assert(!$('desktop-link-dialog').querySelector('[data-language-picker]'), 'no duplicate language picker');
  await check();
  const announcements = [];
  const status = $('desktop-link-page-check').querySelector('[role=status]');
  const monitor = new MutationObserver(() => announcements.push(status.textContent));
  monitor.observe(status, {childList: true, subtree: true, characterData: true});
  await new Promise(resolve => setTimeout(resolve, 1250)); monitor.disconnect();
  assert(announcements.every(message => !message.startsWith('Reading reachable systems')), 'memory-only refresh must not announce a new broker read');
  assert($('desktop-link-findings').querySelectorAll('[data-system]').length === 2, 'separate system checks');
  assert(!$('desktop-link-findings').querySelector('img'), 'names must be escaped');
  assert(!$('desktop-link-dialog').querySelector('input[type=password]'), 'no credential entry');
  const external = $('desktop-link-page-check').querySelectorAll('section:last-of-type li[data-state=unknown]');
  assert(external.length === 4, 'external permissions and transport remain unverified');
  $('desktop-link-next').click();
  assert(!$('desktop-link-page-suggestions').hidden, 'suggestions opened');
  const bridgeBox = $('desktop-link-snippets').querySelector('[data-kind=bridge]');
  assert(bridgeBox && $('desktop-link-snippets').querySelectorAll('[data-kind=bridge]').length === 1, 'single bridge suggestion');
  bridgeBox.open = true;
  const code = bridgeBox.querySelector('textarea');
  assert(code.readOnly && code.value.includes('topic z2ma/mesh/# both 0'), 'mesh only example');
  bridgeBox.querySelector('button').click();
  assert(code.selectionEnd === code.value.length && code.selectionStart === 0, 'select configuration text');
  setLanguage('de', {persist: false, report: false});
  assert($('desktop-link-title').textContent === 'Systeme miteinander verbinden', 'German title');
  assert($('desktop-link-first').value === first && $('desktop-link-second').value === second, 'selection remains after result translation');
  assert(!$('desktop-link-dialog').textContent.includes('Translation unavailable'), 'complete result localization');
  $('desktop-link-back').click(); $('desktop-link-back').click();
  assert(!$('desktop-link-page-choose').hidden && $('desktop-link-first').value === first, 'back preserves systems');
  $('desktop-link-cancel').click();
  await open();
  await check();
  assert($('desktop-link-dialog').open, 'reopen survives queued close event');
  $('desktop-link-cancel').click();
  await bridge.scenario('offline'); await update(); await open(); await check();
  assert($('desktop-link-findings').querySelectorAll('[data-state=unknown]').length >= 6, 'offline state cannot be green');
  $('desktop-link-next').click();
  assert($('desktop-link-snippets').querySelector('textarea'), 'offline suggestions available');
  $('desktop-link-cancel').click();
  await bridge.scenario('shared'); await update(); await open(); await check();
  $('desktop-link-next').click();
  assert(!$('desktop-link-snippets').querySelector('[data-kind=bridge]'), 'no self bridge');
  $('desktop-link-cancel').click();
  await bridge.scenario('fail'); await open(); $('desktop-link-next').click();
  await wait(() => $('desktop-link-dialog').querySelector('.desktop-link-feedback').textContent.length, 'failed request feedback');
  assert($('desktop-link-next').disabled, 'failed check cannot use stale results');
  await bridge.scenario('shared'); $('desktop-link-repeat').click();
  await wait(() => !$('desktop-link-next').disabled, 'retry');
  $('desktop-link-connection').click();
  assert(destination === 'connection' && !$('desktop-link-dialog').open, 'corrective navigation closes dialog');
  await open(); await bridge.scenario('reopenProject'); await update();
  assert(!$('desktop-link-dialog').open, 'project replacement invalidates the session');
  return {languages: ['de', 'en'], steps: 3, escaped: true, readOnly: true, reopen: true};
}`;

async function run() {
  await app.whenReady();
  const assets = join(root, 'apps/desktop/.build/renderer');
  const names = new Set(['system-link.js', 'localization.js', 'locales.js', 'transport.js', 'designer.css', 'desktop.css', 'desktop-palette.css']);
  protocol.handle('z2ma', request => {
    if (request.url === 'z2ma://app/index.html') return new Response('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="designer.css"><link rel="stylesheet" href="desktop-palette.css"><link rel="stylesheet" href="desktop.css"></head><body class="desktop-foundation"><section id="desktop-partner-overview"></section></body></html>', {headers: {'Content-Type': 'text/html', 'Content-Security-Policy': csp}});
    const name = assetPath(request.url, request.method, names);
    if (!name) return new Response(null, {status: 404});
    return new Response(readFileSync(join(assets, name)), {headers: {'Content-Type': extname(name) === '.css' ? 'text/css' : 'application/javascript'}});
  });
  ipcMain.handle('link:view', snapshot);
  ipcMain.handle('link:select', (_event, id) => { if (!project.systems.some(system => system.id === id)) throw new Error('Unknown test system'); return {ok: true}; });
  ipcMain.handle('link:scenario', (_event, name) => {
    fail = name === 'fail'; online = name !== 'offline';
    if (name === 'shared') project.systems[1].brokerId = project.brokers[0].id;
    if (name === 'reopenProject') epoch++;
    if (!online) for (const remote of remotes.values()) remote.fresh = false;
  });
  ipcMain.handle('link:network', (_event, command) => {
    if (!validPayload('network', command) || !['linkPlan', 'linkCheck'].includes(command.action)) throw new Error('Unexpected test request');
    requests.push(command.action);
    if (fail) return {ok: false, error: 'failed'};
    if (command.action === 'linkCheck') readSystemLink(project, reader, command.id, command.peerId);
    return {ok: true, state: {epoch, linkPlan: systemLinkPlan(project, reader, command.id, command.peerId)}};
  });
  const openWindow = async () => {
    const window = new BrowserWindow({show: false, width: 1280, height: 900,
      webPreferences: {...rendererPreferences, backgroundThrottling: false, preload: process.env.Z2MA_LINK_TEST_PRELOAD}});
    await window.loadURL('z2ma://app/index.html');
    return window;
  };
  let window = await openWindow();
  const before = JSON.stringify(project.systems.map(system => system.configuration));
  const result = await window.webContents.executeJavaScript('(' + rendererTest + ')()');
  if (before !== JSON.stringify(project.systems.map(system => system.configuration))) throw new Error('UI changed a draft');
  if (!requests.includes('linkCheck')) throw new Error('No explicit check was tested');
  window.destroy();
  window = await openWindow();
  const view = window.webContents;
  await view.executeJavaScript(`(async () => {
    const {installSystemLink} = await import('./system-link.js');
    installSystemLink(window.linkTest, {show: () => {}});
    document.dispatchEvent(new CustomEvent('z2ma-designer-view', {detail: await window.linkTest.view()}));
  })()`);
  view.focus();
  await view.executeJavaScript("document.getElementById('desktop-link-start').click(); document.getElementById('desktop-link-first').focus();");
  view.sendInputEvent({type: 'keyDown', keyCode: 'Tab'});
  view.sendInputEvent({type: 'keyUp', keyCode: 'Tab'});
  let focused = false;
  for (let n = 0; n < 30 && !focused; n++) {
    await new Promise(resolve => setTimeout(resolve, 30));
    focused = await view.executeJavaScript("document.activeElement.id === 'desktop-link-second'");
  }
  if (!focused) throw new Error('System selectors have incorrect keyboard order');
  const point = await view.executeJavaScript(`(async () => {
    document.getElementById('desktop-link-next').click();
    for (let n = 0; n < 100 && document.getElementById('desktop-link-next').disabled; n++) await new Promise(resolve => setTimeout(resolve, 20));
    const content = document.querySelector('.desktop-link-content'); content.scrollTop = 0;
    window.linkWheel = {events: 0, prevented: false};
    content.addEventListener('wheel', event => { window.linkWheel.events++; window.linkWheel.prevented = event.defaultPrevented; }, {passive: true});
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const bounds = content.getBoundingClientRect();
    return {x: Math.round(bounds.x + bounds.width / 2), y: Math.round(bounds.y + bounds.height / 2)};
  })()`);
  // Inject input into the owned Chromium page using page-local coordinates;
  // this does not inspect or capture a desktop or window image.
  view.debugger.attach('1.3');
  await view.debugger.sendCommand('Emulation.setFocusEmulationEnabled', {enabled: true});
  await view.debugger.sendCommand('Input.dispatchMouseEvent', {type: 'mouseMoved', ...point});
  await view.debugger.sendCommand('Input.dispatchMouseEvent', {type: 'mouseWheel', ...point, deltaY: 250, deltaX: 0});
  for (let n = 0; n < 100; n++) {
    if (await view.executeJavaScript("document.querySelector('.desktop-link-content').scrollTop > 0")) break;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  view.debugger.detach();
  if (!await view.executeJavaScript("document.querySelector('.desktop-link-content').scrollTop > 0 && document.scrollingElement.scrollTop === 0")) {
    console.log('SYSTEM_LINK_WHEEL_STATE ' + JSON.stringify(await view.executeJavaScript(`(() => {
      const content = document.querySelector('.desktop-link-content');
      return {top: content.scrollTop, height: content.clientHeight, total: content.scrollHeight,
        documentTop: document.scrollingElement.scrollTop, wheel: window.linkWheel, target: document.elementFromPoint(${point.x}, ${point.y})?.tagName};
    })()`)));
    throw new Error('Mouse wheel did not stay within the dialog scroll area');
  }
  view.sendInputEvent({type: 'keyDown', keyCode: 'Escape'});
  view.sendInputEvent({type: 'keyUp', keyCode: 'Escape'});
  let closed = false;
  for (let n = 0; n < 30 && !closed; n++) {
    await new Promise(resolve => setTimeout(resolve, 30));
    closed = await view.executeJavaScript("!document.getElementById('desktop-link-dialog').open");
  }
  if (!closed) throw new Error('Escape did not cancel the assistant');
  console.log('SYSTEM_LINK_DOM_INPUT_OK keyboard/wheel/escape');
  for (const width of [360, 1280]) for (const theme of ['light', 'dark']) {
    window.setContentSize(width, 700); nativeTheme.themeSource = theme;
    await view.executeJavaScript(`(async () => {
      const {setLanguage} = await import('./localization.js');
      document.getElementById('desktop-link-start').click();
      for (const name of ['de', 'en']) {
        setLanguage(name, {persist: false, report: false});
        const dialog = document.getElementById('desktop-link-dialog');
        const body = dialog.querySelector('.desktop-link-content');
        const footer = dialog.querySelector('footer');
        if (dialog.scrollWidth > dialog.clientWidth + 1 || dialog.getBoundingClientRect().bottom > innerHeight + 1) throw new Error('Dialog overflow');
        if (footer.getBoundingClientRect().bottom > dialog.getBoundingClientRect().bottom + 1) throw new Error('Footer outside dialog');
        document.getElementById('desktop-link-next').click();
        for (let n = 0; n < 100 && document.getElementById('desktop-link-next').disabled; n++) await new Promise(resolve => setTimeout(resolve, 20));
        if (body.scrollHeight <= body.clientHeight) throw new Error('Checks require an internal scroll area');
        body.scrollTop = body.scrollHeight;
        if (document.getElementById('desktop-link-next').getBoundingClientRect().bottom > innerHeight) throw new Error('Next button scrolled away');
        dialog.close(); document.getElementById('desktop-link-start').click();
      }
      document.getElementById('desktop-link-dialog').close();
    })()`);
    console.log('SYSTEM_LINK_DOM_LAYOUT_OK ' + width + '/' + theme);
  }
  window.destroy();
  console.log('SYSTEM_LINK_DOM_OK ' + JSON.stringify(result));
  app.exit(0);
}
run().catch(error => { console.error('SYSTEM_LINK_DOM_FAILED ' + error.message); app.exit(1); });
