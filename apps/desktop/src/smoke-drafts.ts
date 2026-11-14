import {BrowserWindow, type WebContents} from 'electron';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {importDraft} from './draft-exchange.js';

const rendererHelpers = `
    const bridge = window.z2maDesktop;
    const wait = async (predicate, step) => {
      for (let n = 0; n < 160; n++) {
        if (await predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      throw new Error('Draft smoke timed out: ' + step);
    };
    const refreshView = async step => {
      const expected = await bridge.snapshot();
      let rendered = false;
      const onView = ({detail}) => {
        rendered = detail.workspaceContext?.systemId === expected.workspaceContext?.systemId
          && detail.createContext === expected.createContext && detail.desktop?.source === expected.desktop?.source;
      };
      document.addEventListener('z2ma-designer-view', onView);
      try {
        document.dispatchEvent(new Event('z2ma-project-changed'));
        await wait(() => rendered && !document.querySelector('#validate-button').disabled, step);
      } finally { document.removeEventListener('z2ma-designer-view', onView); }
    };
`;

export async function smokeDrafts(view: WebContents, exportPath: string, captureImages: boolean): Promise<void> {
  try { await verifyDrafts(view, exportPath); }
  catch (error) {
    try {
      const diagnostics = await view.executeJavaScript(`(async () => {
        const snapshot = await window.z2maDesktop.snapshot();
        const network = (await window.z2maDesktop.network({action: 'status', id: ''})).state;
        const dialog = document.querySelector('#edit-dialog');
        const text = selector => document.querySelector(selector)?.textContent.slice(0, 400) ?? '';
        return {
          ready: document.readyState, language: document.documentElement.lang, viewport: [innerWidth, innerHeight],
          selected: snapshot.workspaceContext?.systemId, epoch: snapshot.desktop?.epoch, source: snapshot.desktop?.source,
          editor: {exists: Boolean(dialog), open: dialog?.open, inputPreserved: dialog?.querySelector('#edit-fields input')?.value === 'D4 preserved input',
            submitDisabled: dialog?.querySelector('#edit-submit')?.disabled, reloadVisible: Boolean(dialog?.querySelector('#edit-reload:not([hidden])')),
            invalidFields: [...(dialog?.querySelectorAll('[aria-invalid="true"]') ?? [])].map(field => field.dataset.draftField ?? field.type), message: text('#edit-message')},
          rules: {count: snapshot.configuration?.automations?.length, edited: snapshot.configuration?.automations?.some(rule => rule.name === 'D4 preserved input'),
            created: snapshot.configuration?.automations?.some(rule => rule.name === 'Form smoke rule')},
          pending: Object.keys(sessionStorage).filter(key => key.startsWith('z2ma.desktop.editor.')).slice(0, 8).map(key => {
            try {
              const saved = JSON.parse(sessionStorage.getItem(key));
              return {selected: key.endsWith('.' + snapshot.workspaceContext?.systemId), epochCurrent: saved.epoch === snapshot.desktop?.epoch,
                contextCurrent: saved.context === snapshot.createContext, inputPreserved: saved.working?.name === 'D4 preserved input'};
            } catch { return {invalid: true}; }
          }),
          reviewBusy: document.querySelector('#desktop-draft-review')?.hasAttribute('aria-busy'),
          transferDisabled: document.querySelector('#mqtt-store')?.disabled,
          draftCheck: network.draftChecks?.find(check => check.id === snapshot.workspaceContext?.systemId)?.kind ?? null,
          readerBusy: document.querySelector('#validate-button')?.disabled, createDisabled: document.querySelector('#draft-wizard-start')?.disabled,
          pickerDisabled: document.querySelector('#designer-system')?.disabled, storedView: document.body.classList.contains('desktop-stored-view'),
          feedback: text('#feedback'), issues: text('#issues'),
          brokers: network.brokers.map(({id, state, error}) => ({id, state, error})),
          systems: network.systems.map(({id, fresh, reading, error}) => ({id, fresh, reading, error}))
        };
      })()`);
      console.error('DESKTOP_DRAFT_DIAGNOSTICS ' + JSON.stringify(diagnostics));
      const prefix = process.env['Z2MA_SMOKE_DIAGNOSTICS'];
      if (prefix) {
        await mkdir(dirname(prefix), {recursive: true});
        await writeFile(prefix + '.json', JSON.stringify({failure: error instanceof Error ? error.message : 'Draft smoke failed', diagnostics}, null, 2) + '\n');
        if (captureImages) {
          const capture = await view.capturePage();
          if (!capture.isEmpty()) await writeFile(prefix + '.png', capture.toPNG());
        }
      }
    } catch { console.error('DESKTOP_DRAFT_DIAGNOSTICS unavailable'); }
    throw error;
  }
}

async function verifyDrafts(view: WebContents, exportPath: string): Promise<void> {
  await view.executeJavaScript(`(async () => {
    ${rendererHelpers}
    const assert = (value, message) => { if (!value) throw new Error('Draft smoke: ' + message); };
    const project = (await bridge.project({action: 'status'})).state.project;
    const systemId = project.systems[0].id;
    const brokerId = project.systems[0].brokerId;
    const brokerSystems = project.systems.filter(system => system.brokerId === brokerId);
    await bridge.selectSystem(systemId);
    await bridge.network({action: 'connect', id: brokerId});
    // The editor context includes each system's catalog and freshness.
    await wait(async () => {
      const network = (await bridge.network({action: 'status', id: ''})).state;
      return brokerSystems.every(assigned => network.systems.some(system => system.id === assigned.id && system.fresh && !system.reading));
    }, 'read-all-systems-on-selected-broker');
    const data = await bridge.snapshot(); const ctx = data.workspaceContext;
    const command = (route, payload) => bridge.designer({route, systemId, generation: ctx.generation, fingerprint: ctx.fingerprint,
      payload: {requestId: crypto.randomUUID(), context: data.createContext, ...payload}});
    const result = await command('create', {rule: {name: 'D4 smoke rule', retrigger: 'ignore', restart_policy: 'abort',
      triggers: [{type: 'time', at: '18:00:00', timezone: 'Europe/Berlin'}], conditions: [],
      actions: [{type: 'set', target: {type: 'device', id: '0x0000000000000002'}, values: {state: 'ON', brightness: 100}}]}});
    assert(result.ok, JSON.stringify(result));
    const after = await bridge.snapshot(); const created = after.configuration.automations.find(rule => rule.id === result.state.ruleId);
    assert(created && !created.enabled && !after.configuration.automations.some(rule => rule.name === 'Synthetic remote rule'), 'new draft replaced source or enabled rule');
    assert(!(await command('create', {rule: {}})).ok, 'stale/invalid editor accepted');
    await refreshView('render-created-rule');
    await wait(() => [...document.querySelectorAll('#entry-list .entry')].some(element => element.textContent.includes('D4 smoke rule')), 'show-created-rule');
    [...document.querySelectorAll('#entry-list .entry')].find(element => element.textContent.includes('D4 smoke rule')).click();
    await wait(() => document.querySelector('#entry-title').textContent === 'D4 smoke rule', 'select-created-rule');
    const picker = document.querySelector('#designer-language'); picker.value = 'de'; picker.dispatchEvent(new Event('change', {bubbles: true}));
    await wait(() => document.documentElement.lang === 'de', 'switch-editor-language');
    document.querySelector('#edit-automation-button').click();
    await wait(() => document.querySelector('#edit-dialog').open, 'open-existing-rule-editor');
    assert(document.querySelector('#edit-submit').textContent === 'Änderungen in den Entwurf übernehmen', 'the editor uses the header language');
    const name = document.querySelector('#edit-fields input'); name.value = 'D4 preserved input'; name.dispatchEvent(new Event('input', {bubbles: true}));
    document.querySelector('[data-section="triggers"] [data-draft-field="add"]').click();
    const sourceType = document.querySelectorAll('[data-section="triggers"] > fieldset')[1].querySelector('select');
    assert([...sourceType.options].map(option => option.textContent).join('|') === 'Gerätestatus|Messwert|Uhrzeit|Sonnenaufgang|Sonnenuntergang', 'five understandable trigger choices');
    sourceType.value = 'measurement'; sourceType.dispatchEvent(new Event('change', {bubbles: true}));
    await wait(() => Object.keys(sessionStorage).some(key => key.startsWith('z2ma.desktop.editor.')
      && sessionStorage.getItem(key).includes('D4 preserved input')
      && JSON.parse(sessionStorage.getItem(key)).working.triggers.length === 2), 'remember-unfinished-editor');
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
    ${rendererHelpers}
    await wait(() => document.querySelector('#edit-dialog')?.open && document.querySelector('#edit-fields input')?.value === 'D4 preserved input', 'recover-editor-after-reload');
    const recoveredSource = document.querySelectorAll('[data-section="triggers"] > fieldset')[1];
    if (recoveredSource.querySelector('select').value !== 'measurement') throw new Error('An unfinished measurement selection was lost on reload.');
    recoveredSource.querySelector('.edit-row-tools button').click();
    if ((await bridge.project({action: 'save'})).ok) throw new Error('Open editor was silently omitted from save');
    document.querySelector('#edit-submit').click();
    await wait(async () => (await bridge.snapshot()).configuration.automations.some(rule => rule.name === 'D4 preserved input'), 'apply-recovered-rule');
    await wait(() => !document.querySelector('#edit-dialog').open, 'close-recovered-rule-editor');
    await wait(() => !Object.keys(sessionStorage).some(key => key.startsWith('z2ma.desktop.editor.')), 'clear-recovered-editor-session');
    const data = await bridge.snapshot(); const context = data.workspaceContext;
    const result = await bridge.designer({route: 'sequence', systemId: context.systemId, generation: context.generation, fingerprint: context.fingerprint,
      payload: {requestId: crypto.randomUUID(), context: data.createContext, sequenceId: '', changes: {name: 'D4 sequence', actions: [
        {type: 'scene', target: {type: 'device', id: '0x0000000000000002'}, endpoint: 1, scene_id: 1, delay_seconds: 1}]}}});
    if (!result.ok) throw new Error('Sequence not saved: ' + JSON.stringify(result));
    const stored = (await bridge.project({action: 'status'})).state.project.systems[0].stored;
    if (stored.configuration.automations[0].name !== 'Synthetic remote rule') throw new Error('Local edit changed stored state');
    const assert = (value, message) => { if (!value) throw new Error('Draft form smoke: ' + message); };
    assert((await bridge.network({action: 'view', id: context.systemId, source: 'stored'})).ok, 'select stored view');
    await refreshView('render-stored-source-before-creation');
    await wait(() => document.body.classList.contains('desktop-stored-view') && !document.querySelector('#validate-button').disabled,
      'show-stored-source-before-creation');
    document.querySelector('#draft-wizard-start').click();
    await wait(() => document.querySelector('#edit-dialog').open, 'open-new-rule-editor');
    const dialog = document.querySelector('#edit-dialog');
    const lateClose = new Promise(resolve => dialog.addEventListener('close', resolve, {once: true}));
    dialog.close(); dialog.showModal();
    await lateClose;
    if (!Object.keys(sessionStorage).some(key => key.startsWith('z2ma.desktop.editor.'))) {
      throw new Error('A delayed close event cleared the reopened editor session.');
    }
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
    await wait(() => !document.querySelector('#edit-reload').hidden && !document.querySelector('#edit-reload').disabled, 'detect-concurrent-draft-change');
    assert(document.querySelector('#edit-dialog').open && submit.disabled, 'form did not pause on stale context');
    click('reload');
    await wait(() => !submit.disabled, 'refresh-stale-rule-editor');
    assert(name().value === 'Form smoke rule', 'refresh lost form input');
    document.querySelector('#edit-form').requestSubmit();
    await wait(async () => (await bridge.snapshot()).configuration.automations.some(rule => rule.name === 'Form smoke rule' && !rule.enabled), 'apply-new-disabled-rule');
    await wait(() => !document.querySelector('#edit-dialog').open, 'close-new-rule-editor');
    await wait(() => !Object.keys(sessionStorage).some(key => key.startsWith('z2ma.desktop.editor.')), 'clear-new-editor-session');
    const saved = (await bridge.snapshot()).configuration.automations.find(rule => rule.name === 'Form smoke rule');
    assert(saved.triggers.map(trigger => trigger.type).join('|') === 'device|device|time|sun|sun'
      && saved.triggers[0].value === true && saved.triggers[1].value === 100 && saved.triggers[1].operator === 'gt'
      && saved.triggers[3].event === 'sunrise' && saved.triggers[4].event === 'sunset'
      && saved.conditions.every(condition => condition.type === 'device_value'), 'the five form choices save canonical device and solar rules');
    await wait(() => document.querySelector('#entry-title').textContent === 'Form smoke rule' && !document.querySelector('#edit-automation-button').disabled, 'select-saved-rule');
    document.querySelector('#edit-automation-button').click();
    await wait(() => document.querySelector('#edit-dialog').open, 'reopen-saved-rule');
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
      await wait(() => !button.disabled, 'enable-disconnect');
      button.click();
      await wait(() => !connected() && !document.querySelector('#mqtt-connect').hidden, 'confirm-disconnect');
    };
    const connect = async () => {
      navigate('connection');
      document.querySelector('#mqtt-connect').click();
      const brokerId = project.systems.find(system => system.id === context.systemId).brokerId;
      const brokerSystems = project.systems.filter(system => system.brokerId === brokerId);
      await wait(async () => {
        const network = (await bridge.network({action: 'status', id: ''})).state;
        return connected() && !review.hasAttribute('aria-busy')
          && brokerSystems.every(assigned => network.systems.some(system => system.id === assigned.id && system.fresh && !system.reading));
      }, 'read-all-systems-after-reconnect');
      await refreshView('render-all-systems-after-reconnect');
    };
    const checkDraft = async (fromEditor = false) => {
      navigate(fromEditor ? 'automations' : 'review');
      const button = fromEditor ? document.querySelector('#desktop-check-draft') : check;
      await wait(() => !button.disabled && !picker.disabled, 'enable-draft-check');
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
    await wait(async () => !picker.disabled && findings.hidden && (await bridge.snapshot()).workspaceContext.systemId === project.systems[1].id, 'select-other-system-for-review');
    picker.value = context.systemId; picker.dispatchEvent(new Event('change'));
    await wait(async () => !picker.disabled && (await bridge.snapshot()).workspaceContext.systemId === context.systemId, 'return-to-reviewed-system');
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
    await wait(() => !document.querySelector('#edit-dialog').open && findings.hidden, 'apply-corrected-rule');
    await wait(() => document.querySelector('#feedback').textContent.includes('Änderung im lokalen Entwurf übernommen.'),
      'Correction did not confirm the applied local change');
    navigate('automations');
    const correctionView = await bridge.snapshot();
    const correctionRule = correctionView.configuration.automations.find(rule => rule.name === 'D4 preserved input');
    const openedValue = !document.dispatchEvent(new CustomEvent('z2ma-open-draft-issue', {cancelable: true, detail: {
      systemId: correctionView.workspaceContext.systemId, revision: correctionView.desktop.draftRevision,
      kind: 'automations', id: correctionRule.id, path: ['actions', '0', 'values'], property: 'brightness',
      message: () => 'Synthetic capability correction'
    }}));
    assert(openedValue, 'a capability finding must open its existing rule');
    await wait(() => document.querySelector('#edit-dialog').open, 'open-specific-action-value');
    const focusedValue = document.activeElement;
    assert(name().value === correctionRule.name && focusedValue.dataset.draftField === 'values'
      && focusedValue.closest('.edit-command')?.dataset.draftProperty === 'brightness'
      && focusedValue.value === '100' && focusedValue.getAttribute('aria-invalid') === 'true',
      'correction must focus the second action value instead of the first value in that action');
    assert(!document.querySelector('.edit-command[data-draft-property="state"] [aria-invalid="true"]'),
      'the other action value must remain unmarked');
    click('cancel');
    await wait(() => !document.querySelector('#edit-dialog').open && findings.hidden, 'close-specific-action-value');
    navigate('draft');
    document.querySelector('#mqtt-stored').click();
    await wait(() => document.body.classList.contains('desktop-stored-view'), 'show-stored-source-before-export');
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
    await wait(() => !document.body.classList.contains('desktop-stored-view') && !review.hasAttribute('aria-busy'), 'return-to-draft-after-export');
    assert(transfer.disabled, 'editing alone does not authorize a transfer');
    await disconnect();
    await checkDraft();
    assert(message.textContent.includes('Entwurf lokal geprüft.') && transfer.disabled && !review.querySelector('[data-step="connection"]').hidden,
      'an offline check must link to the connection step: ' + message.textContent);
    await connect();
    await checkDraft();
    const checkedId = (await bridge.snapshot()).workspaceContext.systemId;
    const assessment = (await bridge.network({action: 'status', id: ''})).state.draftChecks.find(check => check.id === checkedId);
    assert(assessment?.kind === 'configuration' && !transfer.disabled && !document.querySelector('#mqtt-validateEnabled'),
      'the common Z2M check must classify the content change and unlock the separate transfer');
    review.querySelector('[data-step="transfer"]').click();
    assert(!pane('transfer').hidden && pane('review').hidden && !transfer.disabled
      && document.querySelector('#desktop-transfer-target').textContent.includes(project.systems[0].name + ' · ' + project.systems[0].baseTopic),
      'transfer step must identify the checked destination');
    assert(JSON.stringify((await bridge.project({action: 'status'})).state.project.systems[0].stored) === JSON.stringify(stored), 'review changed stored Zigbee2MQTT data');
    const corrected = (await bridge.snapshot()).configuration.automations.find(rule => rule.name === 'Concurrent draft');
    await bridge.project({action: 'draft', systemId: context.systemId, operation: 'rename', ruleId: corrected.id, name: 'Corrected draft'});
    document.dispatchEvent(new Event('z2ma-project-changed'));
    await wait(() => transfer.disabled && document.querySelector('#desktop-transfer-message').textContent.includes('hat sich geändert.'), 'invalidate-transfer-after-edit');
  })()`);
  const yaml = importDraft(await readFile(exportPath));
  const added = yaml.automations.find(rule => rule['name'] === 'Form smoke rule');
  const actions = added?.['actions'];
  if (yaml.automations.length !== 3 || !yaml.automations.some(rule => rule['name'] === 'D4 preserved input')
    || !yaml.automations.some(rule => rule['name'] === 'Concurrent draft') || added?.['enabled'] !== false
    || !Array.isArray(actions) || (actions[0] as {sequence_id?: string} | undefined)?.sequence_id !== yaml.sequences[0]?.['id']) {
    throw new Error('Exported YAML lost the existing rule, new disabled rule or sequence');
  }
  await view.executeJavaScript(`(async () => {
    ${rendererHelpers}
    const assert = (value, message) => { if (!value) throw new Error('Cross-system smoke: ' + message); };
    const project = (await bridge.project({action: 'status'})).state.project;
    const [local, other] = project.systems;
    const send = async (route, payload) => {
      const data = await bridge.snapshot();
      const result = await bridge.designer({route, ...data.workspaceContext,
        payload: {requestId: crypto.randomUUID(), context: data.createContext, ...payload}});
      assert(result.ok, JSON.stringify(result)); return result.state;
    };
    for (const [owner, peer] of [[other, local], [local, other]]) {
      await bridge.selectSystem(owner.id);
      await send('permissions', {peers: [...new Set([...owner.configuration.mesh_peers, peer.baseTopic])], confirmed: true});
    }
    await refreshView('render-cross-system-device-choices');
    document.querySelector('#desktop-nav-automations').click();
    await wait(() => !document.querySelector('#draft-wizard-start').disabled, 'enable-cross-system-form');
    document.querySelector('#draft-wizard-start').click();
    await wait(() => document.querySelector('#edit-dialog').open, 'open-cross-system-form');
    const rows = section => [...document.querySelectorAll('[data-section="' + section + '"] > fieldset')];
    const field = (section, key, index = 0) => {
      const element = rows(section)[index]?.querySelector('[data-draft-field="' + key + '"]');
      assert(Boolean(element), 'missing ' + section + '/' + key); return element;
    };
    const set = (element, value) => {
      assert(Boolean(element), 'missing field'); element.value = value;
      element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true}));
    };
    set(document.querySelector('#edit-fields input'), 'Cross-system smoke');
    assert(!rows('triggers')[0].querySelector('[data-draft-field="system"]'), 'device triggers remain local');
    set(field('triggers', 'device'), '0x0000000000000001');
    set(field('triggers', 'property'), 'occupancy'); set(field('triggers', 'value'), '0');
    const section = document.querySelector('[data-section="conditions"]'); section.open = true;
    section.querySelector('[data-draft-field="add"]').click();
    set(field('conditions', 'system'), other.baseTopic);
    const choices = [...field('conditions', 'device').options].filter(option => option.value);
    const collator = new Intl.Collator('de-DE', {numeric: true, sensitivity: 'base'});
    assert(choices.length && choices.every(option => option.value.startsWith(other.id + ':')),
      'condition choices must belong to the selected system');
    assert(choices.every((option, index) => !index || collator.compare(choices[index - 1].textContent, option.textContent) <= 0),
      'foreign device choices must be alphabetical');
    set(field('conditions', 'device'), other.id + ':0x0000000000000001');
    set(field('conditions', 'device'), '');
    assert(field('conditions', 'system').value === other.baseTopic, 'clearing a device preserves the chosen system');
    set(field('conditions', 'device'), other.id + ':0x0000000000000001');
    set(field('conditions', 'property'), 'occupancy'); set(field('conditions', 'value'), '0');
    document.querySelector('[data-section="conditions"] [data-draft-field="add"]').click();
    set(field('conditions', 'type', 1), 'measurement');
    set(field('conditions', 'system', 1), other.baseTopic);
    set(field('conditions', 'device', 1), other.id + ':0x0000000000000002');
    set(field('conditions', 'property', 1), 'brightness');
    set(field('conditions', 'operator', 1), 'gte'); set(field('conditions', 'value', 1), '50');
    set(field('actions', 'system'), other.baseTopic);
    set(field('actions', 'target'), other.id + ':0x0000000000000002');
    set(field('actions', 'property'), 'state');
    const stateValues = field('actions', 'values');
    assert([...stateValues.options].filter(option => option.value).map(option => option.textContent).join('|') === 'Ein|Aus|Umschalten',
      'a writable ON/OFF state channel must offer native Toggle as well');
    for (const value of ['0', '1', '2']) set(stateValues, value);
    const localChoice = [...field('actions', 'system').options].find(option => option.value === '');
    const remoteChoice = [...field('actions', 'system').options].find(option => option.value === other.baseTopic);
    assert(localChoice?.textContent.includes(local.name) && remoteChoice?.textContent.includes(other.name)
      && remoteChoice.textContent.includes(project.brokers.find(broker => broker.id === other.brokerId).name), 'system choices identify the broker');
    document.querySelector('#edit-form').requestSubmit();
    await wait(() => !document.querySelector('#edit-dialog').open, 'apply-cross-system-draft');
    const saved = (await bridge.snapshot()).configuration.automations.find(rule => rule.name === 'Cross-system smoke');
    assert(saved && !saved.enabled && saved.conditions[0].device === '0x0000000000000001'
      && saved.conditions[0].system === other.baseTopic && saved.conditions[1].system === other.baseTopic
      && saved.conditions[1].property === 'brightness' && saved.conditions[1].value === 50 && saved.actions[0].target.system === other.baseTopic
      && saved.actions[0].type === 'set' && saved.actions[0].values.state === 'TOGGLE',
      'draft must retain stable device and system identities');
    await wait(() => document.querySelector('#entry-title').textContent === saved.name, 'select-cross-system-draft');
    const networkLabel = part => document.querySelector('.flow-card[data-part="' + part + '"] .card-network')?.textContent;
    const deviceParts = [['triggers:0', local], ['conditions:0', other], ['conditions:1', other], ['actions:0', other]];
    const ownsNetworks = prefix => deviceParts.every(([part, owner]) => networkLabel(part) === prefix + ': ' + owner.name
      + (owner.name === owner.baseTopic ? '' : ' · ' + owner.baseTopic));
    assert(ownsNetworks('Z2M-Netzwerk'), 'flow cards must identify each local or remote device network');
    document.querySelector('#edit-automation-button').click();
    await wait(() => document.querySelector('#edit-dialog').open, 'reopen-cross-system-draft');
    set(document.querySelector('#designer-language'), 'en');
    assert(ownsNetworks('Z2M network'), 'network labels must follow the language without changing device ownership');
    assert(field('conditions', 'system').value === other.baseTopic && field('conditions', 'device').value === other.id + ':0x0000000000000001'
      && field('conditions', 'type', 1).value === 'measurement' && field('conditions', 'system', 1).value === other.baseTopic
      && field('actions', 'system').value === other.baseTopic && field('actions', 'target').value === other.id + ':0x0000000000000002'
      && field('actions', 'values').value === '2' && field('actions', 'values').selectedOptions[0].textContent === 'Toggle',
      'reopening and changing language preserve foreign device ownership');
    set(document.querySelector('#designer-language'), 'de');
    document.querySelector('#edit-cancel').click();
    await send('manage', {operation: 'delete-rule', id: saved.id});
    for (const owner of [other, local]) {
      await bridge.selectSystem(owner.id);
      await send('permissions', {peers: owner.configuration.mesh_peers, confirmed: true});
    }
    await refreshView('restore-after-cross-system-device-check');
  })()`);
  console.log('DESKTOP_CROSS_SYSTEM_OK condition/action/system-picker/ownership/network-labels/alphabetical/reopen/language');
  console.log('DESKTOP_DRAFTS_OK local/editor/status/measurement/sunrise/sunset/reload/language/sequence/yaml-export/scoped-review/correction/separate-transfer');
}
