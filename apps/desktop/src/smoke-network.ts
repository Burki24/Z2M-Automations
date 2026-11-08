import type {WebContents} from 'electron';

export async function smokeNetwork(view: WebContents, port: number): Promise<void> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Isolated MQTT smoke peer is missing.');
  await view.executeJavaScript(`(async () => {
    const bridge = window.z2maDesktop;
    const assert = (value, message) => { if (!value) throw new Error('MQTT smoke: ' + message); };
    const wait = async predicate => { for (let n = 0; n < 160; n++) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 30)); } throw new Error('MQTT UI timeout'); };
    const state = async () => (await bridge.network({action: 'status', id: ''})).state;
    let project = (await bridge.project({action: 'status'})).state.project;
    const draft = JSON.stringify(project.systems[0].configuration);
    assert((await state()).brokers.every(broker => broker.state === 'disconnected'), 'automatic connection on open');
    const broker = {...project.brokers[0], host: '127.0.0.1', port: ${port}, tls: false};
    assert((await bridge.project({action: 'broker', broker})).ok, 'synthetic broker setup');
    const connected = await bridge.network({action: 'connect', id: broker.id}); assert(connected.ok, 'connect request');
    await wait(async () => (await state()).systems[0].fresh);
    project = (await bridge.project({action: 'status'})).state.project;
    assert(JSON.stringify(project.systems[0].configuration) === draft, 'remote replaced local draft');
    assert(project.systems[0].stored.yaml.startsWith('# Synthetic source'), 'exact source not retained');
    const id = project.systems[0].id;
    document.querySelector('#mqtt-panel').open = true;
    await wait(() => [...document.querySelector('#mqtt-system').options].some(option => option.value === id));
    document.querySelector('#mqtt-system').value = id;
    document.querySelector('#mqtt-broker').value = broker.id;
    document.querySelector('#mqtt-stored').click();
    await wait(async () => (await state()).systems[0].source === 'stored');
    await wait(() => document.querySelector('#entry-title').textContent === 'Synthetic remote rule');
    assert((await bridge.snapshot()).status.executing, 'remote operation not displayed');
    await wait(() => !document.querySelector('#mqtt-panel').hasAttribute('aria-busy'));
    document.querySelector('#mqtt-catalog').click();
    await wait(() => document.querySelector('#mqtt-catalog-view').textContent.includes('Synthetic scene'));
    await wait(() => !document.querySelector('#mqtt-panel').hasAttribute('aria-busy'));
    document.querySelector('#mqtt-draft').click();
    await wait(async () => (await state()).systems[0].source === 'draft');
    assert(JSON.stringify((await bridge.snapshot()).configuration) === draft, 'draft view changed');
    assert(!(await bridge.network({action: 'store', id})).ok, 'upload accepted');
    assert(!(await bridge.network({action: 'publish', id, topic: 'synthetic/device/set', payload: 'ON'})).ok, 'raw publish accepted');
    assert((await bridge.network({action: 'disconnect', id: broker.id})).ok, 'disconnect');
    assert(!(await state()).systems[0].fresh, 'disconnected state marked fresh');
    assert((await bridge.snapshot()).status.confirmed === false, 'disconnected operation confirmed');
    assert(JSON.stringify((await bridge.project({action: 'status'})).state.project.systems[0].configuration) === draft, 'draft lost after disconnect');
    document.dispatchEvent(new Event('z2ma-project-changed'));
  })()`);
  console.log('DESKTOP_MQTT_OK isolated/read-only/draft-preserved/catalog');
}
