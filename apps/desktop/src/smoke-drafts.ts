import {BrowserWindow, type WebContents} from 'electron';
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
    const picker = document.querySelector('#designer-language'); picker.value = 'de'; picker.dispatchEvent(new Event('change', {bubbles: true}));
    await wait(() => document.documentElement.lang === 'de');
    document.querySelector('#edit-automation-button').click();
    await wait(() => document.querySelector('#edit-dialog').open);
    assert(document.querySelector('#edit-submit').textContent === 'Änderungen in den Entwurf übernehmen', 'the editor uses the header language');
    const name = document.querySelector('#edit-fields input'); name.value = 'D4 preserved input'; name.dispatchEvent(new Event('input', {bubbles: true}));
    document.querySelector('[data-section="triggers"] [data-draft-field="add"]').click();
    const sourceType = document.querySelectorAll('[data-section="triggers"] > fieldset')[1].querySelector('select');
    assert([...sourceType.options].map(option => option.textContent).join('|') === 'Gerätestatus|Messwert|Uhrzeit|Sonnenaufgang|Sonnenuntergang', 'five understandable trigger choices');
    sourceType.value = 'measurement'; sourceType.dispatchEvent(new Event('change', {bubbles: true}));
    await wait(() => Object.keys(sessionStorage).some(key => key.startsWith('z2ma.desktop.editor.')
      && sessionStorage.getItem(key).includes('D4 preserved input')
      && JSON.parse(sessionStorage.getItem(key)).working.triggers.length === 2));
  })()`);
  const window = BrowserWindow.fromWebContents(view);
  if (!window) throw new Error('Draft smoke requires a desktop window.');
  const {width, height} = window.getContentBounds();
  try {
    for (const [w, h] of [[width, height], [360, 500]] as const) {
      window.setContentSize(w, h);
      await view.executeJavaScript(`(async () => {
        const narrow = ${w <= 700};
        for (let attempt = 0; (innerWidth <= 700) !== narrow && attempt < 60; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        if ((innerWidth <= 700) !== narrow) throw new Error('Draft dialog viewport did not resize.');
        const dialog = document.querySelector('#edit-dialog');
        const content = dialog.querySelector('#edit-content');
        const footer = dialog.querySelector('.dialog-actions');
        const top = footer.getBoundingClientRect().top;
        if (!content || content.clientHeight < 60 || dialog.scrollHeight > dialog.clientHeight + 1) {
          throw new Error('The draft form must scroll inside the dialog, above its footer.');
        }
        content.scrollTop = content.scrollHeight;
        if ((narrow && !content.scrollTop) || footer.getBoundingClientRect().top !== top
          || content.getBoundingClientRect().bottom > top + 1
          || footer.getBoundingClientRect().bottom > dialog.getBoundingClientRect().bottom + 1
          || content.querySelector('[data-section="settings"] > summary').getBoundingClientRect().bottom > top + 1) {
          throw new Error('The draft footer must stay visible and leave the last form content reachable.');
        }
        content.scrollTop = 0;
      })()`);
    }
  } finally {
    window.setContentSize(width, height);
  }
  const loaded = new Promise<void>(resolve => view.once('did-finish-load', resolve)); view.reload(); await loaded;
  await view.executeJavaScript(`(async () => {
    const bridge = window.z2maDesktop;
    const wait = async (predicate, message = 'Recovered draft timeout') => { for (let n = 0; n < 160; n++) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 30)); } throw new Error(message); };
    await wait(() => document.querySelector('#edit-dialog')?.open && document.querySelector('#edit-fields input')?.value === 'D4 preserved input');
    const recoveredSource = document.querySelectorAll('[data-section="triggers"] > fieldset')[1];
    if (recoveredSource.querySelector('select').value !== 'measurement') throw new Error('An unfinished measurement selection was lost on reload.');
    recoveredSource.querySelector('.edit-row-tools button').click();
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
    const submit = document.querySelector('#edit-submit');
    assert(submit.type === 'submit' && submit.classList.contains('primary'), 'adding to the draft is the primary form action');
    click('submit');
    const name = () => document.querySelector('#edit-fields input');
    assert(name().getAttribute('aria-invalid') === 'true' && document.activeElement === name(), 'missing name not marked and focused');
    set(name(), 'Form smoke rule');
    const rows = section => [...document.querySelectorAll('[data-section="' + section + '"] > fieldset')];
    const field = (section, index, key) => rows(section)[index].querySelector('[data-draft-field="' + key + '"]');
    const add = section => {
      const group = document.querySelector('[data-section="' + section + '"]');
      group.open = true; group.querySelector('[data-draft-field="add"]').click();
    };
    const sensor = '0x0000000000000001'; const light = '0x0000000000000002';
    set(field('triggers', 0, 'device'), sensor);
    assert([...field('triggers', 0, 'property').options].map(option => option.value).join('|') === '|occupancy', 'status offers discrete device properties');
    set(field('triggers', 0, 'property'), 'occupancy');
    set(field('triggers', 0, 'value'), '0');
    assert([...field('triggers', 0, 'operator').options].map(option => option.value).join('|') === 'eq|ne', 'status comparisons are discrete');
    add('triggers'); set(field('triggers', 1, 'type'), 'measurement');
    assert(![...field('triggers', 1, 'device').options].some(option => option.value === sensor), 'measurement omits devices without numeric properties');
    set(field('triggers', 1, 'device'), light);
    assert([...field('triggers', 1, 'property').options].map(option => option.value).join('|') === '|brightness', 'measurement omits the status of a mixed device');
    set(field('triggers', 1, 'property'), 'brightness');
    set(field('triggers', 1, 'operator'), 'gt'); set(field('triggers', 1, 'value'), '100');
    add('triggers'); set(field('triggers', 2, 'type'), 'time');
    for (const [index, kind] of [[3, 'sunrise'], [4, 'sunset']]) {
      add('triggers'); set(field('triggers', index, 'type'), 'sunrise');
      set(field('triggers', index, 'latitude'), '52.52'); set(field('triggers', index, 'longitude'), '13.405');
      set(field('triggers', index, 'offset_minutes'), '-15');
      set(field('triggers', index, 'type'), kind);
      assert(field('triggers', index, 'latitude').value === '52.52' && field('triggers', index, 'offset_minutes').value === '-15', 'switching solar events preserves the location and offset');
      assert(rows('triggers')[index].querySelectorAll('select').length === 1, 'the selected solar event needs no duplicate event picker');
    }
    add('conditions'); set(field('conditions', 0, 'device'), sensor);
    set(field('conditions', 0, 'property'), 'occupancy'); set(field('conditions', 0, 'value'), '0');
    add('conditions'); set(field('conditions', 1, 'type'), 'measurement');
    set(field('conditions', 1, 'device'), light); set(field('conditions', 1, 'property'), 'brightness');
    set(field('conditions', 1, 'operator'), 'gte'); set(field('conditions', 1, 'value'), '50');
    set(document.querySelector('[data-section="actions"] fieldset select'), 'sequence');
    set(document.querySelectorAll('[data-section="actions"] fieldset select')[1], result.state.sequenceId);
    assert((await bridge.project({action: 'draft', systemId: context.systemId, operation: 'new', ruleId: '', name: 'Concurrent draft'})).ok, 'simulate a changed draft');
    click('submit');
    await wait(() => !document.querySelector('#edit-reload').hidden && !document.querySelector('#edit-reload').disabled);
    assert(document.querySelector('#edit-dialog').open && submit.disabled, 'form did not pause on stale context');
    click('reload');
    await wait(() => !submit.disabled);
    assert(name().value === 'Form smoke rule', 'refresh lost form input');
    document.querySelector('#edit-form').requestSubmit();
    await wait(async () => (await bridge.snapshot()).configuration.automations.some(rule => rule.name === 'Form smoke rule' && !rule.enabled));
    await wait(() => !document.querySelector('#edit-dialog').open);
    await wait(() => !Object.keys(sessionStorage).some(key => key.startsWith('z2ma.desktop.editor.')));
    const saved = (await bridge.snapshot()).configuration.automations.find(rule => rule.name === 'Form smoke rule');
    assert(saved.triggers.map(trigger => trigger.type).join('|') === 'device|device|time|sun|sun'
      && saved.triggers[0].value === true && saved.triggers[1].value === 100 && saved.triggers[1].operator === 'gt'
      && saved.triggers[3].event === 'sunrise' && saved.triggers[4].event === 'sunset'
      && saved.conditions.every(condition => condition.type === 'device_value'), 'the five form choices save canonical device and solar rules');
    await wait(() => document.querySelector('#entry-title').textContent === 'Form smoke rule' && !document.querySelector('#edit-automation-button').disabled);
    document.querySelector('#edit-automation-button').click();
    await wait(() => document.querySelector('#edit-dialog').open);
    assert(rows('triggers').map(row => row.querySelector('select').value).join('|') === 'status|measurement|time|sunrise|sunset'
      && rows('conditions').map(row => row.querySelector('select').value).join('|') === 'status|measurement', 'existing canonical rules prefill the correct form choices');
    const language = document.querySelector('#designer-language');
    set(language, 'en');
    assert([...field('triggers', 0, 'type').options].map(option => option.textContent).join('|') === 'Device status|Measured value|Time|Sunrise|Sunset'
      && field('triggers', 1, 'value').value === '100' && field('triggers', 1, 'type').value === 'measurement', 'language switching preserves the category and value');
    set(language, 'de'); click('cancel');
    const review = document.querySelector('#desktop-draft-review');
    const check = document.querySelector('#mqtt-validate');
    const transfer = document.querySelector('#mqtt-store');
    const message = document.querySelector('#desktop-review-message');
    const findings = document.querySelector('#mqtt-validation-issues');
    const pane = key => document.querySelector('#desktop-view-' + key);
    const navigate = key => document.querySelector('#desktop-nav-' + key).click();
    const project = (await bridge.project({action: 'status'})).state.project;
    const picker = document.querySelector('#designer-system');
    const connected = () => document.querySelector('#desktop-connection').dataset.connected === 'true';
    const disconnect = async () => {
      navigate('connection');
      const button = document.querySelector('#mqtt-disconnect');
      await wait(() => !button.disabled);
      button.click();
      await wait(() => !connected() && !document.querySelector('#mqtt-connect').hidden);
    };
    const connect = async () => {
      navigate('connection');
      document.querySelector('#mqtt-connect').click();
      await wait(async () => connected() && (await bridge.snapshot()).status.confirmed && !review.hasAttribute('aria-busy'), 'Connection step did not read the selected system');
    };
    const checkDraft = async (fromEditor = false) => {
      navigate(fromEditor ? 'automations' : 'review');
      const button = fromEditor ? document.querySelector('#desktop-check-draft') : check;
      await wait(() => !button.disabled && !picker.disabled);
      button.click();
      assert(!pane('review').hidden && pane('automations').hidden, 'draft check must open the review step');
      await wait(() => !review.hasAttribute('aria-busy'), 'Draft check did not finish');
    };
    await disconnect();
    assert(transfer.disabled, 'the transfer is offered only after a successful Z2M check');
    await checkDraft(true);
    assert(!findings.hidden && pane('transfer').hidden && pane('transfer').contains(transfer), 'findings and transfer must appear in separate steps');
    const incompleteRule = [...findings.children].map(row => row.textContent).filter(line => line.includes('Concurrent draft'));
    assert(incompleteRule.length === 2 && incompleteRule.some(line => line.includes('Füge mindestens einen Auslöser hinzu.'))
      && incompleteRule.some(line => line.includes('Füge mindestens eine Aktion hinzu.')), 'validation omitted the older rule or its missing entries');
    picker.value = project.systems[1].id; picker.dispatchEvent(new Event('change'));
    await wait(async () => !picker.disabled && findings.hidden && (await bridge.snapshot()).workspaceContext.systemId === project.systems[1].id);
    picker.value = context.systemId; picker.dispatchEvent(new Event('change'));
    await wait(async () => !picker.disabled && (await bridge.snapshot()).workspaceContext.systemId === context.systemId);
    await checkDraft();
    await connect();
    navigate('review');
    const correction = [...findings.children].find(row => row.textContent.includes('Füge mindestens einen Auslöser hinzu.')).querySelector('button');
    correction.click();
    await wait(() => document.querySelector('#edit-dialog').open, 'The result did not open the correct draft');
    assert(!pane('automations').hidden && pane('review').hidden && name().value === 'Concurrent draft'
      && document.activeElement.closest('[data-section]')?.dataset.section === 'triggers'
      && document.activeElement.dataset.draftField === 'add', 'correction should focus Add trigger in the affected draft');
    document.activeElement.click();
    set(document.querySelector('[data-section="triggers"] fieldset select'), 'time');
    document.querySelector('[data-section="actions"] [data-draft-field="add"]').click();
    set(document.querySelector('[data-section="actions"] fieldset select'), 'sequence');
    set(document.querySelector('[data-section="actions"] [data-draft-field="type"]').closest('fieldset').querySelectorAll('select')[1], result.state.sequenceId);
    click('submit');
    await wait(() => !document.querySelector('#edit-dialog').open && findings.hidden);
    await wait(() => document.querySelector('#feedback').textContent.includes('Änderung im lokalen Entwurf übernommen.'),
      'Correction did not confirm the applied local change');
    navigate('draft');
    document.querySelector('#mqtt-stored').click();
    await wait(() => document.body.classList.contains('desktop-stored-view'));
    navigate('draft');
    const exportButton = pane('draft').querySelector('#draft-export');
    const exportFeedback = exportButton.closest('.desktop-card').querySelector('[role="status"]');
    const beforeExport = (await bridge.project({action: 'status'})).state.project;
    assert(!exportButton.hidden && !exportButton.disabled, 'the local draft can be exported from step 5 while viewing stored state');
    exportButton.click();
    await wait(() => exportFeedback.textContent.includes('YAML-Datei gespeichert.'), 'Optional YAML export did not complete');
    assert(JSON.stringify((await bridge.project({action: 'status'})).state.project) === JSON.stringify(beforeExport)
      && (await bridge.snapshot()).desktop.source === 'stored', 'export changed the project or displayed source');
    document.querySelector('#mqtt-draft').click();
    await wait(() => !document.body.classList.contains('desktop-stored-view') && !review.hasAttribute('aria-busy'));
    assert(transfer.disabled, 'editing alone does not authorize a transfer');
    await disconnect();
    await checkDraft();
    assert(message.textContent.includes('Entwurf lokal geprüft.') && transfer.disabled && !review.querySelector('[data-step="connection"]').hidden,
      'an offline check must link to the connection step: ' + message.textContent);
    await connect();
    await checkDraft();
    assert(message.textContent.includes('hat den Entwurf') && !transfer.disabled, 'the Z2M check must unlock the separate transfer: ' + message.textContent);
    review.querySelector('[data-step="transfer"]').click();
    assert(!pane('transfer').hidden && pane('review').hidden && !transfer.disabled
      && document.querySelector('#desktop-transfer-target').textContent.includes(project.systems[0].name + ' · ' + project.systems[0].baseTopic),
      'transfer step must identify the checked destination');
    assert(JSON.stringify((await bridge.project({action: 'status'})).state.project.systems[0].stored) === JSON.stringify(stored), 'review changed stored Zigbee2MQTT data');
    const corrected = (await bridge.snapshot()).configuration.automations.find(rule => rule.name === 'Concurrent draft');
    await bridge.project({action: 'draft', systemId: context.systemId, operation: 'rename', ruleId: corrected.id, name: 'Corrected draft'});
    document.dispatchEvent(new Event('z2ma-project-changed'));
    await wait(() => transfer.disabled && document.querySelector('#desktop-transfer-message').textContent.includes('hat sich geändert.'));
  })()`);
  const yaml = importDraft(await readFile(exportPath));
  const added = yaml.automations.find(rule => rule['name'] === 'Form smoke rule');
  const actions = added?.['actions'];
  if (yaml.automations.length !== 3 || !yaml.automations.some(rule => rule['name'] === 'D4 preserved input')
    || !yaml.automations.some(rule => rule['name'] === 'Concurrent draft') || added?.['enabled'] !== false
    || !Array.isArray(actions) || (actions[0] as {sequence_id?: string} | undefined)?.sequence_id !== yaml.sequences[0]?.['id']) {
    throw new Error('Exported YAML lost the existing rule, new disabled rule or sequence');
  }
  console.log('DESKTOP_DRAFTS_OK local/editor/status/measurement/sunrise/sunset/reload/language/sequence/yaml-export/scoped-review/correction/separate-transfer');
}
