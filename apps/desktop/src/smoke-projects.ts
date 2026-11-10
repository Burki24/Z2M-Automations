import type {WebContents} from 'electron';

export async function smokeProjects(view: WebContents): Promise<void> {
  await view.executeJavaScript(`(async () => {
    const bridge = window.z2maDesktop;
    const assert = (test, message) => { if (!test) throw new Error('Project smoke: ' + message); };
    const wait = async test => { for (let n = 0; n < 120; n++) { if (await test()) return; await new Promise(r => setTimeout(r, 30)); } throw new Error('Project UI timeout'); };
    const state = async () => { const result = await bridge.project({action: 'status'}); assert(result.ok, 'status'); return result.state; };
    const field = (id, value) => { const element = document.querySelector('#project-' + id); element.value = value; element.dispatchEvent(new Event('input', {bubbles: true})); return element; };
    const click = id => document.querySelector('#project-' + id).click();
    const projectPanel = document.querySelector('#local-project');
    const section = key => document.querySelector('#desktop-setup-' + key);
    document.querySelector('#desktop-new-project').click();
    assert(section('file').open && !document.querySelector('#desktop-view-setup').hidden, 'new project opens file setup');
    await wait(async () => (await state()).active);
    await wait(() => !document.querySelector('#project-projectName-form').hidden);
    field('name', 'Synthetic portable project'); click('applyName');
    await wait(async () => (await state()).project.name === 'Synthetic portable project');
    await wait(() => !document.querySelector('#local-project').hasAttribute('aria-busy'));
    section('brokers').querySelector('summary').click();
    assert(!section('file').open, 'setup only expands the selected group');
    field('brokerName', 'Synthetic broker');
    document.querySelector('#desktop-nav-automations').click();
    assert(projectPanel.closest('#desktop-view-setup').hidden, 'setup must leave the automation workspace');
    document.querySelector('#desktop-setup-system').click();
    assert(section('brokers').open, 'system setup starts at the missing broker');
    assert(document.querySelector('#project-brokerName').value === 'Synthetic broker', 'broker shortcut changed pending input'); field('host', 'broker.invalid'); field('port', '1883'); click('applyBroker');
    await wait(async () => (await state()).project.brokers.length === 1);
    await wait(() => !document.querySelector('#local-project').hasAttribute('aria-busy'));
    const brokerId = (await state()).project.brokers[0].id;
    section('systems').querySelector('summary').click();
    field('systemName', 'Synthetic system'); field('systemBroker', brokerId); field('topic', 'synthetic'); click('applySystem');
    await wait(async () => (await state()).project.systems.length === 1);
    await wait(() => !document.querySelector('#local-project').hasAttribute('aria-busy'));
    const systemFormChoice = document.querySelector('#project-systemChoice');
    systemFormChoice.value = ''; systemFormChoice.dispatchEvent(new Event('change', {bubbles: true}));
    field('systemName', 'Second synthetic system'); field('systemBroker', brokerId); field('topic', 'synthetic-other'); click('applySystem');
    await wait(async () => (await state()).project.systems.length === 2);
    await wait(() => !projectPanel.hasAttribute('aria-busy'));
    section('file').querySelector('summary').click();
    field('name', 'Unfinished project name');
    const language = document.querySelector('#designer-language'); language.value = 'en'; language.dispatchEvent(new Event('change', {bubbles: true}));
    await wait(() => document.documentElement.lang === 'en');
    assert(document.querySelector('#project-name').value === 'Unfinished project name', 'language discarded form');
    click('refresh'); await wait(() => !document.querySelector('#local-project').hasAttribute('aria-busy'));
    assert(document.querySelector('#project-name').value === 'Unfinished project name', 'refresh discarded form');
    field('name', 'Synthetic portable project'); click('applyName');
    await wait(() => !projectPanel.hasAttribute('aria-busy'));
    assert(!document.querySelector('#project-newDraft') && !document.querySelector('#mqtt-system'), 'duplicate draft creation and system selection were removed');
    click('save'); await wait(async () => !(await state()).dirty);
    assert((await state()).hasPath, 'file not saved');
    assert(section('file').querySelector('.setup-feedback').textContent.includes('Synthetic portable project'), 'the save message identifies the project');
    section('brokers').querySelector('summary').click();
    assert(document.querySelector('#project-brokerChoice').value === brokerId, 'credential target is the selected broker');
    assert(document.querySelector('#project-broker-form').nextElementSibling.id === 'project-credentials-form', 'credentials follow broker settings');
    field('credentialMode', 'session'); click('storeCredentials');
    await wait(async () => (await state()).credentials[brokerId] === 'session');
    assert(!document.querySelector('input[type=password]'), 'credential input exposed to designer');
    assert(!JSON.stringify(await state()).includes('SYNTHETIC_SECRET'), 'secret returned');
    const copy = await bridge.project({action: 'rename', name: 'Later draft'}); assert(copy.ok, 'rename');
    assert((await bridge.project({action: 'save'})).ok, 'second save');
    assert((await bridge.project({action: 'restore'})).ok, 'restore');
    assert((await state()).project.name === 'Synthetic portable project' && (await state()).dirty, 'backup not restored locally');
    assert((await bridge.project({action: 'open'})).ok, 'reopen');
    assert((await state()).project.name === 'Later draft', 'restore wrote disk');
    assert((await state()).credentials[brokerId] === 'none', 'session retained after reopen');
    const manual = await bridge.credential({brokerId, mode: 'session', source: 'manual'});
    assert(manual.ok && manual.state.credentials[brokerId] === 'session', 'manual session credential');
    assert(!JSON.stringify(manual).includes('SYNTHETIC_SECRET'), 'manual secret returned');
    if ((await state()).protectedAvailable) {
      const stored = await bridge.credential({brokerId, mode: 'protected'});
      assert(stored.ok && stored.state.credentials[brokerId] === 'protected', 'OS-protected credential round trip');
      assert((await bridge.credential({brokerId, mode: 'remove'})).ok, 'remove protected credential');
    }
    const snapshot = await bridge.snapshot();
    assert(!snapshot.status.mqttConnected && !snapshot.status.executing && !snapshot.capabilities.operationControls && snapshot.editAllowed, 'offline isolation');
    document.dispatchEvent(new Event('z2ma-project-changed'));
    section('file').open = true;
    click('refresh'); await wait(() => !document.querySelector('#local-project').hasAttribute('aria-busy'));
    field('name', 'Pending across renderer reload');
    await state();
    assert(!Object.values(sessionStorage).join('').includes('SYNTHETIC_SECRET'), 'secret in session storage');
  })()`);
  const loaded = new Promise<void>(resolve => view.once('did-finish-load', () => resolve()));
  view.reload(); await loaded;
  let restored = false;
  for (let attempt = 0; attempt < 120 && !restored; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 30));
    restored = await view.executeJavaScript("document.querySelector('#project-name')?.value === 'Pending across renderer reload'");
  }
  if (!restored) throw new Error('Unfinished project input lost across renderer reload.');
  await view.executeJavaScript("document.querySelector('#desktop-nav-setup').click(); document.querySelector('#desktop-setup-file').open = true;");
  // Exercise keyboard traversal in the project's setup section.
  view.focus();
  await view.executeJavaScript("document.querySelector('#project-name').focus(); document.querySelector('#project-name').value = 'Keyboard draft';");
  view.sendInputEvent({type: 'keyDown', keyCode: 'Tab'});
  view.sendInputEvent({type: 'keyUp', keyCode: 'Tab'});
  let focused = false;
  for (let attempt = 0; attempt < 30 && !focused; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 30));
    focused = await view.executeJavaScript("document.activeElement.id === 'project-applyName'");
  }
  if (!focused) throw new Error('Project keyboard focus order failed: ' + await view.executeJavaScript('document.activeElement.id'));
  await view.executeJavaScript(`(async () => {
    document.querySelector('#project-applyName').click();
    for (let i = 0; i < 100 && document.querySelector('#local-project').hasAttribute('aria-busy'); i++) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    const result = await window.z2maDesktop.project({action: 'status'});
    if (result.state.project.name !== 'Keyboard draft') throw new Error('Keyboard draft was not applied');
    window.scrollTo(0,0);
  })()`);
  console.log('DESKTOP_PROJECTS_OK setup-navigation/portable/backup/credentials/offline');
}
