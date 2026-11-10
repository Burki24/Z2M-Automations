import {t, bindText, onLanguageChange, sortByName} from './localization.js';
import {installDraftReview} from './draft-review.js';

function button(parent, id, key, action) {
  const element = document.createElement('button'); element.type = 'button';
  if (id) element.id = id;
  bindText(element, () => t(key));
  element.addEventListener('click', action);
  parent.append(element);
  return element;
}

function actions(parent) {
  const row = document.createElement('div'); row.className = 'project-actions'; parent.append(row); return row;
}

function status(parent) {
  const label = document.createElement('p'); label.setAttribute('role', 'status'); parent.append(label); return label;
}

function setOptions(element, items, empty) {
  const entries = [['', empty], ...items];
  const signature = JSON.stringify(entries);
  if (element.dataset.options === signature) return;
  element.dataset.options = signature;
  const previous = element.value;
  element.replaceChildren(...entries.map(([id, title]) => new Option(title, id)));
  if (items.some(([id]) => id === previous)) element.value = previous;
}

export function installNetwork(bridge, workspace, settleEditor) {
  let view;
  let state = {sequence: -1, brokers: [], systems: []};
  let pending = false;
  let polling = false;
  let selected = '';
  let operationFeedback;
  let setupFeedback;
  let connectionFeedback;

  function current() {
    const system = state.systems.find(system => system.id === view?.workspaceContext?.systemId);
    return {view, system, broker: state.brokers.find(broker => broker.id === system?.brokerId)};
  }
  function updateState(next) {
    if (next.sequence < state.sequence) return;
    const changed = next.sequence !== state.sequence;
    state = next;
    if (changed) document.dispatchEvent(new Event('z2ma-project-changed'));
  }
  async function refresh() {
    if (pending || polling) return;
    polling = true;
    try {
      const response = await bridge.network({action: 'status', id: ''});
      if (response.ok) { updateState(response.state); paint(); }
    } finally { polling = false; }
  }
  async function command(action, id, fields = {}) {
    const response = await bridge.network({action, id, ...fields});
    if (response.ok) updateState(response.state);
    return response;
  }
  async function perform(task, failed) {
    const picker = document.querySelector('#designer-system');
    if (pending || !view?.desktop.project || picker?.disabled || document.querySelector('dialog[open]')) return;
    pending = true;
    if (picker) picker.disabled = true;
    workspace.review.setAttribute('aria-busy', 'true');
    paint();
    try { await settleEditor(); await task(); }
    catch { failed(); }
    finally {
      pending = false;
      if (picker) picker.disabled = false;
      workspace.review.removeAttribute('aria-busy');
      paint();
    }
  }
  function systemCommand(action, target, fields) {
    return perform(async () => {
      const {system, broker} = current();
      if (!system) return;
      const response = await command(action, ['connect', 'disconnect'].includes(action) ? broker.id : system.id, fields);
      const outcome = response.ok ? response.state.outcome : response.error;
      const key = response.ok && outcome === 'runtimeConfirmed' ? 'desktop.operation.' + action
        : outcome ? 'project.' + outcome : '';
      target(key, system.name);
    }, () => target('project.failed', current().system?.name));
  }

  const operation = document.createElement('section'); operation.className = 'desktop-card';
  const title = document.createElement('h1'); bindText(title, () => t('desktop.operation'));
  operation.append(title); workspace.operation.append(operation);
  const operationState = status(operation);
  const operationConnection = actions(operation);
  const connectOperation = button(operationConnection, '', 'desktop.connect', () => systemCommand('connect', (key, name) => { operationFeedback = {key, name}; }));
  const runtimeStatus = button(operationConnection, 'mqtt-runtimeStatus', 'desktop.operation.readStatus', () => systemCommand('runtimeStatus', () => { operationFeedback = undefined; }));
  const automatic = document.createElement('fieldset'); operation.append(automatic);
  const automaticTitle = document.createElement('legend'); bindText(automaticTitle, () => t('desktop.operation.automatic')); automatic.append(automaticTitle);
  const resumeLabel = document.createElement('label'); resumeLabel.className = 'desktop-checkbox';
  const resume = document.createElement('input'); resume.type = 'checkbox';
  const resumeTitle = document.createElement('span'); bindText(resumeTitle, () => t('mqtt.resume'));
  resumeLabel.append(resume, resumeTitle); automatic.append(resumeLabel);
  const automaticActions = actions(automatic);
  const runtimeResult = status(operation);
  const runtimeAction = (action, fields) => systemCommand(action, (key, name) => { operationFeedback = {key, name}; }, fields);
  const activate = button(automaticActions, 'mqtt-activate', 'mqtt.activate', () => runtimeAction('activate', {resume: resume.checked}));
  const deactivate = button(automaticActions, 'mqtt-deactivate', 'mqtt.deactivate', () => runtimeAction('deactivate'));
  const single = document.createElement('fieldset'); operation.insertBefore(single, runtimeResult);
  const singleTitle = document.createElement('legend'); bindText(singleTitle, () => t('desktop.operation.single')); single.append(singleTitle);
  const ruleLabel = document.createElement('label'); ruleLabel.className = 'field';
  const ruleTitle = document.createElement('span'); bindText(ruleTitle, () => t('mqtt.runtimeRule'));
  const rules = document.createElement('select'); rules.id = 'mqtt-rule'; ruleLabel.append(ruleTitle, rules); single.append(ruleLabel);
  const singleActions = actions(single);
  const runOnce = button(singleActions, 'mqtt-run_once', 'desktop.operation.runOnce', () => runtimeAction('run_once', {rule: rules.value}));
  const stopRule = button(singleActions, 'mqtt-stop_rule', 'mqtt.stop_rule', () => {
    const run = current().system?.runtime?.runs.find(run => run.rule === rules.value && run.state === 'running');
    if (run) runtimeAction('stop_rule', {rule: run.rule, run: run.run});
  });
  const runs = document.createElement('ul'); runs.className = 'mqtt-overview'; operation.append(runs);
  const flags = document.createElement('details'); flags.className = 'desktop-card'; workspace.operation.append(flags);
  const flagsTitle = document.createElement('summary'); bindText(flagsTitle, () => t('desktop.operation.flags')); flags.append(flagsTitle);
  const flagsHelp = document.createElement('p'); bindText(flagsHelp, () => t('desktop.operation.flagsHelp')); flags.append(flagsHelp);
  const review = installDraftReview(bridge, workspace, {current, perform, command, busy: () => pending, button, flags: actions(flags)});

  const connection = document.createElement('div'); connection.className = 'desktop-connection-actions';
  workspace.review.append(connection);
  const connectionState = status(connection);
  const connectionActions = actions(connection);
  const connect = button(connectionActions, 'mqtt-connect', 'desktop.connect', () => systemCommand('connect', (key, name) => { connectionFeedback = {key, name}; }));
  const read = button(connectionActions, 'mqtt-refresh', 'desktop.readDevices', () => systemCommand('refresh', () => { connectionFeedback = undefined; }));
  const setupLink = button(connectionActions, 'mqtt-setupBroker', 'desktop.setupLink', () => workspace.showSetup('brokers'));

  const exchange = document.querySelector('#draft-exchange-actions');
  const viewSource = button(exchange, 'mqtt-stored', 'desktop.review.viewStored', () => perform(async () => {
    const {system} = current();
    if (!system) return;
    const response = await command('view', system.id, {source: view.desktop.source === 'draft' ? 'stored' : 'draft'});
    connectionFeedback = {key: response.ok ? '' : 'project.' + response.error, name: system.name};
  }, () => { connectionFeedback = {key: 'project.failed'}; }));
  button(exchange, '', 'desktop.review.checkTransfer', review.checkTransfer);

  const setup = document.createElement('details'); setup.id = 'desktop-setup-connection'; setup.name = 'desktop-setup'; setup.className = 'desktop-card'; workspace.setup.append(setup);
  const setupTitle = document.createElement('summary'); bindText(setupTitle, () => t('desktop.setup.connection')); setup.append(setupTitle);
  const setupState = status(setup);
  const versions = document.createElement('p'); setup.append(versions);
  const connectionSettings = actions(setup);
  const setupResult = status(setup);
  const disconnect = button(connectionSettings, 'mqtt-disconnect', 'mqtt.disconnect', () => systemCommand('disconnect', (key, name) => {
    setupFeedback = {key: key || 'desktop.setup.disconnected', name};
  }));
  const install = button(connectionSettings, 'mqtt-install', 'mqtt.install', () => systemCommand('install', (key, name) => { setupFeedback = {key, name}; }));

  const brokerChoice = document.querySelector('#project-brokerChoice');
  const tls = document.createElement('details'); tls.className = 'desktop-tls'; brokerChoice.closest('details').append(tls);
  const tlsTitle = document.createElement('summary'); bindText(tlsTitle, () => t('desktop.setup.tls')); tls.append(tlsTitle);
  const tlsHelp = document.createElement('p'); bindText(tlsHelp, () => t('mqtt.tlsHelp')); tls.append(tlsHelp);
  const tlsStatus = status(tls);
  const tlsActions = actions(tls);
  const changeTLS = action => perform(async () => {
    const id = brokerChoice.value;
    if (!id) return;
    const response = await command(action, id);
    if (!response.ok) bindText(tlsStatus, () => t('project.' + response.error));
    else {
      const imported = response.state.brokers.find(broker => broker.id === id)?.certificates;
      bindText(tlsStatus, () => t(imported ? 'desktop.setup.tlsLoaded' : 'desktop.setup.tlsEmpty'));
    }
  }, () => bindText(tlsStatus, () => t('project.failed')));
  const certificates = button(tlsActions, 'mqtt-certificates', 'mqtt.certificates', () => changeTLS('certificates'));
  const clearCertificates = button(tlsActions, 'mqtt-clearCertificates', 'mqtt.clearCertificates', () => changeTLS('clearCertificates'));

  function connectionKey(system, broker) {
    if (!system) return 'desktop.noSystemHelp';
    if (broker?.error) return 'desktop.connection.' + broker.error;
    if (['connecting', 'reconnecting'].includes(broker?.state)) return 'desktop.connection.connecting';
    if (broker?.state !== 'connected') return 'desktop.connection.offline';
    if (system.reading) return 'desktop.connection.reading';
    if (system.error) return 'desktop.connection.noReply';
    return system.fresh ? 'desktop.connection.ready' : 'desktop.connection.readFirst';
  }
  const feedbackText = data => data?.key ? t(data.key, {name: data.name ?? ''}) : '';
  function paint() {
    const {system, broker} = current();
    const connected = broker?.state === 'connected';
    const connecting = ['connecting', 'reconnecting'].includes(broker?.state);
    const viewRuntime = system?.runtime;
    const runtimeReady = Boolean(connected && viewRuntime);
    const name = system?.name ?? '';
    const connectionMessage = () => t(connectionKey(system, broker), {name, broker: broker?.name ?? ''});
    bindText(connectionState, () => feedbackText(connectionFeedback) || connectionMessage());
    connection.hidden = Boolean(system?.fresh && connected && !connectionFeedback?.key);
    connect.hidden = connected;
    connect.disabled = connectOperation.disabled = pending || !system || connecting;
    read.hidden = !connected;
    read.disabled = pending || Boolean(system?.reading);
    setupLink.hidden = !broker?.error && !system?.error;
    bindText(setupState, connectionMessage);
    bindText(setupResult, () => feedbackText(setupFeedback));
    disconnect.disabled = pending || (!connected && !connecting);
    install.disabled = pending || !connected;
    versions.hidden = !system;
    bindText(versions, () => t('project.extensionBuilds', {installed: system?.extensionVersion || '—', bundled: state.bundledExtension?.version ?? '—'}));
    viewSource.disabled = pending || !system?.stored;
    bindText(viewSource, () => t(view?.desktop.source === 'stored' ? 'desktop.review.viewDraft' : 'desktop.review.viewStored'));

    connectOperation.hidden = connected || !system;
    runtimeStatus.hidden = !connected;
    runtimeStatus.disabled = pending || Boolean(system?.reading);
    automatic.hidden = single.hidden = flags.hidden = !system;
    bindText(operationState, () => !runtimeReady ? connectionMessage() : t(system.executing ? 'desktop.operation.active' : 'desktop.operation.stopped', {name}));
    setOptions(rules, sortByName(viewRuntime?.rules ?? []).map(rule => [rule.id, rule.name + ' · ' + t(rule.enabled ? 'mqtt.ruleEnabled' : 'mqtt.ruleDisabled')]), t('mqtt.chooseRule'));
    const running = viewRuntime?.runs.find(run => run.rule === rules.value && run.state === 'running');
    resume.disabled = pending || !runtimeReady || system.executing;
    activate.disabled = pending || !runtimeReady || system.executing || !viewRuntime.rules.some(rule => rule.enabled);
    deactivate.disabled = pending || !connected;
    rules.disabled = pending || !runtimeReady;
    runOnce.disabled = pending || !runtimeReady || !rules.value || Boolean(running);
    stopRule.disabled = pending || !running;
    bindText(runtimeResult, () => feedbackText(operationFeedback) || (runtimeReady && !viewRuntime.rules.length ? t('desktop.operation.noRules') : ''));
    const identity = JSON.stringify([viewRuntime?.runs, viewRuntime?.rules, document.documentElement.lang]);
    if (runs.dataset.items !== identity) {
      runs.dataset.items = identity;
      runs.replaceChildren(...(viewRuntime?.runs ?? []).map(run => {
        const row = document.createElement('li');
        const label = viewRuntime.rules.find(rule => rule.id === run.rule)?.name ?? run.rule;
        bindText(row, () => label + ' · ' + t('mqtt.runStep', {state: t('mqtt.run.' + run.state), step: run.step}));
        return row;
      }));
    }
    certificates.disabled = clearCertificates.disabled = pending || !brokerChoice.value;
    review.paint();
  }
  function update(data) {
    const id = data.desktop.projectId + ':' + data.desktop.epoch + ':' + data.workspaceContext?.systemId;
    if (id !== selected) {
      selected = id; resume.checked = false; rules.value = '';
      connectionFeedback = operationFeedback = setupFeedback = undefined;
    }
    view = data;
    paint();
    void refresh().catch(() => {});
  }
  rules.addEventListener('change', paint);
  brokerChoice.addEventListener('change', () => { bindText(tlsStatus, ''); paint(); });
  onLanguageChange(paint);
  setInterval(() => { void refresh().catch(() => {}); }, 1000);
  return update;
}
