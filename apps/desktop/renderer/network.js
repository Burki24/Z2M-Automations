import {t, bindText, onLanguageChange} from './localization.js';

export async function installNetwork(bridge) {
  const panel = document.createElement('details'); panel.className = 'desktop-project'; panel.id = 'mqtt-panel';
  const title = document.createElement('summary'); bindText(title, () => t('mqtt.title')); panel.append(title);
  const help = document.createElement('p'); bindText(help, () => t('mqtt.help')); panel.append(help);
  const brokerLabel = document.createElement('label'); const brokerTitle = document.createElement('span'); bindText(brokerTitle, () => t('mqtt.broker'));
  const brokers = document.createElement('select'); brokers.id = 'mqtt-broker'; brokerLabel.append(brokerTitle, brokers);
  const systemLabel = document.createElement('label'); const systemTitle = document.createElement('span'); bindText(systemTitle, () => t('mqtt.system'));
  const systems = document.createElement('select'); systems.id = 'mqtt-system'; systemLabel.append(systemTitle, systems);
  const controls = document.createElement('div'); controls.className = 'project-form'; controls.append(brokerLabel, systemLabel); panel.append(controls);
  const feedback = document.createElement('p'); feedback.setAttribute('role', 'status'); panel.append(feedback);
  const overview = document.createElement('ul'); overview.className = 'mqtt-overview'; panel.append(overview);
  const catalog = document.createElement('details'); catalog.id = 'mqtt-catalog-view';
  const catalogTitle = document.createElement('summary'); bindText(catalogTitle, () => t('mqtt.catalog')); catalog.append(catalogTitle);
  const catalogList = document.createElement('ul'); catalogList.className = 'mqtt-overview'; catalog.append(catalogList); panel.append(catalog);
  let state = {sequence: -1, brokers: [], systems: []}; let busy = false; let poll = false; let emitting = false;
  const changed = () => { emitting = true; document.dispatchEvent(new Event('z2ma-project-changed')); emitting = false; };
  function options(element, items, label) {
    const identity = JSON.stringify([t(label), items]);
    if (element.dataset.options === identity) return;
    element.dataset.options = identity;
    const previous = element.value;
    element.replaceChildren(...[['', t(label)], ...items].map(([id, caption]) => { const option = document.createElement('option'); option.value = id; option.textContent = caption; return option; }));
    if (items.some(([id]) => id === previous)) element.value = previous;
  }
  function paint() {
    options(brokers, state.brokers.map(broker => [broker.id, broker.name + ' · ' + broker.host + ':' + broker.port + (broker.tls ? ' · TLS' : '') + (broker.certificates ? ' · ' + t('mqtt.tlsLoaded') : '')]), 'mqtt.chooseBroker');
    options(systems, state.systems.map(system => [system.id, system.name + ' · ' + system.baseTopic]), 'mqtt.chooseSystem');
    overview.replaceChildren(...state.systems.map(system => {
      const row = document.createElement('li'); const broker = state.brokers.find(broker => broker.id === system.brokerId);
      bindText(row, () => system.name + ' · ' + t('mqtt.state.' + (broker?.state ?? 'disconnected')) + ' · '
        + t(system.reading ? 'mqtt.reading' : system.fresh ? 'mqtt.fresh' : system.stored ? 'mqtt.stale' : 'mqtt.unknown')
        + ' · ' + t('mqtt.counts', {devices: system.devices, scenes: system.scenes, revision: system.revision ?? '—'})
        + ' · ' + t(system.executing === null ? 'mqtt.operationUnknown' : system.executing ? 'mqtt.operationActive' : 'mqtt.operationStopped')
        + ' · ' + t('project.extensionBuilds', {installed: system.extensionVersion + ' ' + (system.build?.slice(0, 12) ?? '—'), bundled: (state.bundledExtension?.version ?? '') + ' ' + (state.bundledExtension?.build?.slice(0, 12) ?? '—')})
        + (system.fresh && system.build && state.bundledExtension ? ' · ' + t(system.build === state.bundledExtension.build ? 'project.extensionMatch' : 'project.extensionDifferent') : '')
        + (system.error || broker?.error ? ' · ' + t('mqtt.error.' + (system.error || broker.error)) : ''));
      return row;
    }));
  }
  async function refresh() {
    if (poll || busy) return;
    poll = true;
    try {
      const result = await bridge.network({action: 'status', id: ''});
      if (!result.ok) return;
      const previous = state.sequence; state = result.state; paint();
      if (previous !== state.sequence) catalogList.replaceChildren();
      if (previous !== state.sequence) changed();
    } catch { bindText(feedback, () => t('project.failed')); }
    finally { poll = false; }
  }
  async function command(action, source) {
    const id = ['refresh', 'view', 'catalog', 'validate', 'store', 'install', 'checkTransfer'].includes(action) ? systems.value : brokers.value;
    if (!id || busy) return;
    busy = true; panel.setAttribute('aria-busy', 'true');
    try {
      if (action === 'view' || action === 'catalog') await bridge.selectSystem(id);
      if (action === 'catalog') {
        const data = await bridge.snapshot();
        const devices = data.devices.map(device => {
          const row = document.createElement('li'); row.textContent = device.name + ' · ' + device.properties.map(property => property.label).join(', '); return row;
        });
        const scenes = (data.scenes ?? []).map(scene => {
          const row = document.createElement('li'); const target = data.devices.find(device => device.target.type === scene.target.type && device.target.id === scene.target.id);
          bindText(row, () => scene.name + ' · ' + (target?.name ?? '') + ' · #' + scene.id + (scene.endpoint ? ' · ' + t('mqtt.channel', {channel: scene.endpoint}) : '')); return row;
        });
        catalogList.replaceChildren(...devices, ...scenes); catalog.open = true; changed(); return;
      }
      const result = await bridge.network({action, id, ...(source ? {source} : {})});
      if (!result.ok) { bindText(feedback, () => t('project.' + result.error)); return; }
      state = result.state; paint(); changed();
      const outcome = result.state.outcome;
      bindText(feedback, () => t(outcome ? 'project.' + outcome : 'mqtt.requestAccepted'));
    } catch { bindText(feedback, () => t('project.failed')); }
    finally { busy = false; panel.removeAttribute('aria-busy'); }
  }
  for (const [key, action, source] of [['connect', 'connect'], ['disconnect', 'disconnect'], ['refresh', 'refresh'], ['catalog', 'catalog'], ['certificates', 'certificates'], ['clearCertificates', 'clearCertificates'], ['draft', 'view', 'draft'], ['stored', 'view', 'stored'], ['validate', 'validate'], ['store', 'store'], ['install', 'install'], ['checkTransfer', 'checkTransfer']]) {
    const button = document.createElement('button'); button.type = 'button'; button.id = 'mqtt-' + key;
    bindText(button, () => t('mqtt.' + key)); button.addEventListener('click', () => command(action, source)); controls.append(button);
  }
  const caution = document.createElement('p'); bindText(caution, () => t('mqtt.tlsHelp')); panel.append(caution);
  document.querySelector('#local-project').after(panel);
  document.addEventListener('z2ma-project-changed', () => { if (!emitting) void refresh(); });
  onLanguageChange(paint);
  setInterval(() => { void refresh(); }, 1000);
  await refresh();
}
