import type {WebContents} from 'electron';
import {readFile} from 'node:fs/promises';
import {importDraft} from './draft-exchange.js';

export async function smokeDrafts(view: WebContents, exportPath: string): Promise<void> {
  await view.executeJavaScript(`(async () => {
    const bridge = window.z2maDesktop;
    const wait = async predicate => { for (let n = 0; n < 160; n++) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 30)); } throw new Error('Draft UI timeout'); };
    const assert = (value, message) => { if (!value) throw new Error('Draft smoke: ' + message); };
    const project = (await bridge.project({action: 'status'})).state.project;
    const systemId = project.systems[0].id;
    await bridge.selectSystem(systemId);
    await bridge.network({action: 'connect', id: project.systems[0].brokerId});
    await wait(async () => (await bridge.network({action: 'status', id: ''})).state.systems[0].fresh);
    const data = await bridge.snapshot(); const ctx = data.workspaceContext;
    const command = (route, payload) => bridge.designer({route, systemId, generation: ctx.generation, fingerprint: ctx.fingerprint,
      payload: {requestId: crypto.randomUUID(), context: data.createContext, ...payload}});
    const result = await command('create', {rule: {name: 'D4 smoke rule', retrigger: 'ignore', restart_policy: 'abort',
      triggers: [{type: 'time', at: '18:00:00', timezone: 'Europe/Berlin'}], conditions: [],
      actions: [{type: 'set', target: {type: 'device', id: '0x0000000000000002'}, values: {state: 'ON'}}]}});
    assert(result.ok, JSON.stringify(result));
    const after = await bridge.snapshot(); const created = after.configuration.automations.find(rule => rule.id === result.state.ruleId);
    assert(created && !created.enabled && !after.configuration.automations.some(rule => rule.name === 'Synthetic remote rule'), 'new draft replaced source or enabled rule');
    assert(!(await command('create', {rule: {}})).ok, 'stale/invalid editor accepted');
    document.dispatchEvent(new Event('z2ma-project-changed'));
    await wait(() => [...document.querySelectorAll('#entry-list .entry')].some(element => element.textContent.includes('D4 smoke rule')));
    [...document.querySelectorAll('#entry-list .entry')].find(element => element.textContent.includes('D4 smoke rule')).click();
    await wait(() => document.querySelector('#entry-title').textContent === 'D4 smoke rule');
    document.querySelector('#edit-automation-button').click();
    await wait(() => document.querySelector('#edit-dialog').open);
    const name = document.querySelector('#edit-fields input'); name.value = 'D4 preserved input'; name.dispatchEvent(new Event('input', {bubbles: true}));
    const picker = document.querySelector('#designer-language'); picker.value = 'de'; picker.dispatchEvent(new Event('change', {bubbles: true}));
    await wait(() => document.documentElement.lang === 'de');
    assert(name.value === 'D4 preserved input', 'language lost draft');
    await wait(() => Object.keys(sessionStorage).some(key => key.startsWith('z2ma.desktop.editor.') && sessionStorage.getItem(key).includes('D4 preserved input')));
  })()`);
  const loaded = new Promise<void>(resolve => view.once('did-finish-load', resolve)); view.reload(); await loaded;
  await view.executeJavaScript(`(async () => {
    const bridge = window.z2maDesktop;
    const wait = async (predicate, message = 'Recovered draft timeout') => { for (let n = 0; n < 160; n++) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 30)); } throw new Error(message); };
    await wait(() => document.querySelector('#edit-dialog')?.open && document.querySelector('#edit-fields input')?.value === 'D4 preserved input');
    if ((await bridge.project({action: 'save'})).ok) throw new Error('Open editor was silently omitted from save');
    document.querySelector('#edit-submit').click();
    await wait(async () => (await bridge.snapshot()).configuration.automations.some(rule => rule.name === 'D4 preserved input'));
    await wait(() => !document.querySelector('#edit-dialog').open);
    await wait(() => !Object.keys(sessionStorage).some(key => key.startsWith('z2ma.desktop.editor.')));
    const data = await bridge.snapshot(); const context = data.workspaceContext;
    const result = await bridge.designer({route: 'sequence', systemId: context.systemId, generation: context.generation, fingerprint: context.fingerprint,
      payload: {requestId: crypto.randomUUID(), context: data.createContext, sequenceId: '', changes: {name: 'D4 sequence', actions: [
        {type: 'scene', target: {type: 'device', id: '0x0000000000000002'}, endpoint: 1, scene_id: 1, delay_seconds: 1}]}}});
    if (!result.ok) throw new Error('Sequence not saved: ' + JSON.stringify(result));
    const stored = (await bridge.project({action: 'status'})).state.project.systems[0].stored;
    if (stored.configuration.automations[0].name !== 'Synthetic remote rule') throw new Error('Local edit changed stored state');
    const assert = (value, message) => { if (!value) throw new Error('Draft form smoke: ' + message); };
    assert((await bridge.network({action: 'view', id: context.systemId, source: 'stored'})).ok, 'select stored view');
    document.dispatchEvent(new Event('z2ma-project-changed'));
    await wait(() => document.body.classList.contains('desktop-stored-view'));
    document.querySelector('#draft-wizard-start').click();
    await wait(() => document.querySelector('#edit-dialog').open);
    const click = id => document.querySelector('#edit-' + id).click();
    const set = (element, value) => {
      element.value = value;
      element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true}));
    };
    assert((await bridge.snapshot()).desktop.source === 'draft', 'form did not switch to draft');
    const sections = [...document.querySelectorAll('#edit-fields details[data-section]')];
    assert(sections[0].open && !sections[1].open && sections[2].open, 'form sections not initially arranged for entry');
    click('export');
    const name = () => document.querySelector('#edit-fields input');
    assert(name().getAttribute('aria-invalid') === 'true' && document.activeElement === name(), 'missing name not marked and focused');
    set(name(), 'Form smoke rule');
    set(document.querySelector('[data-section="triggers"] fieldset select'), 'time');
    set(document.querySelector('[data-section="actions"] fieldset select'), 'sequence');
    set(document.querySelectorAll('[data-section="actions"] fieldset select')[1], result.state.sequenceId);
    const beforeExport = (await bridge.snapshot()).configuration;
    click('export');
    await wait(() => !document.querySelector('#edit-export').disabled, 'Direct YAML export did not complete');
    assert(document.querySelector('#edit-message').textContent.includes('YAML-Datei gespeichert.'),
      'unexpected export status: ' + document.querySelector('#edit-message').textContent);
    assert(document.querySelector('#edit-dialog').open && name().value === 'Form smoke rule', 'export closed or cleared the form');
    assert(JSON.stringify((await bridge.snapshot()).configuration) === JSON.stringify(beforeExport), 'export changed the local draft');
    assert((await bridge.project({action: 'draft', systemId: context.systemId, operation: 'new', ruleId: '', name: 'Concurrent draft'})).ok, 'simulate a changed draft');
    click('export');
    await wait(() => !document.querySelector('#edit-reload').hidden && !document.querySelector('#edit-reload').disabled);
    assert(document.querySelector('#edit-dialog').open && document.querySelector('#edit-submit').disabled && document.querySelector('#edit-export').disabled, 'form did not pause on stale context');
    click('reload');
    await wait(() => !document.querySelector('#edit-submit').disabled);
    assert(name().value === 'Form smoke rule', 'refresh lost form input');
    click('export');
    await wait(() => !document.querySelector('#edit-export').disabled);
    assert(document.querySelector('#edit-message').textContent.includes('Concurrent draft'), 'export omitted the invalid existing rule');
    click('submit');
    await wait(async () => (await bridge.snapshot()).configuration.automations.some(rule => rule.name === 'Form smoke rule' && !rule.enabled));
    await wait(() => !document.querySelector('#edit-dialog').open);
    await wait(() => !Object.keys(sessionStorage).some(key => key.startsWith('z2ma.desktop.editor.')));
    const review = document.querySelector('#desktop-draft-review');
    const check = document.querySelector('#mqtt-validate');
    const transfer = document.querySelector('#mqtt-store');
    const message = document.querySelector('#desktop-review-message');
    const findings = document.querySelector('#mqtt-validation-issues');
    const project = (await bridge.project({action: 'status'})).state.project;
    const brokerId = project.systems[0].brokerId;
    const picker = document.querySelector('#designer-system');
    const connected = () => document.querySelector('#desktop-connection').dataset.connected === 'true';
    const disconnect = async () => {
      assert((await bridge.network({action: 'disconnect', id: brokerId})).ok, 'disconnect before local check');
      document.dispatchEvent(new Event('z2ma-project-changed'));
      await wait(() => !connected() && !document.querySelector('#mqtt-connect').hidden);
    };
    const connect = async () => {
      document.querySelector('#mqtt-connect').click();
      await wait(async () => connected() && (await bridge.snapshot()).status.confirmed && !review.hasAttribute('aria-busy'), 'Inline connection did not read the selected system');
    };
    const checkDraft = async () => {
      await wait(() => !check.disabled && !picker.disabled);
      check.click();
      await wait(() => !review.hasAttribute('aria-busy'), 'Draft check did not finish');
    };
    await disconnect();
    assert(transfer.disabled, 'the transfer is offered only after a successful Z2M check');
    await checkDraft();
    assert(!findings.hidden && !document.querySelector('#desktop-view-automations').hidden, 'validation must remain in Automations: ' + message.textContent);
    const incompleteRule = [...findings.children].map(row => row.textContent).filter(line => line.includes('Concurrent draft'));
    assert(incompleteRule.length === 2 && incompleteRule.some(line => line.includes('Füge mindestens einen Auslöser hinzu.'))
      && incompleteRule.some(line => line.includes('Füge mindestens eine Aktion hinzu.')), 'validation omitted the older rule or its missing entries');
    picker.value = project.systems[1].id; picker.dispatchEvent(new Event('change'));
    await wait(async () => !picker.disabled && findings.hidden && (await bridge.snapshot()).workspaceContext.systemId === project.systems[1].id);
    picker.value = context.systemId; picker.dispatchEvent(new Event('change'));
    await wait(async () => !picker.disabled && (await bridge.snapshot()).workspaceContext.systemId === context.systemId);
    await checkDraft();
    await connect();
    const correction = [...findings.children].find(row => row.textContent.includes('Füge mindestens einen Auslöser hinzu.')).querySelector('button');
    correction.click();
    await wait(() => document.querySelector('#edit-dialog').open, 'The result did not open the correct draft');
    assert(name().value === 'Concurrent draft' && document.activeElement.closest('[data-section]')?.dataset.section === 'triggers'
      && document.activeElement.dataset.draftField === 'add', 'correction should focus Add trigger in the affected draft');
    document.activeElement.click();
    set(document.querySelector('[data-section="triggers"] fieldset select'), 'time');
    document.querySelector('[data-section="actions"] [data-draft-field="add"]').click();
    set(document.querySelector('[data-section="actions"] fieldset select'), 'sequence');
    set(document.querySelector('[data-section="actions"] [data-draft-field="type"]').closest('fieldset').querySelectorAll('select')[1], result.state.sequenceId);
    click('submit');
    await wait(() => !document.querySelector('#edit-dialog').open && findings.hidden);
    assert(transfer.disabled, 'editing alone does not authorize a transfer');
    await disconnect();
    await checkDraft();
    assert(message.textContent.includes('Entwurf lokal geprüft.') && transfer.disabled, 'an offline check must explain the next step: ' + message.textContent);
    await connect();
    await checkDraft();
    assert(message.textContent.includes('hat den Entwurf') && !transfer.disabled, 'the Z2M check must unlock the separate transfer: ' + message.textContent);
    assert(JSON.stringify((await bridge.project({action: 'status'})).state.project.systems[0].stored) === JSON.stringify(stored), 'review changed stored Zigbee2MQTT data');
    const corrected = (await bridge.snapshot()).configuration.automations.find(rule => rule.name === 'Concurrent draft');
    await bridge.project({action: 'draft', systemId: context.systemId, operation: 'rename', ruleId: corrected.id, name: 'Corrected draft'});
    document.dispatchEvent(new Event('z2ma-project-changed'));
    await wait(() => transfer.disabled && message.textContent.includes('hat sich geändert.'));
  })()`);
  const yaml = importDraft(await readFile(exportPath));
  const [existing, added] = yaml.automations;
  const actions = added?.['actions'];
  if (yaml.automations.length !== 2 || existing?.['name'] !== 'D4 preserved input' || added?.['name'] !== 'Form smoke rule' || added['enabled'] !== false
    || !Array.isArray(actions) || (actions[0] as {sequence_id?: string} | undefined)?.sequence_id !== yaml.sequences[0]?.['id']) {
    throw new Error('Exported YAML lost the existing rule, new disabled rule or sequence');
  }
  console.log('DESKTOP_DRAFTS_OK local/editor/reload/language/sequence/yaml-export/scoped-review/correction/separate-transfer');
}
