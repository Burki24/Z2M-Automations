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
    const timer = setTimeout(() => child.kill(), 30000);
    try {
      const code = await new Promise((done, reject) => { child.once('error', reject); child.once('close', done); });
      if (code !== 0) throw new Error('Extension update DOM test failed: ' + code);
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
    await app.whenReady();
    const assets = join(root, 'apps/desktop/.build/renderer');
    const names = new Set(['network.js', 'operation-flags.js', 'draft-review.js', 'localization.js', 'transport.js', 'locales.js', 'designer.css', 'desktop-palette.css', 'desktop.css', 'confirmation.css', 'confirmation.html']);
    protocol.handle('z2ma', async request => {
      if (request.url === 'z2ma://app/index.html') return new Response('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="designer.css"><link rel="stylesheet" href="desktop-palette.css"><link rel="stylesheet" href="desktop.css"><body class="desktop-foundation"></body>', {headers: {'Content-Type': 'text/html', 'Content-Security-Policy': csp}});
      const name = assetPath(request.url, request.method, names);
      if (!name) return new Response(null, {status: 404});
      return new Response(await readFile(join(assets, name)), {headers: {'Content-Type': extname(name) === '.css' ? 'text/css' : extname(name) === '.html' ? 'text/html' : 'application/javascript', 'Content-Security-Policy': csp}});
    });
    const window = new BrowserWindow({show: false, width: 1000, height: 800, webPreferences: {...rendererPreferences, backgroundThrottling: false}});
    await window.loadURL('z2ma://app/index.html');
    await window.webContents.executeJavaScript('(' + rendererTest + ')()');
    await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('#mqtt-rule-flags');
      for (const child of document.body.children) if (!child.contains(panel)) child.hidden = true;
      const list = panel.querySelector('ul'); const row = list.firstElementChild;
      for (let index = 0; index < 40; index++) {
        const copy = row.cloneNode(true); copy.querySelector('strong').textContent = 'Synthetic long automation name '.repeat(6); list.append(copy);
      }
    })()`);
    for (const width of [360, 1280]) for (const theme of ['light', 'dark']) {
      window.setContentSize(width, 800);
      await window.webContents.executeJavaScript(`(async () => {
        document.documentElement.style.colorScheme = '${theme}';
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const panel = document.querySelector('#mqtt-rule-flags'); const list = panel.querySelector('ul');
        if (panel.getBoundingClientRect().right > innerWidth + 1 || document.scrollingElement.scrollWidth > innerWidth + 1) throw new Error('Rule permissions overflow the workspace');
        if (list.scrollHeight <= list.clientHeight || getComputedStyle(list).overflowY !== 'auto') throw new Error('Rule selection needs its own bounded scroll area');
        list.scrollTop = list.scrollHeight;
        if (Math.abs(list.scrollTop + list.clientHeight - list.scrollHeight) > 1) throw new Error('The last rule must remain reachable');
        const input = list.querySelector('input'); input.focus();
        if (document.activeElement !== input || input.getBoundingClientRect().width < 18) throw new Error('Rule checkboxes must remain keyboard accessible');
      })()`);
    }
    await window.loadURL('z2ma://app/confirmation.html');
    for (const width of [320, 540]) for (const theme of ['light', 'dark']) {
      window.setContentSize(width, 310);
      await window.webContents.executeJavaScript(`(async () => {
        document.documentElement.style.colorScheme = '${theme}';
        document.querySelector('#question').textContent = 'Extension installieren und Zigbee2MQTT neu starten?';
        document.querySelector('#detail').textContent = ${JSON.stringify('Synthetic target · Broker (127.0.0.1:1883) · Build old → new. '.repeat(12))};
        document.querySelector('#cancel').textContent = 'Abbrechen'; document.querySelector('#accept').textContent = 'Fortfahren';
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const footer = document.querySelector('footer').getBoundingClientRect();
        if (footer.bottom > innerHeight + 1 || footer.top < 0) throw new Error('Confirmation buttons outside viewport');
        const detail = document.querySelector('#detail');
        if (detail.scrollHeight <= detail.clientHeight) throw new Error('Long update review needs its own scroll area');
        detail.scrollTop = detail.scrollHeight;
        if (document.scrollingElement.scrollTop !== 0) throw new Error('Confirmation body must not scroll');
      })()`);
    }
    window.destroy(); console.log('EXTENSION_UPDATE_DOM_OK progress/de/en/automatic-draft-check/guided-transfer/capability-findings/operation-flags/confirmation-layout'); app.exit(0);
  };
  run().catch(error => { console.error('EXTENSION_UPDATE_DOM_FAILED ' + error.stack); app.exit(1); });
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
  const state = {sequence: 0, brokers: [{id: 'broker', state: 'connected'}], systems: [{id, brokerId: 'broker', name: 'Synthetic', baseTopic: 'synthetic', fresh: true, stored: true,
    flagsContext: 'a'.repeat(64), devices: 0, scenes: 0, executing: false, runtime: {resume: true, recovery: 'stopped', runs: [], rules: [
      {id: 'rule_a', name: 'Zulu', enabled: false}, {id: 'rule_b', name: 'Alpha', enabled: false}]}}], extensionUpdates: []};
  let finish, installing = false, polls = 0, view, finishTransfer, transferring = false, kind = 'flags', validationFailure, flagsCanceled = false;
  const commands = [];
  const bridge = {snapshot: async () => structuredClone(view), designer: async () => ({ok: true}), network: async ({action, enabled, context}) => {
    if (action === 'status') { polls++; return {ok: true, state: structuredClone(state)}; }
    commands.push(action);
    if (action === 'setRuleFlags') {
      assert(context === state.systems[0].flagsContext, 'Submit the displayed stored-state context');
      if (flagsCanceled) return {ok: true, state: {...structuredClone(state), outcome: 'transferCanceled'}};
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
  kind = 'configuration'; state.systems[0].executing = true;
  document.querySelector('#mqtt-validate').click(); await wait(() => !document.querySelector('#mqtt-validate').disabled);
  assert(document.querySelector('#desktop-transfer-mode').textContent.startsWith('Content changed'), 'Same check chooses content mode');
  assert(!document.querySelector('#mqtt-store').disabled, 'Guided transfer is available while operation runs');
  kind = 'unchanged';
  document.querySelector('#mqtt-validate').click(); await wait(() => !document.querySelector('#mqtt-validate').disabled);
  assert(document.querySelector('#mqtt-store').disabled, 'Matching stored state needs no transfer');
  assert(commands.every(action => ['validate', 'store'].includes(action)), 'Checks and next actions do not start or stop operation');
  assert(commands.filter(action => action === 'store').length === 1, 'Exactly one explicit transfer');
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
  assert(document.querySelector('#mqtt-rule-count').textContent.includes('0 of 2')
    && document.querySelector('#mqtt-operation-reason').textContent.includes('No automation is enabled')
    && document.querySelector('#mqtt-activate').disabled, 'Explain the zero-enabled start block beside the operation controls');
  assert([...ruleList.querySelectorAll('strong')].map(node => node.textContent).join('|') === 'Alpha|Zulu', 'Operation rules must be alphabetical');
  choose('rule_b', true);
  setLanguage('de', {persist: false, report: false});
  assert(permission('rule_b').checked && document.querySelector('#mqtt-rule-count').textContent.includes('0 von 2'), 'Selection is pending and survives the central language switch');
  document.querySelector('#mqtt-apply-flags').click();
  await wait(() => document.querySelector('#mqtt-rule-count').textContent.includes('1 von 2') && document.querySelector('#mqtt-apply-flags').disabled);
  assert(document.querySelector('#mqtt-rule-flags-feedback').textContent.includes('Freigaben sind in Z2M bestätigt')
    && !document.querySelector('#mqtt-activate').disabled, 'Confirmed permissions unlock a separate start without starting automatically');
  assert(!permission('rule_a').checked && permission('rule_b').checked, 'Apply only the selected rules');
  choose('rule_b', false); flagsCanceled = true;
  document.querySelector('#mqtt-apply-flags').click();
  await wait(() => document.querySelector('#mqtt-rule-flags-feedback').textContent.includes('Abgebrochen'));
  assert(!permission('rule_b').checked && document.querySelector('#mqtt-rule-count').textContent.includes('1 von 2'), 'Cancellation preserves the pending choice and actual stored count');
  flagsCanceled = false; state.systems[0].flagsContext = 'c'.repeat(64); state.sequence++; update(view);
  await wait(() => document.querySelector('#mqtt-apply-flags').disabled);
  assert(document.querySelector('#mqtt-rule-flags').textContent.includes('Stand wurde inzwischen geändert') && !permission('rule_b').checked,
    'An external revision must not silently overwrite or rebase a pending selection');
  document.querySelector('#mqtt-reset-flags').click();
  assert(permission('rule_b').checked, 'Refresh selection explicitly adopts confirmed flags');
  choose('rule_a', true);
  state.systems[0].fresh = false; state.sequence++; update(view);
  await wait(() => permission('rule_a').disabled);
  assert(document.querySelector('#mqtt-rule-count').textContent.includes('noch nicht frisch bestätigt'), 'A stale read cannot claim a confirmed enabled count');
  state.systems[0].fresh = true; state.sequence++; update(view);
  await wait(() => !permission('rule_a').disabled);
  assert(permission('rule_a').checked, 'Refreshing unchanged state preserves the selected permissions');
  state.systems[0].transferPending = true; state.sequence++; update(view);
  await wait(() => !document.querySelector('#mqtt-check-flags').hidden);
  assert(document.querySelector('#mqtt-activate').disabled && document.querySelector('#mqtt-operation-reason').textContent.includes('ungeklärt'),
    'Unresolved transfer status blocks starting and offers read-only reconciliation');
  state.systems[0].transferPending = false; state.sequence++; update(view);
  await wait(() => !permission('rule_a').disabled);
  document.querySelector('#mqtt-reset-flags').click();
  assert(commands.filter(action => action === 'setRuleFlags').length === 2
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
