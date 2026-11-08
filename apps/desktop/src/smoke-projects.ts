import type {WebContents} from 'electron';

export async function smokeProjects(view: WebContents): Promise<void> {
  await view.executeJavaScript(`(async () => {
    const bridge = window.z2maDesktop;
    const assert = (test, message) => { if (!test) throw new Error('Project smoke: ' + message); };
    const wait = async test => { for (let n = 0; n < 120; n++) { if (await test()) return; await new Promise(r => setTimeout(r, 30)); } throw new Error('Project UI timeout'); };
    const state = async () => { const result = await bridge.project({action: 'status'}); assert(result.ok, 'status'); return result.state; };
    const field = (id, value) => { const element = document.querySelector('#project-' + id); element.value = value; element.dispatchEvent(new Event('input', {bubbles: true})); return element; };
    const click = id => document.querySelector('#project-' + id).click();
    document.querySelector('#local-project').open = true;
    click('new'); await wait(async () => (await state()).active);
    await wait(() => !document.querySelector('#project-projectName-form').hidden);
    field('name', 'Synthetic portable project'); click('applyName');
    await wait(async () => (await state()).project.name === 'Synthetic portable project');
    await wait(() => !document.querySelector('#local-project').hasAttribute('aria-busy'));
    field('brokerName', 'Synthetic broker'); field('host', 'broker.invalid'); field('port', '1883'); click('applyBroker');
    await wait(async () => (await state()).project.brokers.length === 1);
    await wait(() => !document.querySelector('#local-project').hasAttribute('aria-busy'));
    const brokerId = (await state()).project.brokers[0].id;
    field('systemName', 'Synthetic system'); field('systemBroker', brokerId); field('topic', 'synthetic'); click('applySystem');
    await wait(async () => (await state()).project.systems.length === 1);
    await wait(() => !document.querySelector('#local-project').hasAttribute('aria-busy'));
    const systemId = (await state()).project.systems[0].id;
    const picker = document.querySelector('#project-draftSystem'); picker.value = systemId; picker.dispatchEvent(new Event('change', {bubbles: true}));
    field('draftName', 'Unfinished local rule');
    const language = document.querySelector('#designer-language'); language.value = 'en'; language.dispatchEvent(new Event('change', {bubbles: true}));
    await wait(() => document.documentElement.lang === 'en');
    assert(document.querySelector('#project-draftName').value === 'Unfinished local rule', 'language discarded form');
    click('refresh'); await wait(() => !document.querySelector('#local-project').hasAttribute('aria-busy'));
    assert(document.querySelector('#project-draftName').value === 'Unfinished local rule', 'refresh discarded form');
    click('newDraft'); await wait(async () => (await state()).project.systems[0].configuration.automations.length === 1);
    await wait(() => !document.querySelector('#local-project').hasAttribute('aria-busy'));
    const ruleId = (await state()).project.systems[0].configuration.automations[0].id;
    assert((await state()).project.systems[0].configuration.automations[0].enabled === false, 'new rule enabled');
    document.querySelector('#project-draftChoice').value = ruleId; field('draftName', 'Disabled copy'); click('copyDraft');
    await wait(async () => (await state()).project.systems[0].configuration.automations.length === 2);
    await wait(() => !document.querySelector('#local-project').hasAttribute('aria-busy'));
    click('save'); await wait(async () => !(await state()).dirty);
    assert((await state()).hasPath, 'file not saved');
    const credentialBroker = document.querySelector('#project-credentialBroker'); credentialBroker.value = brokerId;
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
    if ((await state()).protectedAvailable) {
      const stored = await bridge.credential({brokerId, mode: 'protected'});
      assert(stored.ok && stored.state.credentials[brokerId] === 'protected', 'OS-protected credential round trip');
      assert((await bridge.credential({brokerId, mode: 'remove'})).ok, 'remove protected credential');
    }
    const snapshot = await bridge.snapshot();
    assert(!snapshot.status.mqttConnected && !snapshot.status.executing && !snapshot.editAllowed, 'offline isolation');
    document.dispatchEvent(new Event('z2ma-project-changed'));
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
  await view.executeJavaScript("document.querySelector('#local-project').open = true;");
  // Exercise keyboard traversal and wheel scrolling on the expanded project panel.
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
    document.activeElement.blur(); window.scrollTo(0,0);
    window.projectWheelReceived = false;
    document.addEventListener('wheel', () => { window.projectWheelReceived = true; }, {once: true});
    await new Promise(resolve => setTimeout(resolve, 100));
  })()`);
  view.sendInputEvent({type: 'mouseMove', x: 100, y: 100});
  view.sendInputEvent({type: 'mouseWheel', x: 100, y: 100, deltaY: -400, deltaX: 0, canScroll: true});
  let scrolled = false;
  for (let attempt = 0; attempt < 30 && !scrolled; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 30));
    scrolled = await view.executeJavaScript('window.scrollY > 0');
  }
  if (!scrolled) throw new Error('Project wheel scrolling failed: ' + await view.executeJavaScript("JSON.stringify({received: window.projectWheelReceived, y: scrollY, height: document.documentElement.scrollHeight, viewport: innerHeight})"));
  await view.executeJavaScript('window.scrollTo(0,0);');
  console.log('DESKTOP_PROJECTS_OK portable/drafts/backup/credentials/offline');
}
