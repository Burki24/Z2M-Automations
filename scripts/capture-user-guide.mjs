// Run only after explicit permission for the current documentation task.
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {basename, dirname, extname, join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {guideModel, installGuideBridge} from './user-guide-fixture.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
if (!process.argv.includes('--approved')) throw new Error('Explicit user permission for this task is required before capturing the app.');
if (!process.versions.electron) {
  const profile = await mkdtemp(join(tmpdir(), 'z2ma-guide-'));
  const env = {...process.env, Z2MA_GUIDE_PROFILE: profile}; delete env.ELECTRON_RUN_AS_NODE;
  try {
    const child = spawn(require('electron'), [fileURLToPath(import.meta.url), '--approved'], {cwd: root, env, windowsHide: true, stdio: 'inherit'});
    const timer = setTimeout(() => child.kill(), 120000);
    try { const code = await new Promise((done, reject) => { child.once('error', reject); child.once('exit', done); }); if (code !== 0) throw new Error('User guide capture failed.'); }
    finally { clearTimeout(timer); }
  } finally {
    if (dirname(resolve(profile)) !== resolve(tmpdir()) || !basename(profile).startsWith('z2ma-guide-')) throw new Error('Unexpected guide profile.');
    await rm(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 100});
  }
} else {
  async function capture() {
  const {app, BrowserWindow, protocol, nativeTheme} = await import('electron');
  // Deterministic documentation rasterization; does not change normal app rendering.
  app.disableHardwareAcceleration();
  const {assetPath, csp, rendererPreferences} = require('../apps/desktop/.build/security.js');
  const {confirmationScript} = require('../apps/desktop/.build/confirmation.js');
  const {partnerOverview} = require('../apps/desktop/.build/partner-overview.js');
  app.setPath('userData', process.env.Z2MA_GUIDE_PROFILE);
  protocol.registerSchemesAsPrivileged([{scheme: 'z2ma', privileges: {standard: true, secure: true, supportFetchAPI: true}}]);
  await app.whenReady(); nativeTheme.themeSource = 'light';
  const assets = join(root, 'apps/desktop/.build/renderer');
  const manifest = JSON.parse(await readFile(join(assets, 'manifest.json'), 'utf8').catch(() => readFile(join(root, 'packages/designer/dist/manifest.json'), 'utf8')));
  const metadata = JSON.parse(await readFile(join(root, 'version.json'), 'utf8'));
  const {readdir} = await import('node:fs/promises');
  const names = new Set((await readdir(assets)).filter(name => /\.(js|css|svg|png|html)$/.test(name)));
  protocol.handle('z2ma', async request => {
    const name = assetPath(request.url, request.method, names);
    if (!name) return new Response(null, {status: 404});
    let bytes = await readFile(join(assets, name));
    if (name === 'index.html') bytes = bytes.toString('utf8').replace('<script type="module" src="desktop.js"></script>', '');
    const type = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png'}[extname(name)];
    return new Response(bytes, {headers: {'Content-Type': type, 'Content-Security-Policy': csp}});
  });
  const window = new BrowserWindow({show: false, width: 1600, height: 1100, webPreferences: {...rendererPreferences, backgroundThrottling: false}});
  window.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  const view = window.webContents;
  const evaluate = code => view.executeJavaScript(code);
  const pause = ms => new Promise(done => setTimeout(done, ms));
  const waitFor = async expression => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) { if (await evaluate('Boolean(' + expression + ')')) return; await pause(40); }
    throw new Error('Documentation state did not settle: ' + expression);
  };
  const results = [];
  try {
    for (const language of ['de', 'en']) {
      window.setContentSize(1600, 1100);
      const model = guideModel(language, metadata.version);
      model.view.partnerPermissions = partnerOverview(model.projectState.project, {current: id => {
        const system = model.projectState.project.systems.find(system => system.id === id);
        return {fresh: true, configuration: system.configuration, status: {executing: id === 'example-a', activeMatches: true}};
      }});
      const destination = join(root, 'docs/images', language); await mkdir(destination, {recursive: true});
      await window.loadURL('z2ma://app/index.html');
      await evaluate('(' + installGuideBridge + ')(' + JSON.stringify(model) + ',' + JSON.stringify(language) + ')');
      await waitFor("document.querySelector('#desktop-nav-automations') && document.querySelector('#entry-list .entry') && document.querySelector('#desktop-theme')");
      const take = async (name, selector) => {
        await pause(160);
        await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        const state = await evaluate(`({language:document.documentElement.lang, picker:document.querySelector('#designer-language')?.value, width:innerWidth,height:innerHeight})`);
        if (state.language !== language || state.picker !== language) throw new Error('Screenshot language mismatch.');
        let rectangle;
        if (selector) rectangle = await evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:Math.max(0,Math.floor(r.x)),y:Math.max(0,Math.floor(r.y)),width:Math.min(innerWidth-Math.max(0,Math.floor(r.x)),Math.ceil(r.width)),height:Math.min(innerHeight-Math.max(0,Math.floor(r.y)),Math.ceil(r.height))}; })()`);
        if (!selector && ['08-check-draft', '09-transfer'].includes(name)) rectangle = await evaluate(`(() => { const card=document.querySelector(${JSON.stringify(name === '08-check-draft' ? '#desktop-draft-review' : '#desktop-transfer-target')}); const r=(card.closest('section')??card).getBoundingClientRect(); return {x:0,y:0,width:innerWidth,height:Math.min(innerHeight,Math.ceil(r.bottom+24))}; })()`);
        const capture = await view.capturePage(rectangle);
        const bytes = capture.toPNG();
        if (capture.isEmpty() || bytes.length < 1000) throw new Error('Empty documentation capture: ' + JSON.stringify({name, rectangle, size: capture.getSize(), bytes: bytes.length}));
        await writeFile(join(destination, name + '.png'), bytes);
        results.push({language, file: `images/${language}/${name}.png`, ...capture.getSize(), bytes: bytes.length});
        console.log('GUIDE_CAPTURE ' + language + '/' + name);
      };
      const step = async name => { await evaluate(`document.querySelector('#desktop-nav-${name}').click()`); await pause(80); };
      window.setContentSize(1920, 1280);
      await waitFor('innerWidth===1920 && innerHeight===1280');
      await take('01-workspace');
      window.setContentSize(1600, 1100);
      await waitFor('innerWidth===1600 && innerHeight===1100');
      for (const [page, name] of [['project', '02-project'], ['broker', '03-broker'], ['system', '04-systems'], ['connection', '05-read-inventory'], ['draft', '06-working-copy']]) {
        await step(page);
        if (page === 'broker') await evaluate("document.querySelector('#project-brokerChoice').value='example-a'; document.querySelector('#project-brokerChoice').dispatchEvent(new Event('change'))");
        if (page === 'system') {
          window.setContentSize(1100, 1000);
          await waitFor('innerWidth===1100 && innerHeight===1000');
          await evaluate("document.querySelector('#project-systemChoice').value='example-a'; document.querySelector('#project-systemChoice').dispatchEvent(new Event('change')); document.querySelector('#project-system-form').scrollIntoView({block:'center'})");
          await waitFor("document.querySelector('#project-system-form').getBoundingClientRect().top>=0 && document.querySelector('#project-system-form').getBoundingClientRect().bottom<=innerHeight");
        }
        if (page === 'connection') {
          await evaluate("window.guideModel.view.devices=window.guideModel.view.devices.filter(device=>!device.target.system); window.guideRefresh()");
          await waitFor("document.querySelectorAll('#mqtt-catalog-device li').length===5");
        }
        await take(name, page === 'system' ? '#project-system-form' : undefined);
        if (page === 'system') { window.setContentSize(1600, 1100); await waitFor('innerWidth===1600 && innerHeight===1100'); }
        if (page === 'connection') {
          await evaluate('window.guideModel.view.devices=' + JSON.stringify(model.view.devices) + '; window.guideRefresh()');
          await pause(100);
        }
      }
      await step('automations');
      await evaluate("document.querySelector('[data-entry=\"rule:hall-on\"]')?.click(); document.querySelector('#draft-wizard-start').click()");
      await waitFor("document.querySelector('.edit-dialog[open], dialog[open]')");
      await take('07-new-automation', 'dialog[open]');
      await evaluate("document.querySelector('dialog[open]').close()");
      for (const [rule, name] of [['hall-on', '13-motion-trigger'], ['hall-off', '14-absence-duration'], ['terrace-toggle', '15-remote-action']]) {
        await evaluate(`document.querySelector('[data-entry="rule:${rule}"]').click(); document.querySelector('#edit-automation-button').click()`);
        await waitFor("document.querySelector('dialog[open]')");
        if (rule === 'terrace-toggle') await evaluate("document.querySelector('dialog[open] [data-section=actions]').open=true; document.querySelector('dialog[open] [data-section=actions]').scrollIntoView({block:'center'})");
        await take(name, rule === 'terrace-toggle' ? 'dialog[open] [data-section=actions]' : 'dialog[open]');
        await evaluate("document.querySelector('dialog[open]').close()");
      }
      await evaluate(`(() => { const d=window.guideModel.view; const r=d.configuration.automations[0]; d.draftSync={...d.draftSync,operation:'dddddddddddddddddddddddddddddddd',phase:'conflict',canReplace:true,counts:{added:0,changed:1,removed:0},conflicts:[{key:'automations:hall-on',kind:'automations',name:r.name,local:structuredClone(r),remote:{...structuredClone(r),name:r.name+' (Z2M)',actions:[{...r.actions[0],values:{state:'OFF'}}]},base:structuredClone(r)}]}; window.guideRefresh(); })()`);
      await waitFor("document.querySelector('#symcon-draft-sync fieldset')");
      await take('16-merge-conflict');
      await evaluate("window.guideModel.view.draftSync.phase='current'; window.guideModel.view.draftSync.conflicts=[]; window.guideModel.view.draftSync.operation=''; window.guideRefresh()");
      await step('review');
      await evaluate("document.querySelector('#mqtt-validate').click()");
      await waitFor("!document.querySelector('#mqtt-store').disabled");
      await take('08-check-draft');
      await step('transfer'); await take('09-transfer');
      await step('operation'); await take('10-operation');
      await evaluate("document.querySelector('#mqtt-rule-flags').scrollIntoView({block:'start'})"); await take('11-release-rules');
      await window.loadURL('z2ma://app/confirmation.html');
      window.setContentSize(540, 430);
      const catalog = JSON.parse(await readFile(join(root, 'packages/designer/src/locales', language + '.json'), 'utf8'));
      const values = {system: model.view.desktop.systemName, topic: 'house', broker: model.projectState.project.brokers[0].name,
        revision: 11, next: 12, rules: 4, added: 1, changed: 1, removed: 0, enabled: 1, names: '• ' + model.view.configuration.automations[0].name};
      const message = key => catalog['project.' + key].replace(/\{\{(\w+)\}\}/g, (_, field) => String(values[field] ?? ''));
      const options = {language, question: message('transferStoreConfirm'),
        detail: ['transferStoreDetail', 'transferStoreConfiguration', 'transferStoreStop'].map(message).join('\n'),
        cancel: message('cancel'), accept: message('continue'), resume: {enabled: true, label: message('transferResumePrevious'),
          help: message('transferResumeHelp'), detail: message('transferResumeDetail')}};
      void evaluate(confirmationScript(options)).catch(() => {});
      await waitFor("document.querySelector('#question').textContent.length>0");
      if (await evaluate('document.documentElement.lang') !== language) throw new Error('Confirmation screenshot language mismatch.');
      await pause(160);
      const image = await view.capturePage();
      await writeFile(join(destination, '12-transfer-confirmation.png'), image.toPNG());
      results.push({language, file: `images/${language}/12-transfer-confirmation.png`, ...image.getSize(), bytes: image.toPNG().length});
    }
    await writeFile(join(root, 'docs/images/manifest.json'), JSON.stringify({version: metadata.version, designer: manifest.content, platform: process.platform,
      viewport: [1600, 1100], purpose: 'Authorized app-only user guide captures with synthetic data; no real network or device commands.', screenshots: results}, null, 2) + '\n');
    console.log('GUIDE_CAPTURES_OK ' + results.length);
  } finally { window.destroy(); app.quit(); }
  }
  void capture().catch(async error => { console.error(error); (await import('electron')).app.exit(1); });
}
