import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, dirname, basename, extname} from 'node:path';
import {fileURLToPath} from 'node:url';

// DOM and layout assertions only. No desktop/window/image capture.
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
if (!process.versions.electron) {
  const profile = await mkdtemp(join(tmpdir(), 'z2ma-update-ui-'));
  try {
    const env = {...process.env, Z2MA_UPDATE_TEST_PROFILE: profile}; delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(require('electron'), [fileURLToPath(import.meta.url)], {cwd: root, env, windowsHide: true, stdio: 'inherit'});
    const started = Date.now(); let expired = false;
    const timer = setTimeout(() => { expired = true; child.kill(); }, 30000);
    try {
      const {code, signal} = await new Promise((done, reject) => {
        child.once('error', reject); child.once('close', (code, signal) => done({code, signal}));
      });
      if (expired || code !== 0) throw new Error('Extension update DOM test failed: ' + JSON.stringify({timeout: expired, elapsedMs: Date.now() - started, code, signal}));
    } finally { clearTimeout(timer); }
  } finally {
    const target = resolve(profile);
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('z2ma-update-ui-')) throw new Error('Unexpected test profile');
    await rm(target, {recursive: true, force: true});
  }
} else {
  const {app, BrowserWindow, protocol} = await import('electron');
  const {assetPath, csp, rendererPreferences} = require('../apps/desktop/.build/security.js');
  app.setPath('userData', process.env.Z2MA_UPDATE_TEST_PROFILE);
  protocol.registerSchemesAsPrivileged([{scheme: 'z2ma', privileges: {standard: true, secure: true, supportFetchAPI: true}}]);
  if (process.platform === 'linux' && process.env.CI === 'true') app.disableHardwareAcceleration();
  const run = async () => {
    const started = Date.now();
    const step = async (phase, action) => {
      console.log('EXTENSION_UPDATE_DOM_STEP ' + JSON.stringify({phase, elapsedMs: Date.now() - started}));
      let timer;
      try {
        return await Promise.race([Promise.resolve().then(action), new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Extension update DOM phase timed out: ' + phase)), 8000);
        })]);
      } finally { clearTimeout(timer); }
    };
    await step('app-ready', () => app.whenReady());
    const assets = join(root, 'apps/desktop/.build/renderer');
    const names = new Set(['network.js', 'operation-flags.js', 'operation-readiness.js', 'draft-review.js', 'validation-feedback.js', 'drafts.js', 'desktop-workspace.js', 'guided-workspace.js', 'symcon-workspace.js', 'draft-sync.js', 'guided-workspace.css', 'layout.js', 'confirmation.js', 'runtime.js', 'workspace.js', 'identity.js', 'localization.js', 'transport.js', 'locales.js', 'designer.css', 'desktop-palette.css', 'desktop.css', 'confirmation.css', 'confirmation.html']);
    protocol.handle('z2ma', async request => {
      if (request.url === 'z2ma://app/index.html') return new Response('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="designer.css"><link rel="stylesheet" href="desktop-palette.css"><link rel="stylesheet" href="desktop.css"><body class="desktop-foundation"></body>', {headers: {'Content-Type': 'text/html', 'Content-Security-Policy': csp}});
      if (request.url === 'z2ma://app/workspace.html') return new Response((await readFile(join(assets, 'index.html'), 'utf8')).replace('<script type="module" src="desktop.js"></script>', ''), {headers: {'Content-Type': 'text/html', 'Content-Security-Policy': csp}});
      const name = assetPath(request.url, request.method, names);
      if (!name) return new Response(null, {status: 404});
      return new Response(await readFile(join(assets, name)), {headers: {'Content-Type': extname(name) === '.css' ? 'text/css' : extname(name) === '.html' ? 'text/html' : 'application/javascript', 'Content-Security-Policy': csp}});
    });
    const window = new BrowserWindow({show: false, width: 1000, height: 800, webPreferences: {...rendererPreferences, backgroundThrottling: false}});
    const evaluate = (phase, source) => step(phase, () => window.webContents.executeJavaScript(source));
    const load = (page, url) => step('load-' + page, () => window.loadURL(url));
    const resize = async (width, height) => {
      window.setContentSize(width, height);
      const deadline = Date.now() + 3000; let viewport;
      do {
        viewport = await window.webContents.executeJavaScript('({width: innerWidth, height: innerHeight})');
        if (viewport.width === width && viewport.height === height) return;
        await new Promise(resolve => setTimeout(resolve, 10));
      } while (Date.now() < deadline);
      throw new Error('Renderer viewport did not resize: ' + JSON.stringify({expected: {width, height}, actual: viewport}));
    };
    const layout = (phase, width, height, source) => step(phase, async () => {
      await resize(width, height);
      return window.webContents.executeJavaScript(source);
    });
    await load('workspace', 'z2ma://app/workspace.html');
    await evaluate('prepare-workspace', '(' + prepareWorkspaceLayout + ')()');
    await step('input-setup', async () => {
      window.webContents.debugger.attach('1.3');
      await window.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', {enabled: true});
    });
    for (const [height, theme] of [[900, 'light'], [500, 'dark']]) {
      await step(`workspace-wheel-1440x${height}-${theme}`, async () => {
        await resize(1440, height);
        await workspaceWheelTest(window, theme);
      });
    }
    await step('keyboard-focus-mode', async () => {
      await window.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9});
      await window.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9});
    });
    // Layout reads flush styles; verify renderer dimensions without waiting for hidden-window paint.
    for (const [width, height, fontSize] of [[1440, 900, 16], [1440, 600, 16], [1440, 500, 16], [1024, 768, 16], [1024, 768, 24], [360, 740, 16]]) for (const theme of ['light', 'dark']) {
      await layout(`workspace-${width}x${height}-${fontSize}-${theme}`, width, height, `(async () => {
        document.documentElement.style.colorScheme = '${theme}'; document.documentElement.style.fontSize = '${fontSize}px';
        for (const fold of document.querySelectorAll('.workspace .designer-fold')) if (!fold.open) fold.querySelector('summary').click();
        const list = document.querySelector('#entry-list'); const workspace = document.querySelector('.workspace');
        const rect = list.getBoundingClientRect();
        if (getComputedStyle(workspace).display === 'grid' && (rect.bottom > innerHeight + 1 || rect.top < 0)) throw new Error('Automation list extends below the visible window: ' + JSON.stringify({viewport: [innerWidth, innerHeight], list: [rect.top, rect.bottom], workspace: [workspace.getBoundingClientRect().top, workspace.clientHeight], navigation: list.parentElement.clientHeight}));
        if (document.scrollingElement.scrollHeight > innerHeight + 1 || document.scrollingElement.scrollWidth > innerWidth + 1) throw new Error('The outer application window must not scroll');
        if (list.clientHeight < 60 || list.scrollHeight <= list.clientHeight || getComputedStyle(list).overflowY !== 'auto') throw new Error('Automation list must retain usable independent scrolling');
        list.scrollTop = list.scrollHeight;
        const last = list.lastElementChild.getBoundingClientRect();
        if (last.bottom > list.getBoundingClientRect().bottom + 1) throw new Error('The last automation must be reachable inside its list');
        if (workspace.getBoundingClientRect().width > document.querySelector('#desktop-view-automations').clientWidth) throw new Error('Automation workspace overflows horizontally');
        for (const [panelName, contentName] of [['canvas', 'canvas-scroll'], ['inspector', 'inspector-fields']]) {
          const panel = workspace.querySelector('.' + panelName); const content = panel.querySelector('.' + contentName);
          const scroller = getComputedStyle(panel).overflowY === 'auto' && panel.scrollHeight > panel.clientHeight + 1 ? panel : content;
          if (scroller.clientHeight < 30 || scroller.scrollHeight <= scroller.clientHeight) throw new Error('Long automation details need an accessible scroll area: ' + JSON.stringify({viewport: [innerWidth, innerHeight], panel: panelName, height: scroller.clientHeight, scroll: scroller.scrollHeight}));
          scroller.scrollTop = scroller.scrollHeight;
          if (content.lastElementChild.getBoundingClientRect().bottom > scroller.getBoundingClientRect().bottom + 1) throw new Error('The end of automation details must remain reachable');
          scroller.scrollTop = 0;
        }
        list.scrollTop = 0; list.focus();
        if (document.activeElement !== list) throw new Error('Automation list needs keyboard access');
        list.lastElementChild.focus();
        await Promise.resolve();
        const title = list.lastElementChild.querySelector('strong').getBoundingClientRect();
        const focusedList = list.getBoundingClientRect();
        if (title.top < focusedList.top - 1 || title.bottom > focusedList.bottom + 1 || document.scrollingElement.scrollTop) throw new Error('Keyboard focus must reveal the last automation name without scrolling the screen: ' + JSON.stringify({viewport: [innerWidth, innerHeight], title: [title.top, title.bottom], list: [focusedList.top, focusedList.bottom], focusVisible: list.lastElementChild.matches(':focus-visible'), height: list.clientHeight, page: document.scrollingElement.scrollTop}));
      })()`);
    }
    await step('reset-workspace', async () => {
      window.webContents.debugger.detach();
      await window.webContents.executeJavaScript("document.documentElement.style.fontSize = '';");
      await resize(1000, 800);
    });
    await evaluate('receiver-readiness', '(' + receiverReadinessTest + ')()');
    await load('draft-summaries', 'z2ma://app/index.html');
    await evaluate('draft-summaries', '(' + workspaceSummaryTest + ')()');
    await load('network-controls', 'z2ma://app/index.html');
    await evaluate('network-controls', '(' + rendererTest + ')()');
    await evaluate('prepare-rule-list', `(() => {
      const panel = document.querySelector('#mqtt-rule-flags');
      for (const child of document.body.children) if (!child.contains(panel)) child.hidden = true;
      const list = panel.querySelector('ul'); const row = list.firstElementChild;
      for (let index = 0; index < 40; index++) {
        const copy = row.cloneNode(true); copy.querySelector('strong').textContent = 'Synthetic long automation name '.repeat(6); list.append(copy);
      }
    })()`);
    for (const width of [360, 1280]) for (const theme of ['light', 'dark']) {
      await layout(`rule-list-${width}-${theme}`, width, 800, `(() => {
        document.documentElement.style.colorScheme = '${theme}';
        const panel = document.querySelector('#mqtt-rule-flags'); const list = panel.querySelector('ul');
        if (panel.getBoundingClientRect().right > innerWidth + 1 || document.scrollingElement.scrollWidth > innerWidth + 1) throw new Error('Rule permissions overflow the workspace');
        if (list.scrollHeight <= list.clientHeight || getComputedStyle(list).overflowY !== 'auto') throw new Error('Rule selection needs its own bounded scroll area');
        list.scrollTop = list.scrollHeight;
        if (Math.abs(list.scrollTop + list.clientHeight - list.scrollHeight) > 1) throw new Error('The last rule must remain reachable');
        const input = list.querySelector('input'); input.focus();
        if (document.activeElement !== input || input.getBoundingClientRect().width < 18) throw new Error('Rule checkboxes must remain keyboard accessible');
      })()`);
    }
    await step('transfer-resume-confirmation', () => transferConfirmationTest(window, assets, resize));
    await load('confirmation', 'z2ma://app/confirmation.html');
    for (const width of [320, 540]) for (const theme of ['light', 'dark']) {
      await layout(`confirmation-${width}-${theme}`, width, 310, `(() => {
        document.documentElement.style.colorScheme = '${theme}';
        document.querySelector('#question').textContent = 'Extension installieren und Zigbee2MQTT neu starten?';
        document.querySelector('#detail').textContent = ${JSON.stringify('Synthetic target · Broker (127.0.0.1:1883) · Build old → new. '.repeat(12))};
        document.querySelector('#cancel').textContent = 'Abbrechen'; document.querySelector('#accept').textContent = 'Fortfahren';
        const footer = document.querySelector('footer').getBoundingClientRect();
        if (footer.bottom > innerHeight + 1 || footer.top < 0) throw new Error('Confirmation buttons outside viewport');
        const detail = document.querySelector('#detail');
        if (detail.scrollHeight <= detail.clientHeight) throw new Error('Long update review needs its own scroll area');
        detail.scrollTop = detail.scrollHeight;
        if (document.scrollingElement.scrollTop !== 0) throw new Error('Confirmation body must not scroll');
      })()`);
    }
    window.destroy(); console.log('EXTENSION_UPDATE_DOM_OK progress/de/en/automatic-draft-check/guided-transfer/capability-findings/operation-flags/transfer-resume-confirmation/confirmation-layout/workspace-wheel elapsedMs=' + (Date.now() - started)); app.exit(0);
  };
  run().catch(error => { console.error('EXTENSION_UPDATE_DOM_FAILED ' + error.stack); app.exit(1); });
}

async function transferConfirmationTest(window, assets, resize) {
  const assert = (await import('node:assert/strict')).default;
  const {confirmationScript} = require('../apps/desktop/.build/confirmation.js');
  for (const language of ['de', 'en']) {
    const catalog = JSON.parse(await readFile(join(assets, 'locales', language + '.json'), 'utf8'));
    const options = {language, question: 'Synthetic transfer?', detail: 'Synthetic stopped review. '.repeat(30), cancel: 'Cancel', accept: 'Continue',
      resume: {label: catalog['project.transferResumePrevious'], help: catalog['project.transferResumeHelp'],
        detail: 'Synthetic checked enabled rule, new rule disabled. '.repeat(30), enabled: true}};
    await window.loadURL('z2ma://app/confirmation.html');
    const reply = window.webContents.executeJavaScript(confirmationScript(options));
    assert.deepEqual(await window.webContents.executeJavaScript(`(() => ({checked: document.querySelector('#resume-previous-operation').checked,
      disabled: document.querySelector('#resume-previous-operation').disabled, focus: document.activeElement.id,
      label: document.querySelector('#resume-label').textContent}))()`),
    {checked: false, disabled: false, focus: 'cancel', label: options.resume.label});
    for (const width of [320, 540]) for (const theme of ['light', 'dark']) {
      await resize(width, 430);
      await window.webContents.executeJavaScript(`(() => {
        document.documentElement.style.colorScheme = '${theme}';
        const footer = document.querySelector('footer').getBoundingClientRect();
        const choice = document.querySelector('#resume-previous-operation'); const bounds = choice.getBoundingClientRect();
        if (footer.bottom > innerHeight + 1 || footer.top < 0 || bounds.top < 0 || bounds.bottom > footer.top || bounds.width < 18) throw new Error('Transfer choice or buttons outside viewport');
        if (document.scrollingElement.scrollHeight > innerHeight + 1 || document.scrollingElement.scrollWidth > innerWidth + 1) throw new Error('Transfer dialog must not scroll as a whole');
        const detail = document.querySelector('#detail');
        if (detail.clientHeight < 20 || detail.scrollHeight <= detail.clientHeight) throw new Error('Transfer review needs a usable scroll area');
        choice.focus(); if (document.activeElement !== choice) throw new Error('Resume choice needs keyboard access');
      })()`);
    }
    assert.equal(await window.webContents.executeJavaScript(`(() => {
      document.querySelector('#resume-previous-operation').click(); return document.querySelector('#detail').textContent;
    })()`), options.resume.detail);
    await window.webContents.executeJavaScript("document.querySelector('#accept').click()");
    assert.deepEqual(await reply, {accepted: true, resume: true});
    for (const ending of ['cancel', 'escape', 'disabled']) {
      await window.loadURL('z2ma://app/confirmation.html');
      const next = window.webContents.executeJavaScript(confirmationScript({...options, resume: {...options.resume, enabled: ending !== 'disabled'}}));
      assert.equal(await window.webContents.executeJavaScript("document.querySelector('#resume-previous-operation').checked"), false, 'a subsequent transfer never inherits a previous choice');
      await window.webContents.executeJavaScript(ending === 'disabled'
        ? "document.querySelector('#resume-previous-operation').checked = true; document.querySelector('#accept').click()"
        : ending === 'escape' ? "document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))" : "document.querySelector('#cancel').click()");
      assert.deepEqual(await next, ending === 'disabled' ? {accepted: true, resume: false} : false);
    }
  }
}

async function workspaceWheelTest(window, theme) {
  const view = window.webContents;
  const point = await view.executeJavaScript(`(() => {
    document.documentElement.style.colorScheme = '${theme}'; document.documentElement.style.fontSize = '16px';
    document.activeElement?.blur();
    const list = document.querySelector('#entry-list'); list.scrollTop = 0;
    window.workspaceWheelObservation = {events: 0, trusted: false, prevented: false};
    if (window.workspaceWheelListener) list.removeEventListener('wheel', window.workspaceWheelListener);
    window.workspaceWheelListener = event => {
      queueMicrotask(() => { window.workspaceWheelObservation = {
        events: window.workspaceWheelObservation.events + 1, trusted: event.isTrusted, prevented: event.defaultPrevented
      }; });
    };
    list.addEventListener('wheel', window.workspaceWheelListener, {passive: true});
    const box = list.getBoundingClientRect();
    const x = Math.round(box.left + box.width / 2), y = Math.round(box.top + Math.min(box.height / 2, 50));
    return {x, y, inside: list.contains(document.elementFromPoint(x, y)), viewportHeight: innerHeight};
  })()`);
  if (!point.inside || point.y > point.viewportHeight) throw new Error('Wheel target is outside the visible automation list: ' + JSON.stringify(point));
  const state = () => view.executeJavaScript(`(() => ({
    top: document.querySelector('#entry-list').scrollTop,
    page: document.scrollingElement.scrollTop,
    tools: document.querySelector('.desktop-navigation-tools').scrollTop,
    navigation: document.querySelector('.workspace .navigation').scrollTop,
    wheel: window.workspaceWheelObservation
  }))()`);
  for (const deltaY of [200, -200]) {
    const before = await state();
    await view.debugger.sendCommand('Input.dispatchMouseEvent', {type: 'mouseMoved', x: point.x, y: point.y});
    await view.debugger.sendCommand('Input.dispatchMouseEvent', {type: 'mouseWheel', x: point.x, y: point.y, deltaX: 0, deltaY});
    const deadline = Date.now() + 3000; let after; let moved = false;
    do {
      after = await state();
      moved = deltaY > 0 ? after.top > before.top : after.top < before.top;
      if (moved && after.wheel.events > before.wheel.events) break;
      await new Promise(resolve => setTimeout(resolve, 25));
    } while (Date.now() < deadline);
    if (!moved || after.wheel.events <= before.wheel.events || !after.wheel.trusted || after.wheel.prevented) {
      throw new Error('Mouse wheel did not scroll the automation list: ' + JSON.stringify({deltaY, before, after}));
    }
    if (after.page !== 0 || after.tools !== before.tools || after.navigation !== before.navigation) {
      throw new Error('Automation wheel input moved an outer container: ' + JSON.stringify({before, after}));
    }
  }
}

async function prepareWorkspaceLayout() {
  const {installDesktopWorkspace} = await import('./desktop-workspace.js');
  const {installLayout} = await import('./layout.js');
  document.body.classList.add('module-designer', 'desktop-foundation', 'desktop-editable');
  for (const selector of ['#save-button', '#activate-button', '#stop-button', '.toolbar-divider', '.navigation-footer']) document.querySelector(selector)?.remove();
  for (const id of ['draft-wizard-start', 'new-sequence-button']) {
    const button = document.createElement('button'); button.id = id; button.textContent = id === 'draft-wizard-start' ? 'Neue Automation als Entwurf' : 'Neue Aktionsfolge'; document.querySelector('.toolbar').append(button);
  }
  const systems = document.createElement('label'); systems.className = 'system-selector'; systems.textContent = 'Z2M-System';
  const select = document.createElement('select'); select.append(new Option('Synthetic system', 'synthetic')); systems.append(select); document.body.append(systems);
  installLayout({getData: () => null});
  document.querySelector('.designer-menu-items').append(document.querySelector('#draft-wizard-start'));
  document.querySelector('#feedback').textContent = 'Synthetic workspace feedback';
  const categories = document.querySelector('#categories');
  for (const name of ['Geräteausgelöst', 'Zeit & Astro', 'Aktionsfolgen', 'Geräte & Kanäle']) {
    const button = document.createElement('button'); button.className = 'category'; button.textContent = name; categories.append(button);
  }
  const filter = document.createElement('label'); filter.className = 'rule-state-filter'; filter.textContent = 'Regelschalter im Entwurf';
  const choice = document.createElement('select'); choice.append(new Option('Alle', 'all')); filter.append(choice); categories.before(filter);
  document.querySelector('#list-label').textContent = 'Geräteausgelöst'; document.querySelector('#list-count').textContent = '30 / 30';
  const list = document.querySelector('#entry-list');
  for (let index = 0; index < 30; index++) {
    const button = document.createElement('button'); button.className = 'entry';
    const title = document.createElement('strong'); title.textContent = 'Synthetic automation ' + index;
    const detail = document.createElement('small'); detail.textContent = 'Synthetic device event with a long description '.repeat(3);
    button.append(title, detail); list.append(button);
  }
  for (const selector of ['#flow', '.inspector-fields']) {
    const content = document.querySelector(selector);
    for (let index = 0; index < 30; index++) {
      const row = document.createElement('p'); row.textContent = 'Synthetic automation detail '.repeat(8); content.append(row);
    }
  }
  const workspace = installDesktopWorkspace();
  workspace.mountDesigner();
  workspace.updateProject({active: true, project: {name: 'Synthetic project', brokers: [{}], systems: [{}]}}, true);
  workspace.update({desktop: {project: true, source: 'draft', draftRevision: 13}, workspaceContext: {systemId: 'synthetic'}, status: {mqttConnected: true}});
}

async function receiverReadinessTest() {
  const {installOperationReadiness} = await import('./operation-readiness.js');
  const {setLanguage} = await import('./localization.js');
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const source = {name: 'Synthetic source', binding: {systemId: 'source', baseTopic: 'synthetic/source'}, runtimeConfirmed: true, executing: true};
  const target = {name: 'Synthetic receiver', binding: {systemId: 'target', baseTopic: 'synthetic/target'}, runtimeConfirmed: true, executing: false};
  const entry = {id: 'saved', name: 'Saved remote rule', enabled: true, actions: [{type: 'set', target: {system: 'synthetic/target'}}]};
  const saved = {automations: [entry], sequences: [], mesh_peers: ['synthetic/target']};
  let data = {desktop: {project: true}, workspaceContext: {systemId: 'source'}, module: {baseTopic: 'synthetic/source'},
    workspace: {systems: [source, target]}, configuration: {automations: [], sequences: []}, operationConfiguration: saved};
  const choices = [];
  const update = installOperationReadiness({getData: () => data, getEntry: () => entry,
    chooseSystem: async id => { choices.push(id); data = {...data, workspaceContext: {systemId: id}, module: {baseTopic: id === 'source' ? source.binding.baseTopic : target.binding.baseTopic},
      operationConfiguration: id === 'source' ? saved : {automations: [], sequences: [], mesh_peers: ['synthetic/source']}}; return true; },
    showOperation: () => document.querySelector('#desktop-nav-operation').click()});
  update();
  for (const lang of ['de', 'en']) {
    setLanguage(lang, {persist: false, report: false}); update();
    const row = document.querySelector('.operation-readiness li');
    assert(row.dataset.state === 'stopped' && row.textContent.includes('Synthetic receiver'), 'Desktop identifies the stopped receiver');
    assert(document.querySelector('.operation-preparation li[data-state="stopped"]'), 'Desktop operation uses saved rules even when the local draft has no remote rules');
    for (const [index, theme] of ['light', 'dark'].entries()) {
      document.documentElement.style.colorScheme = theme;
      assert(getComputedStyle(row).color === ['rgb(159, 40, 63)', 'rgb(240, 166, 177)'][index], 'Stopped receiver uses the desktop error palette');
    }
  }
  document.querySelector('button[data-operation-system="target"]').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert(choices.join(',') === 'target' && !document.querySelector('#desktop-view-operation').hidden, 'Direct receiver navigation opens Operation');
  assert(document.querySelector('.operation-preparation').textContent.includes('Activate partner reception'), 'Receiver-only preparation explains that local rules need not be released');
  document.querySelector('button[data-operation-return="source"]').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert(choices.join(',') === 'target,source', 'Return navigation uses the original stable system identity');
  target.runtimeConfirmed = false; update();
  assert(document.querySelector('.operation-readiness li').dataset.state === 'unknown', 'An unconfirmed desktop receiver remains unknown');
  target.runtimeConfirmed = target.executing = true; update();
  assert(document.querySelector('.operation-readiness li').dataset.state === 'active', 'Confirmed desktop readback clears the stopped warning');
}

async function workspaceSummaryTest() {
  const {installDraftExchange} = await import('./drafts.js');
  const {setLanguage} = await import('./localization.js');
  const panel = document.createElement('section'); document.body.append(panel);
  const workspace = {pages: {draft: panel}, review: document.createElement('div'), link: parent => {
    const button = document.createElement('button'); parent.append(button); return button;
  }};
  installDraftExchange({}, workspace);
  const view = {desktop: {project: true, source: 'stored', draftRevision: 13,
    draftSummary: {rules: 8, enabled: 1, sequences: 0}, storedSummary: {rules: 8, enabled: 7, sequences: 0}},
    status: {storedRevision: 74, confirmed: true}, workspaceContext: {systemId: 'synthetic'}, configuration: {automations: []}};
  document.dispatchEvent(new CustomEvent('z2ma-designer-view', {detail: view}));
  const local = document.querySelector('#draft-local-counts'); const stored = document.querySelector('#draft-stored-counts');
  setLanguage('de', {persist: false, report: false});
  if (!local.textContent.includes('8 Automationen · 1 freigegeben') || !stored.textContent.includes('8 Automationen · 7 freigegeben')) throw new Error('Show local and stored counts independently of the selected source');
  if (!panel.textContent.includes('unabhängig') || !panel.textContent.includes('bisherigen Entwurf')) throw new Error('Explain independent revisions and pre-import backups');
  setLanguage('en', {persist: false, report: false});
  if (!local.textContent.includes('8 automations · 1 enabled') || !stored.textContent.includes('8 automations · 7 enabled')) throw new Error('Workspace summaries must follow the central language');
  view.desktop.storedSummary = null; view.status.storedRevision = null;
  document.dispatchEvent(new CustomEvent('z2ma-designer-view', {detail: view}));
  if (!stored.hidden || local.hidden) throw new Error('A missing Z2M snapshot must not imply an empty or matching draft');
}

async function rendererTest() {
  const {installNetwork} = await import('./network.js');
  const {setLanguage} = await import('./localization.js');
  const {validationSummary} = await import('./draft-review.js');
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const wait = async test => { for (let n = 0; n < 200; n++) { if (test()) return; await new Promise(resolve => setTimeout(resolve, 20)); } throw new Error('UI condition timed out'); };
  const node = tag => { const value = document.createElement(tag); document.body.append(value); return value; };
  const brokerCard = node('div'); brokerCard.className = 'desktop-card';
  const choice = document.createElement('select'); choice.id = 'project-brokerChoice'; brokerCard.append(choice);
  const picker = node('select'); picker.id = 'designer-system';
  node('div').id = 'draft-local-actions'; node('div').id = 'draft-stored-actions';
  const workspace = {pages: Object.fromEntries(['operation', 'connection', 'draft', 'review', 'transfer'].map(key => [key, node('section')])), actions: node('div'), review: node('div'), show: () => true,
    link: parent => { const value = document.createElement('button'); parent.append(value); return value; }};
  const id = '11111111-1111-4111-8111-111111111111';
  const state = {sequence: 0, brokers: [{id: 'broker', state: 'connected'}], systems: [{id, brokerId: 'broker', name: 'Synthetic', baseTopic: 'synthetic', fresh: true, stored: true, revision: 1, build: 'a'.repeat(64),
    flagsContext: 'a'.repeat(64), devices: 0, scenes: 0, executing: false, runtime: {resume: true, recovery: 'stopped', runs: [], rules: [
      {id: 'rule_a', name: 'Zulu', enabled: false}, {id: 'rule_b', name: 'Alpha', enabled: false}]}}], extensionUpdates: []};
  let finish, installing = false, polls = 0, view, finishTransfer, transferring = false, kind = 'flags', validationFailure, flagsCanceled = false, flagsRejected = false;
  const commands = [];
  const bridge = {snapshot: async () => structuredClone(view), designer: async () => ({ok: true}), network: async ({action, enabled, context}) => {
    if (action === 'status') { polls++; return {ok: true, state: structuredClone(state)}; }
    commands.push(action);
    if (action === 'setRuleFlags') {
      assert(context === state.systems[0].flagsContext, 'Submit the displayed stored-state context');
      if (flagsCanceled) return {ok: true, state: {...structuredClone(state), outcome: 'transferCanceled'}};
      if (flagsRejected) return {ok: false, error: 'draftValue'};
      for (const rule of state.systems[0].runtime.rules) rule.enabled = enabled.includes(rule.id);
      state.systems[0].executing = false;
      state.systems[0].flagsContext = 'b'.repeat(64); state.sequence++;
      return {ok: true, state: {...structuredClone(state), outcome: 'transferStored'}};
    }
    if (action === 'validate') {
      if (validationFailure) return {ok: false, error: 'draftValue', validation: structuredClone(validationFailure)};
      state.sequence++; state.draftChecks = [{id, kind, added: 0, changed: kind === 'unchanged' ? 0 : 1, removed: 0, enabled: kind === 'flags' ? 1 : 0}];
      return {ok: true, state: {...structuredClone(state), outcome: kind === 'unchanged' ? 'transferUnchanged' : 'transferValidated'}};
    }
    if (action === 'store') {
      transferring = true; state.sequence++; state.transferProgress = [{id, phase: 'stopping', kind, failed: false}];
      await new Promise(resolve => { finishTransfer = resolve; });
      state.systems[0].revision++; state.systems[0].executing = false;
      for (const rule of state.systems[0].runtime.rules) rule.enabled = kind === 'flags' && rule.id === 'rule_b';
      state.systems[0].flagsContext = state.systems[0].revision.toString(16).padStart(64, '0');
      state.sequence++; state.transferProgress = [{id, phase: 'complete', kind, failed: false}]; state.draftChecks = [];
      return {ok: true, state: {...structuredClone(state), outcome: 'transferStored'}};
    }
    if (action === 'install') {
      installing = true; state.sequence++; state.extensionUpdates = [{id, stage: 'waiting', failed: false}];
      await new Promise(resolve => { finish = resolve; });
      state.sequence++; state.extensionUpdates = [{id, stage: 'complete', failed: false}];
      return {ok: true, state: {...structuredClone(state), outcome: 'transferInstalled'}};
    }
    return {ok: true, state: {...structuredClone(state), outcome: 'transferValidated'}};
  }};
  setLanguage('en', {persist: false, report: false});
  const update = installNetwork(bridge, workspace, async () => {});
  view = {desktop: {project: true, projectId: id, epoch: 1, source: 'draft', draftRevision: 1}, workspaceContext: {systemId: id},
    configuration: {automations: [], sequences: []}, module: {baseTopic: 'synthetic'}, devices: [], status: {confirmed: true}};
  update(view);
  await wait(() => !document.querySelector('#mqtt-install').disabled);
  document.querySelector('#mqtt-validate').click();
  await wait(() => !document.querySelector('#mqtt-validate').disabled);
  assert(!document.querySelector('#mqtt-store').disabled, 'Stopped restart preference must not block storage: ' + document.querySelector('#desktop-transfer-message').textContent);
  assert(!document.querySelector('#mqtt-validateEnabled'), 'No separate flags-only check in the app');
  assert(document.querySelector('#desktop-transfer-mode').textContent.startsWith('Only on/off switches changed'), 'Server chooses switch-only mode');
  document.querySelector('#mqtt-store').click(); await wait(() => transferring);
  await wait(() => document.querySelector('#desktop-transfer-message').textContent.startsWith('Stopping automatic operation'));
  assert(document.querySelector('#mqtt-store').disabled, 'No duplicate guided transfer');
  setLanguage('de', {persist: false, report: false});
  assert(document.querySelector('#desktop-transfer-message').textContent.startsWith('Automationsbetrieb und laufende Aktionen'), 'Transfer progress follows central language');
  setLanguage('en', {persist: false, report: false});
  finishTransfer(); await wait(() => !document.querySelector('#mqtt-validate').disabled);
  assert(!document.querySelector('#desktop-transfer-test').parentElement.hidden, 'Offer operation choices only after verified transfer');
  const transferMessage = document.querySelector('#desktop-transfer-message');
  assert(transferMessage.textContent.includes('1 of 2') && transferMessage.dataset.tone === 'success', 'A switch-only receipt must report the enabled count confirmed by Z2M');
  assert(document.querySelector('#desktop-transfer-mode').hidden && document.querySelector('#desktop-transfer-changes').hidden,
    'Completed transfers must hide the instructions and changes for a planned upload');
  state.systems[0].fresh = false; state.sequence++; update(view);
  await wait(() => document.querySelector('#mqtt-rule-count').dataset.enabled === '');
  assert(transferMessage.dataset.tone === 'warning' && !transferMessage.textContent.includes('Enabled in Z2M'), 'A lost connection must not keep a green transfer receipt or current enabled count');
  setLanguage('de', {persist: false, report: false});
  assert(transferMessage.textContent.includes('nicht frisch bestätigt'), 'Unconfirmed storage follows the central language');
  state.systems[0].fresh = true; state.sequence++; update(view);
  await wait(() => transferMessage.dataset.tone === 'success');
  assert(transferMessage.textContent.includes('1 von 2') && !transferMessage.textContent.includes('ausgeschaltet'), 'Confirmed enabled rules must not be described as disabled in German');
  setLanguage('en', {persist: false, report: false});
  state.systems[0].executing = true; state.sequence++; update(view);
  await wait(() => workspace.pages.operation.querySelector('.desktop-card > p').textContent.includes('running'));
  assert(transferMessage.textContent.includes('1 of 2') && !transferMessage.textContent.includes('Start automatic operation'), 'A later start must not leave a request to start operation in the storage receipt');
  kind = 'configuration'; state.systems[0].executing = true;
  document.querySelector('#mqtt-validate').click(); await wait(() => !document.querySelector('#mqtt-validate').disabled);
  assert(document.querySelector('#desktop-transfer-mode').textContent.startsWith('Content changed'), 'Same check chooses content mode');
  assert(!document.querySelector('#mqtt-store').disabled, 'Guided transfer is available while operation runs');
  transferring = false; document.querySelector('#mqtt-store').click();
  await wait(() => transferring); finishTransfer();
  await wait(() => !document.querySelector('#mqtt-validate').disabled);
  assert(transferMessage.textContent.includes('0 of 2') && transferMessage.dataset.tone === 'success', 'A content transfer reports the actual disabled-rule count from readback');
  assert(document.querySelector('#desktop-transfer-mode').hidden, 'The disabled-storage policy is a pre-transfer instruction');
  state.systems[0].runtime.rules[0].enabled = true;
  state.systems[0].revision++; state.systems[0].flagsContext = 'd'.repeat(64); state.sequence++; update(view);
  await wait(() => document.querySelector('#mqtt-rule-count').textContent.includes('1 of 2'));
  assert(!transferMessage.textContent.includes('rules are disabled') && transferMessage.dataset.tone !== 'success',
    'A receipt for an older disabled revision must not stay green after rules are enabled in a newer stored revision');
  assert(document.querySelector('#desktop-transfer-mode').hidden && document.querySelector('#mqtt-store').disabled,
    'A later revision invalidates the old upload assessment without authorizing another upload');
  state.systems[0].runtime.rules[0].enabled = false; state.systems[0].revision++; state.systems[0].flagsContext = 'e'.repeat(64); state.sequence++; update(view);
  kind = 'unchanged';
  document.querySelector('#mqtt-validate').click(); await wait(() => !document.querySelector('#mqtt-validate').disabled);
  assert(document.querySelector('#mqtt-store').disabled, 'Matching stored state needs no transfer');
  assert(commands.every(action => ['validate', 'store'].includes(action)), 'Checks and next actions do not start or stop operation');
  assert(commands.filter(action => action === 'store').length === 2, 'Exactly two explicit transfers');
  view.configuration.automations = [{id: 'correct-rule', name: 'Synthetic <b>rule</b>'}];
  view.desktop.draftRevision++; update(view);
  validationFailure = {issues: [
    {path: '/automations/0/conditions/1/operator', name: 'Synthetic <b>rule</b>', reason: 'capability_operator', capability: {
      system: 'Foreign system', device: 'Synthetic sensor', property: 'occupancy', label: 'Occupancy', actual: 'gt', actualType: 'string', allowed: ['eq', 'ne']}},
    {path: '/automations/0/actions/0/values', name: 'Synthetic <b>rule</b>', reason: 'capability_maximum', capability: {
      system: 'Local system', device: 'Synthetic light', property: 'brightness', label: 'Brightness', actual: '255', actualType: 'number', allowed: [], minimum: 0, maximum: 254, step: 1}}
  ], truncated: false};
  document.querySelector('#mqtt-validate').click();
  const findings = document.querySelector('#mqtt-validation-issues');
  await wait(() => findings.children.length === 2 && !document.querySelector('#mqtt-validate').disabled);
  const [comparisonIssue, valueIssue] = findings.children;
  assert(comparisonIssue.textContent.includes('Condition 2') && comparisonIssue.textContent.includes('Foreign system')
    && comparisonIssue.textContent.includes('Synthetic sensor') && comparisonIssue.textContent.includes('occupancy')
    && comparisonIssue.textContent.includes('gt') && comparisonIssue.textContent.includes('eq') && comparisonIssue.textContent.includes('ne'), 'Comparison finding must name its exact source, value and allowed operators');
  assert(valueIssue.textContent.includes('brightness') && valueIssue.textContent.includes('255') && valueIssue.textContent.includes('254'), 'Action finding must include actual value and allowed bound');
  assert(!findings.querySelector('b') && findings.textContent.includes('Synthetic <b>rule</b>'), 'Configuration labels must render as text');
  assert(document.querySelector('#mqtt-store').disabled, 'A capability failure cannot authorize transfer');
  setLanguage('de', {persist: false, report: false});
  assert(comparisonIssue.textContent.includes('Bedingung 2') && comparisonIssue.textContent.includes('ist größer als')
    && valueIssue.textContent.includes('größte zulässige Aktionswert'), 'Capability findings must follow the central language');
  let corrected;
  const correction = event => { corrected = event.detail; event.preventDefault(); };
  document.addEventListener('z2ma-open-draft-issue', correction);
  comparisonIssue.querySelector('button').click();
  assert(corrected?.kind === 'automations' && corrected.id === 'correct-rule'
    && corrected.path.join('/') === 'conditions/1/operator', 'Correct must target the affected comparison');
  valueIssue.querySelector('button').click();
  assert(corrected?.property === 'brightness' && corrected.path.join('/') === 'actions/0/values', 'Correct must identify the individual action value');
  document.removeEventListener('z2ma-open-draft-issue', correction);
  const beforeSummary = JSON.stringify(validationFailure);
  const summary = validationSummary(validationFailure);
  assert(summary.includes('255') && summary.includes('254') && summary.includes('Foreign system'), 'Editor errors must retain capability detail');
  assert(JSON.stringify(validationFailure) === beforeSummary, 'Translating findings must preserve protocol values');
  const large = structuredClone(validationFailure);
  large.issues[0].reason = 'capability_enum'; large.issues[0].capability.allowed = Array(32).fill('x'.repeat(96));
  assert(validationSummary(large).length < 3000, 'Editor error summaries must stay within the transport response bound');
  validationFailure = undefined;
  setLanguage('en', {persist: false, report: false});
  const ruleList = document.querySelector('#mqtt-rule-flags-list');
  const permission = id => ruleList.querySelector('[data-rule-id="' + id + '"]');
  const choose = (id, checked) => { const input = permission(id); input.checked = checked; input.dispatchEvent(new Event('change', {bubbles: true})); };
  const grantsMessage = document.querySelector('#mqtt-rule-flags-feedback');
  const grantStatus = async (label, tone) => {
    assert(grantsMessage.textContent.startsWith(label) && grantsMessage.dataset.tone === tone, 'Permission status must explicitly report ' + label);
    const colors = {success: ['rgb(61, 112, 88)', 'rgb(165, 199, 175)'], warning: ['rgb(131, 85, 20)', 'rgb(230, 183, 106)'], error: ['rgb(159, 40, 63)', 'rgb(240, 166, 177)']};
    const original = document.documentElement.style.colorScheme;
    for (const [index, theme] of ['light', 'dark'].entries()) {
      document.documentElement.style.colorScheme = theme;
      assert(getComputedStyle(grantsMessage).color === colors[tone][index], 'Permission status must use its desktop palette color in ' + theme);
    }
    document.documentElement.style.colorScheme = original;
  };
  assert(document.querySelector('#mqtt-rule-count').textContent.includes('0 of 2')
    && document.querySelector('#mqtt-operation-reason').textContent.includes('No automation is enabled')
    && document.querySelector('#mqtt-activate').disabled, 'Explain the zero-enabled start block beside the operation controls');
  state.systems[0].runtime.peers = ['synthetic/partner']; state.sequence++; update(view);
  await wait(() => !document.querySelector('#mqtt-activate').disabled);
  assert(document.querySelector('#mqtt-activate').textContent === 'Activate partner reception'
    && document.querySelector('#mqtt-operation-reason').textContent.includes('No local automations'), 'Saved partner grants offer an explicit receiver-only start without releasing local rules');
  state.systems[0].runtime.peers = []; state.sequence++; update(view);
  await wait(() => document.querySelector('#mqtt-activate').disabled);
  await grantStatus('Rule permissions: Confirmed', 'success');
  assert([...ruleList.querySelectorAll('strong')].map(node => node.textContent).join('|') === 'Alpha|Zulu', 'Operation rules must be alphabetical');
  choose('rule_b', true);
  await grantStatus('Rule permissions: Not confirmed', 'error');
  setLanguage('de', {persist: false, report: false});
  await grantStatus('Freigaben: Nicht bestätigt', 'error');
  assert(permission('rule_b').checked && document.querySelector('#mqtt-rule-count').textContent.includes('0 von 2'), 'Selection is pending and survives the central language switch');
  document.querySelector('#mqtt-apply-flags').click();
  await wait(() => document.querySelector('#mqtt-rule-count').textContent.includes('1 von 2') && document.querySelector('#mqtt-apply-flags').disabled);
  assert(document.querySelector('#mqtt-rule-flags-feedback').textContent.includes('Freigaben sind in Z2M bestätigt')
    && !document.querySelector('#mqtt-activate').disabled, 'Confirmed permissions unlock a separate start without starting automatically');
  await grantStatus('Freigaben: Bestätigt', 'success');
  assert(!permission('rule_a').checked && permission('rule_b').checked, 'Apply only the selected rules');
  const operationMessage = workspace.pages.operation.querySelector('.desktop-card > p');
  const beforeStatusChanges = commands.length;
  state.systems[0].executing = true; state.sequence++; update(view);
  await wait(() => operationMessage.textContent.includes('läuft'));
  assert(grantsMessage.textContent.includes('Freigaben sind in Z2M bestätigt') && !grantsMessage.textContent.includes('gestoppt'),
    'Stored-grant confirmation must not claim operation is stopped after a later start');
  setLanguage('en', {persist: false, report: false});
  assert(operationMessage.textContent.includes('running') && !grantsMessage.textContent.includes('stopped'),
    'Grant feedback and live operation must remain consistent in English');
  await grantStatus('Rule permissions: Confirmed', 'success');
  state.systems[0].fresh = false; state.sequence++; update(view);
  await wait(() => document.querySelector('#mqtt-rule-count').dataset.enabled === '');
  await grantStatus('Rule permissions: Unknown', 'warning');
  assert(!grantsMessage.textContent.includes('confirmed in Z2M'), 'An unconfirmed connection must not keep a green current-grant confirmation');
  setLanguage('de', {persist: false, report: false});
  await grantStatus('Freigaben: Unbekannt', 'warning');
  setLanguage('en', {persist: false, report: false});
  state.systems[0].fresh = true; state.systems[0].executing = false; state.sequence++; update(view);
  await wait(() => operationMessage.textContent.includes('stopped') && grantsMessage.textContent.includes('confirmed in Z2M'));
  assert(permission('rule_b').checked && commands.length === beforeStatusChanges, 'Status updates must preserve selection without issuing control requests');
  setLanguage('de', {persist: false, report: false});
  choose('rule_b', false); flagsCanceled = true;
  document.querySelector('#mqtt-apply-flags').click();
  await wait(() => document.querySelector('#mqtt-rule-flags-feedback').textContent.includes('Abgebrochen'));
  await grantStatus('Freigaben: Nicht bestätigt', 'error');
  assert(!permission('rule_b').checked && document.querySelector('#mqtt-rule-count').textContent.includes('1 von 2'), 'Cancellation preserves the pending choice and actual stored count');
  flagsCanceled = false; state.systems[0].flagsContext = 'c'.repeat(64); state.sequence++; update(view);
  await wait(() => document.querySelector('#mqtt-apply-flags').disabled);
  assert(document.querySelector('#mqtt-rule-flags').textContent.includes('Stand wurde inzwischen geändert') && !permission('rule_b').checked,
    'An external revision must not silently overwrite or rebase a pending selection');
  await grantStatus('Freigaben: Nicht bestätigt', 'error');
  document.querySelector('#mqtt-reset-flags').click();
  await grantStatus('Freigaben: Bestätigt', 'success');
  assert(permission('rule_b').checked, 'Refresh selection explicitly adopts confirmed flags');
  choose('rule_a', true);
  state.systems[0].fresh = false; state.sequence++; update(view);
  await wait(() => permission('rule_a').disabled);
  await grantStatus('Freigaben: Unbekannt', 'warning');
  assert(document.querySelector('#mqtt-rule-count').textContent.includes('noch nicht frisch bestätigt'), 'A stale read cannot claim a confirmed enabled count');
  state.systems[0].fresh = true; state.sequence++; update(view);
  await wait(() => !permission('rule_a').disabled);
  await grantStatus('Freigaben: Nicht bestätigt', 'error');
  assert(permission('rule_a').checked, 'Refreshing unchanged state preserves the selected permissions');
  state.systems[0].transferPending = true; state.sequence++; update(view);
  await wait(() => !document.querySelector('#mqtt-check-flags').hidden);
  await grantStatus('Freigaben: Unbekannt', 'warning');
  assert(document.querySelector('#mqtt-activate').disabled && document.querySelector('#mqtt-operation-reason').textContent.includes('ungeklärt'),
    'Unresolved transfer status blocks starting and offers read-only reconciliation');
  state.systems[0].transferPending = false; state.sequence++; update(view);
  await wait(() => !permission('rule_a').disabled);
  document.querySelector('#mqtt-reset-flags').click();
  await grantStatus('Freigaben: Bestätigt', 'success');
  state.systems[0].updatePending = true; state.sequence++; update(view);
  await wait(() => permission('rule_a').disabled);
  await grantStatus('Freigaben: Unbekannt', 'warning');
  state.systems[0].updatePending = false; state.sequence++; update(view);
  await wait(() => !permission('rule_a').disabled);
  await grantStatus('Freigaben: Bestätigt', 'success');
  choose('rule_a', true); flagsRejected = true;
  assert(!document.querySelector('#mqtt-apply-flags').disabled, 'After refreshing the selection, further checkbox edits must remain applicable');
  document.querySelector('#mqtt-apply-flags').click();
  await wait(() => grantsMessage.textContent.includes('Ein Wert oder Vergleich'));
  await grantStatus('Freigaben: Nicht bestätigt', 'error');
  assert(permission('rule_a').checked && document.querySelector('#mqtt-rule-count').textContent.includes('1 von 2'), 'A rejected check preserves selection and the confirmed stored count');
  state.brokers[0].state = 'disconnected'; state.sequence++; update(view);
  await wait(() => permission('rule_a').disabled);
  await grantStatus('Freigaben: Unbekannt', 'warning');
  state.brokers[0].state = 'connected'; state.sequence++; update(view);
  await wait(() => !permission('rule_a').disabled);
  await grantStatus('Freigaben: Nicht bestätigt', 'error');
  flagsRejected = false; document.querySelector('#mqtt-reset-flags').click();
  await grantStatus('Freigaben: Bestätigt', 'success');
  assert(commands.filter(action => action === 'setRuleFlags').length === 3
    && commands.every(action => ['validate', 'store', 'setRuleFlags'].includes(action)), 'Rule selection never issues activation or device commands');
  setLanguage('en', {persist: false, report: false});
  state.systems[0].executing = false;
  document.querySelector('#mqtt-install').click();
  await wait(() => installing);
  const before = polls;
  await wait(() => document.body.textContent.includes('Waiting for a confirmed Z2M restart'));
  assert(polls > before, 'Progress must poll while update is pending');
  assert(document.querySelector('#mqtt-install').disabled, 'No duplicate update while pending');
  setLanguage('de', {persist: false, report: false});
  assert(document.body.textContent.includes('Warte auf den bestätigten Z2M-Neustart'), 'Progress follows central language');
  finish(); await wait(() => !document.querySelector('#mqtt-install').disabled);
  assert(document.body.textContent.includes('Die mitgelieferte Extension ist bestätigt'), 'Completion feedback');
}
