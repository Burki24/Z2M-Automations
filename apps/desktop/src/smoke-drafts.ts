import type {WebContents} from 'electron';

export async function smokeDrafts(view: WebContents): Promise<void> {
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
    const wait = async predicate => { for (let n = 0; n < 160; n++) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 30)); } throw new Error('Recovered draft timeout'); };
    await wait(() => document.querySelector('#edit-dialog')?.open && document.querySelector('#edit-fields input')?.value === 'D4 preserved input');
    if ((await bridge.project({action: 'save'})).ok) throw new Error('Open editor was silently omitted from save');
    document.querySelector('#edit-form').requestSubmit();
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
    const assert = (value, message) => { if (!value) throw new Error('Draft wizard smoke: ' + message); };
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
    assert((await bridge.snapshot()).desktop.source === 'draft', 'wizard did not switch to draft');
    click('next');
    set(document.querySelector('#edit-fields input'), 'Wizard smoke rule');
    set(document.querySelector('[data-section="triggers"] fieldset select'), 'time');
    click('next');
    click('back');
    assert(document.querySelector('#edit-fields input').value === 'Wizard smoke rule', 'wizard lost name');
    click('next');
    click('next');
    set(document.querySelector('[data-section="actions"] fieldset select'), 'sequence');
    set(document.querySelectorAll('[data-section="actions"] fieldset select')[1], result.state.sequenceId);
    click('next');
    assert(!document.querySelector('#edit-submit').hidden, 'wizard did not reach review');
    assert((await bridge.project({action: 'draft', systemId: context.systemId, operation: 'new', ruleId: '', name: 'Concurrent draft'})).ok, 'simulate a changed draft');
    click('submit');
    await wait(() => !document.querySelector('#edit-reload').hidden && !document.querySelector('#edit-reload').disabled);
    assert(document.querySelector('#edit-dialog').open && document.querySelector('#edit-submit').disabled, 'wizard did not pause on stale context');
    click('reload');
    await wait(() => !document.querySelector('#edit-submit').disabled);
    assert(document.querySelector('#edit-fields').textContent.includes('Wizard smoke rule'), 'refresh lost wizard input');
    click('submit');
    await wait(async () => (await bridge.snapshot()).configuration.automations.some(rule => rule.name === 'Wizard smoke rule' && !rule.enabled));
    await wait(() => !document.querySelector('#edit-dialog').open);
    await wait(() => document.querySelector('#workflow-stored').textContent.includes('Revision 3'));
    assert(document.querySelector('#workflow-system').textContent === (await bridge.snapshot()).desktop.systemName, 'status shows the wrong system');
    assert(document.querySelector('#workflow-project').textContent.includes('ungespeicherte Änderungen'), 'status omitted the unsaved project');
    document.querySelector('#workflow-next').click();
    assert(document.querySelector('#mqtt-panel').open && document.querySelector('#mqtt-system').value === context.systemId, 'next step did not open the selected system');
    assert(document.activeElement.id === 'mqtt-validate', 'next step did not focus the draft check');
  })()`);
  console.log('DESKTOP_DRAFTS_OK local/editor/reload/language/sequence/isolated');
}
