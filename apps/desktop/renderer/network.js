import {t, bindText, formatNumber, onLanguageChange, sortByName} from './localization.js';

function validationLocation(issue) {
  const parts = issue.path ? issue.path.slice(1).split('/') : [];
  const labels = [];
  for (let index = 0; index < parts.length; index++) {
    const field = parts[index];
    const position = parts[index + 1];
    let label = /^\d+$/.test(field) ? formatNumber(Number(field) + 1) : t('validation.field.' + field);
    if (position && /^\d+$/.test(position)) {
      label = t('validation.position', {label, number: formatNumber(Number(position) + 1)});
      index++;
    }
    labels.push(!labels.length && issue.name ? t('validation.named', {label, name: issue.name}) : label);
  }
  return labels.join(' → ') || t('validation.document');
}

function validationReason(issue) {
  const field = issue.path.split('/').at(-1);
  if (issue.reason === 'required' || issue.reason === 'minItems' && issue.limit === 1) {
    if (field === 'triggers') return t('validation.addTrigger');
    if (field === 'actions') return t('validation.addAction');
  }
  if (issue.reason === 'pattern' && ['at', 'after', 'before'].includes(field)) return t('validation.timeFormat');
  return t('validation.reason.' + issue.reason, issue.limit === undefined ? {} : {limit: formatNumber(issue.limit)});
}

export async function installNetwork(bridge, openBrokerSetup) {
  const panel = document.createElement('details'); panel.className = 'desktop-project'; panel.id = 'mqtt-panel';
  const title = document.createElement('summary'); bindText(title, () => t('mqtt.title')); panel.append(title);
  const help = document.createElement('p'); bindText(help, () => t('mqtt.help')); panel.append(help);
  const brokerLabel = document.createElement('label'); const brokerTitle = document.createElement('span'); bindText(brokerTitle, () => t('mqtt.broker'));
  const brokers = document.createElement('select'); brokers.id = 'mqtt-broker'; brokerLabel.append(brokerTitle, brokers);
  const systemLabel = document.createElement('label'); const systemTitle = document.createElement('span'); bindText(systemTitle, () => t('mqtt.system'));
  const systems = document.createElement('select'); systems.id = 'mqtt-system'; systemLabel.append(systemTitle, systems);
  const controls = document.createElement('div'); controls.className = 'project-form'; controls.append(brokerLabel, systemLabel); panel.append(controls);
  const status = document.createElement('div'); status.setAttribute('role', 'status'); panel.append(status);
  const feedback = document.createElement('p');
  const findings = document.createElement('ul'); findings.id = 'mqtt-validation-issues'; findings.className = 'mqtt-overview'; findings.hidden = true;
  const moreFindings = document.createElement('p'); moreFindings.hidden = true; bindText(moreFindings, () => t('validation.more'));
  status.append(feedback, findings, moreFindings);
  const overview = document.createElement('ul'); overview.className = 'mqtt-overview'; panel.append(overview);
  const catalog = document.createElement('details'); catalog.id = 'mqtt-catalog-view';
  const catalogTitle = document.createElement('summary'); bindText(catalogTitle, () => t('mqtt.catalog')); catalog.append(catalogTitle);
  const catalogList = document.createElement('ul'); catalogList.className = 'mqtt-overview'; catalog.append(catalogList); panel.append(catalog);
  const runtime = document.createElement('fieldset'); panel.append(runtime);
  const legend = document.createElement('legend'); bindText(legend, () => t('mqtt.runtime')); runtime.append(legend);
  const runtimeHelp = document.createElement('p'); bindText(runtimeHelp, () => t('mqtt.runtimeHelp')); runtime.append(runtimeHelp);
  const runtimeState = document.createElement('p'); runtime.append(runtimeState);
  const runtimeForm = document.createElement('div'); runtimeForm.className = 'project-form'; runtime.append(runtimeForm);
  const ruleLabel = document.createElement('label'); const ruleTitle = document.createElement('span');
  bindText(ruleTitle, () => t('mqtt.runtimeRule')); const rules = document.createElement('select'); rules.id = 'mqtt-rule';
  ruleLabel.append(ruleTitle, rules); runtimeForm.append(ruleLabel);
  const resumeLabel = document.createElement('label'); const resume = document.createElement('input'); resume.type = 'checkbox';
  const resumeTitle = document.createElement('span'); bindText(resumeTitle, () => t('mqtt.resume')); resumeLabel.append(resume, resumeTitle); runtimeForm.append(resumeLabel);
  const runs = document.createElement('ul'); runs.className = 'mqtt-overview'; runtime.append(runs);
  const runtimeButtons = new Map();
  let state = {sequence: -1, brokers: [], systems: []}; let busy = false; let poll = false; let emitting = false;
  const changed = () => { emitting = true; document.dispatchEvent(new Event('z2ma-project-changed')); emitting = false; };
  function clearFindings() {
    delete findings.dataset.system;
    findings.replaceChildren();
    findings.hidden = moreFindings.hidden = true;
  }
  function clearOtherSystemFindings() {
    if (findings.dataset.system && findings.dataset.system !== systems.value) {
      clearFindings();
      bindText(feedback, () => '');
    }
  }
  function showFindings(details, systemId) {
    if (!details?.issues.length) return;
    findings.dataset.system = systemId;
    findings.replaceChildren(...details.issues.map(issue => {
      const row = document.createElement('li');
      const location = document.createElement('strong'); bindText(location, () => validationLocation(issue));
      const reason = document.createElement('span'); bindText(reason, () => ' · ' + validationReason(issue));
      row.append(location, reason);
      return row;
    }));
    findings.hidden = false;
    moreFindings.hidden = !details.truncated;
  }
  function options(element, items, label) {
    const identity = JSON.stringify([t(label), items]);
    if (element.dataset.options === identity) return;
    element.dataset.options = identity;
    const previous = element.value;
    element.replaceChildren(...[['', t(label)], ...items].map(([id, caption]) => { const option = document.createElement('option'); option.value = id; option.textContent = caption; return option; }));
    if (items.some(([id]) => id === previous)) element.value = previous;
  }
  function paintRuntime() {
    const system = state.systems.find(item => item.id === systems.value);
    const view = system?.runtime;
    options(rules, (view?.rules ?? []).map(rule => [rule.id, rule.id + ' · ' + t(rule.enabled ? 'mqtt.ruleEnabled' : 'mqtt.ruleDisabled')]), 'mqtt.chooseRule');
    const running = view?.runs.find(run => run.rule === rules.value && run.state === 'running');
    for (const [action, button] of runtimeButtons) {
      button.disabled = busy || !system || (action === 'activate' && (!view?.rules.some(rule => rule.enabled) || system.executing))
        || (action === 'run_once' && (!view || !rules.value || Boolean(running)))
        || (action === 'stop_rule' && !running);
    }
    bindText(runtimeState, () => t(view ? 'mqtt.recovery.' + view.recovery : 'mqtt.operationUnknown'));
    const identity = JSON.stringify([systems.value, view?.runs, (view?.runs ?? []).map(run => t('mqtt.run.' + run.state)), t('mqtt.runStep')]);
    if (runs.dataset.items !== identity) {
      runs.dataset.items = identity;
      runs.replaceChildren(...(view?.runs ?? []).map(run => {
        const row = document.createElement('li');
        bindText(row, () => run.rule + ' · ' + run.run + ' · ' + t('mqtt.runStep', {state: t('mqtt.run.' + run.state), step: run.step}));
        return row;
      }));
    }
  }
  function paint() {
    options(brokers, state.brokers.map(broker => [broker.id, broker.name + ' · ' + broker.host + ':' + broker.port + (broker.tls ? ' · TLS' : '') + (broker.certificates ? ' · ' + t('mqtt.tlsLoaded') : '')]), 'mqtt.chooseBroker');
    options(systems, state.systems.map(system => [system.id, system.name + ' · ' + system.baseTopic]), 'mqtt.chooseSystem');
    clearOtherSystemFindings();
    paintRuntime();
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
    const id = ['refresh', 'view', 'catalog', 'validate', 'store', 'install', 'checkTransfer', 'validateEnabled', ...runtimeButtons.keys()].includes(action) ? systems.value : brokers.value;
    if (!id || busy) return;
    clearFindings();
    const rule = rules.value;
    const run = state.systems.find(item => item.id === id)?.runtime?.runs.find(item => item.rule === rule && item.state === 'running')?.run;
    const runtimeFields = action === 'activate' ? {resume: resume.checked} : action === 'run_once' ? {rule} : action === 'stop_rule' ? {rule, run} : {};
    busy = true; paintRuntime(); panel.setAttribute('aria-busy', 'true');
    try {
      if (action === 'view' || action === 'catalog') await bridge.selectSystem(id);
      if (action === 'catalog') {
        const data = await bridge.snapshot();
        const devices = sortByName(data.devices).map(device => {
          const row = document.createElement('li'); row.textContent = device.name + ' · ' + device.properties.map(property => property.label).join(', '); return row;
        });
        const scenes = sortByName(data.scenes ?? []).map(scene => {
          const row = document.createElement('li'); const target = data.devices.find(device => device.target.type === scene.target.type && device.target.id === scene.target.id);
          bindText(row, () => scene.name + ' · ' + (target?.name ?? '') + ' · #' + scene.id + (scene.endpoint ? ' · ' + t('mqtt.channel', {channel: scene.endpoint}) : '')); return row;
        });
        catalogList.replaceChildren(...devices, ...scenes); catalog.open = true; changed(); return;
      }
      const result = await bridge.network({action, id, ...runtimeFields, ...(source ? {source} : {})});
      if ((action === 'validate' || action === 'validateEnabled') && systems.value !== id) return;
      if (!result.ok) {
        bindText(feedback, () => t('project.' + result.error));
        showFindings(result.validation, id);
        return;
      }
      state = result.state; paint(); changed();
      const outcome = result.state.outcome;
      bindText(feedback, () => t(outcome ? 'project.' + outcome : 'mqtt.requestAccepted'));
    } catch { bindText(feedback, () => t('project.failed')); }
    finally { busy = false; paintRuntime(); panel.removeAttribute('aria-busy'); }
  }
  for (const [key, action, source] of [['connect', 'connect'], ['disconnect', 'disconnect'], ['refresh', 'refresh'], ['catalog', 'catalog'], ['certificates', 'certificates'], ['clearCertificates', 'clearCertificates'], ['draft', 'view', 'draft'], ['stored', 'view', 'stored'], ['validate', 'validate'], ['validateEnabled', 'validateEnabled'], ['store', 'store'], ['install', 'install'], ['checkTransfer', 'checkTransfer']]) {
    const button = document.createElement('button'); button.type = 'button'; button.id = 'mqtt-' + key;
    bindText(button, () => t('mqtt.' + key)); button.addEventListener('click', () => command(action, source)); controls.append(button);
  }
  for (const action of ['runtimeStatus', 'activate', 'deactivate', 'run_once', 'stop_rule']) {
    const button = document.createElement('button'); button.type = 'button'; button.id = 'mqtt-' + action;
    bindText(button, () => t('mqtt.' + action)); button.addEventListener('click', () => command(action));
    runtimeButtons.set(action, button); runtimeForm.append(button);
  }
  rules.addEventListener('change', paintRuntime);
  systems.addEventListener('change', () => { clearOtherSystemFindings(); resume.checked = false; rules.value = ''; paintRuntime(); });
  const setupBroker = document.createElement('button'); setupBroker.type = 'button'; setupBroker.id = 'mqtt-setupBroker';
  bindText(setupBroker, () => t('mqtt.setupBroker'));
  setupBroker.addEventListener('click', openBrokerSetup);
  brokers.closest('label').after(setupBroker);
  const draftShortcut = document.createElement('button'); draftShortcut.type = 'button'; draftShortcut.id = 'desktop-switch-to-draft';
  bindText(draftShortcut, () => t('mqtt.switchToDraft'));
  draftShortcut.addEventListener('click', async () => {
    if (draftShortcut.disabled) return;
    draftShortcut.disabled = true;
    try {
      const view = await bridge.snapshot();
      if (view.desktop.source !== 'stored' || !view.workspaceContext?.systemId) return;
      const result = await bridge.network({action: 'view', id: view.workspaceContext.systemId, source: 'draft'});
      if (!result.ok) throw new Error();
      changed();
    } catch { bindText(document.querySelector('#feedback'), () => t('project.failed')); }
    finally { draftShortcut.disabled = false; }
  });
  document.querySelector('#draft-status').after(draftShortcut);
  document.addEventListener('z2ma-workflow-next', event => {
    const {systemId, next} = event.detail;
    const system = state.systems.find(item => item.id === systemId);
    if (!system || busy) return;
    if (systems.value !== system.id) {
      systems.value = system.id;
      systems.dispatchEvent(new Event('change'));
    }
    brokers.value = system.brokerId;
    panel.open = true;
    const target = {review: '#mqtt-validate', read: '#mqtt-refresh', connect: '#mqtt-connect'}[next];
    if (target) panel.querySelector(target).focus();
  });
  const caution = document.createElement('p'); bindText(caution, () => t('mqtt.tlsHelp')); panel.append(caution);
  document.querySelector('#local-project').after(panel);
  document.addEventListener('z2ma-project-changed', () => { if (!emitting) void refresh(); });
  onLanguageChange(paint);
  setInterval(() => { void refresh(); }, 1000);
  await refresh();
}
