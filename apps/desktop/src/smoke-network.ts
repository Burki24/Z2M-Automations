import type {WebContents} from 'electron';

export async function smokeNetwork(view: WebContents, port: number): Promise<void> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Isolated MQTT smoke peer is missing.');
  await view.executeJavaScript(`(async () => {
    const bridge = window.z2maDesktop;
    const assert = (value, message) => { if (!value) throw new Error('MQTT smoke: ' + message); };
    const wait = async predicate => { for (let n = 0; n < 160; n++) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 30)); } throw new Error('MQTT UI timeout'); };
    const state = async () => (await bridge.network({action: 'status', id: ''})).state;
    const navigate = key => document.querySelector('#desktop-nav-' + key).click();
    let project = (await bridge.project({action: 'status'})).state.project;
    const draft = JSON.stringify(project.systems[0].configuration);
    assert((await state()).brokers.every(broker => broker.state === 'disconnected'), 'automatic connection on open');
    const broker = {...project.brokers[0], host: '127.0.0.1', port: ${port}, tls: false};
    assert((await bridge.project({action: 'broker', broker})).ok, 'synthetic broker setup');
    document.dispatchEvent(new Event('z2ma-project-changed'));
    navigate('connection');
    const catalog = document.querySelector('#mqtt-catalog');
    assert(catalog?.hidden, 'the catalog lists wait for a confirmed read');
    await wait(() => !document.querySelector('#mqtt-connect').disabled);
    document.querySelector('#mqtt-connect').click();
    await wait(async () => (await state()).systems[0].fresh);
    project = (await bridge.project({action: 'status'})).state.project;
    assert(JSON.stringify(project.systems[0].configuration) === draft, 'remote replaced local draft');
    assert(project.systems[0].stored.yaml.startsWith('# Synthetic source'), 'exact source not retained');
    const id = project.systems[0].id;
    await wait(() => document.querySelector('#desktop-connection').dataset.connected === 'true');
    assert(document.querySelector('#designer-system').value === id, 'the shared system picker identifies the connected draft');
    await wait(() => !catalog.hidden);
    const devices = document.querySelector('#mqtt-catalog-device');
    const groups = document.querySelector('#mqtt-catalog-group');
    const names = list => [...list.children].map(item => item.textContent).join(',');
    const numbered = name => Array.from({length: 16}, (_, index) => name + ' ' + (index + 1));
    assert(names(devices) === [...numbered('Device'), 'Synthetic light', 'Synthetic sensor'].join(','), 'devices are separate and sorted');
    assert(names(groups) === [...numbered('Group'), 'Synthetic group'].join(','), 'groups are separate and sorted');
    for (const list of [devices, groups]) {
      assert(list.tabIndex === 0 && getComputedStyle(list).overflowY === 'auto' && list.scrollHeight > list.clientHeight,
        'both long lists are independently scrollable and keyboard accessible');
      list.scrollTop = list.scrollHeight;
      assert(Math.abs(list.scrollTop + list.clientHeight - list.scrollHeight) <= 1, 'the last entry can be reached');
      list.scrollTop = 0;
    }
    document.querySelector('#desktop-view-connection [data-step="draft"]').click();
    await wait(() => !document.querySelector('#mqtt-stored').disabled);
    document.querySelector('#mqtt-stored').click();
    await wait(async () => (await state()).systems[0].source === 'stored');
    await wait(() => document.querySelector('#entry-title').textContent === 'Synthetic remote rule');
    await wait(() => !document.querySelector('#desktop-draft-review').hasAttribute('aria-busy'));
    assert(!document.querySelector('#desktop-view-automations').hidden && document.querySelector('#desktop-check-draft').hidden,
      'stored data opens in the designer without draft checks');
    navigate('draft');
    document.querySelector('#mqtt-draft').click();
    await wait(async () => (await state()).systems[0].source === 'draft');
    await wait(() => !document.querySelector('#mqtt-validate').hidden);
    assert(JSON.stringify((await bridge.snapshot()).configuration) === draft, 'draft view changed');
    navigate('operation');
    assert(!document.querySelector('#desktop-view-operation').hidden && document.querySelector('#desktop-view-automations').hidden
      && !document.querySelector('#desktop-view-operation #mqtt-store'), 'operation is separate from editing and transfer');
    await wait(() => [...document.querySelector('#mqtt-rule').options].some(option => option.textContent.includes('Synthetic remote rule')));
    const picker = document.querySelector('#designer-system');
    picker.value = project.systems[1].id; picker.dispatchEvent(new Event('change'));
    await wait(() => [...document.querySelector('#mqtt-rule').options].some(option => option.textContent.includes('Other stored rule')));
    assert(![...document.querySelector('#mqtt-rule').options].some(option => option.textContent.includes('Synthetic remote rule')), 'operation mixed rules from different systems');
    assert(!catalog.hidden && names(devices) === 'Other sensor,Synthetic light' && groups.hidden && !groups.children.length,
      'the selected system replaces both catalog lists and shows its empty group list');
    picker.value = id; picker.dispatchEvent(new Event('change'));
    await wait(() => [...document.querySelector('#mqtt-rule').options].some(option => option.textContent.includes('Synthetic remote rule')));
    navigate('automations');
    document.querySelector('[data-area="catalog"]').click();
    assert(document.querySelector('#entry-list').textContent.includes('Synthetic light'), 'catalog stays in the automation workspace');
    document.querySelector('[data-area="device"]').click();
    assert(!(await bridge.network({action: 'store', id})).ok, 'smoke profile permitted a transfer');
    assert(!(await bridge.network({action: 'publish', id, topic: 'synthetic/device/set', payload: 'ON'})).ok, 'raw publish accepted');
    assert((await bridge.network({action: 'disconnect', id: broker.id})).ok, 'disconnect');
    assert(!(await state()).systems[0].fresh, 'disconnected state marked fresh');
    assert((await bridge.snapshot()).status.confirmed === false, 'disconnected operation confirmed');
    assert(JSON.stringify((await bridge.project({action: 'status'})).state.project.systems[0].configuration) === draft, 'draft lost after disconnect');
    document.dispatchEvent(new Event('z2ma-project-changed'));
    await wait(() => catalog.hidden);
  })()`);
  console.log('DESKTOP_MQTT_OK shared-system/read-only/stored-source/operation/sorted-scrollable-catalog');
}
