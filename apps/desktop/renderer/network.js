import {t, bindText, onLanguageChange, sortByName, formatNumber, language} from './localization.js';
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

function installConnectionCatalog(parent) {
  const panel = document.createElement('section');
  panel.id = 'mqtt-catalog'; panel.className = 'desktop-card desktop-read-catalog'; panel.hidden = true;
  parent.append(panel);
  const columns = ['device', 'group'].map(type => {
    const column = document.createElement('div');
    const title = document.createElement('h2'); title.id = 'mqtt-catalog-' + type + '-title';
    const list = document.createElement('ul');
    list.id = 'mqtt-catalog-' + type; list.className = 'mqtt-overview'; list.tabIndex = 0;
    list.setAttribute('aria-labelledby', title.id);
    const empty = document.createElement('p'); bindText(empty, () => t('desktop.catalog.empty.' + type));
    column.append(title, list, empty);
    panel.append(column);
    return {type, title, list, empty};
  });
  let shown;
  return function paintCatalog(view, fresh, scope) {
    panel.hidden = !(fresh && view?.desktop.project && view.status.confirmed);
    if (panel.hidden) return;
    const entries = view.devices;
    const signature = JSON.stringify([scope, language(), entries.map(entry => [entry.target.type, entry.name])]);
    if (shown === signature) return;
    shown = signature;
    for (const {type, title, list, empty} of columns) {
      const items = sortByName(entries.filter(entry => entry.target.type === type));
      bindText(title, () => t('desktop.catalog.' + type, {count: items.length}));
      list.hidden = !items.length;
      empty.hidden = Boolean(items.length);
      list.replaceChildren(...items.map(({name}) => {
        const row = document.createElement('li'); row.textContent = name;
        return row;
      }));
      list.scrollTop = 0;
    }
  };
}

export function installNetwork(bridge, workspace, settleEditor) {
  let view;
  let state = {sequence: -1, brokers: [], systems: []};
  let pending = false;
  let deferredStateChange = false;
  let polling = false;
  let selected = '';
  let operationFeedback;
  let setupFeedback;
  let connectionFeedback;
  let sourceFeedback;

  function current() {
    const system = state.systems.find(system => system.id === view?.workspaceContext?.systemId);
    return {view, system, broker: state.brokers.find(broker => broker.id === system?.brokerId)};
  }
  function updateState(next) {
    if (next.sequence < state.sequence) return;
    const changed = next.sequence !== state.sequence;
    state = next;
    if (changed && pending) deferredStateChange = true;
    else if (changed) document.dispatchEvent(new Event('z2ma-project-changed'));
  }
  async function refresh() {
    if (polling) return;
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
      if (deferredStateChange) { deferredStateChange = false; document.dispatchEvent(new Event('z2ma-project-changed')); }
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
  workspace.pages.operation.append(operation);
  const operationState = status(operation);
  const operationConnection = actions(operation);
  const connectOperation = workspace.link(operationConnection, 'connection');
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
  const flags = document.createElement('details'); flags.className = 'desktop-card'; workspace.pages.operation.append(flags);
  const flagsTitle = document.createElement('summary'); bindText(flagsTitle, () => t('desktop.operation.flags')); flags.append(flagsTitle);
  const flagsHelp = document.createElement('p'); bindText(flagsHelp, () => t('desktop.operation.flagsHelp')); flags.append(flagsHelp);
  const flagActions = actions(flags);
  workspace.link(flagActions, 'automations');
  workspace.link(flagActions, 'review');
  const review = installDraftReview(bridge, workspace, {current, perform, command, busy: () => pending, button});

  const connection = document.createElement('section'); connection.className = 'desktop-card';
  workspace.pages.connection.append(connection);
  const connectionState = status(connection);
  const catalogState = document.createElement('p'); connection.append(catalogState);
  const connectionActions = actions(connection);
  const connect = button(connectionActions, 'mqtt-connect', 'desktop.steps.connection', () => systemCommand('connect', (key, name) => { connectionFeedback = {key, name}; }));
  connect.className = 'primary';
  const read = button(connectionActions, 'mqtt-refresh', 'desktop.steps.readState', () => systemCommand('refresh', () => { connectionFeedback = undefined; }));
  const disconnect = button(connectionActions, 'mqtt-disconnect', 'mqtt.disconnect', () => systemCommand('disconnect', () => { connectionFeedback = undefined; }));
  const editBroker = workspace.link(connectionActions, 'broker');
  editBroker.addEventListener('click', () => {
    const choice = document.querySelector('#project-brokerChoice');
    if (!choice || !current().broker) return;
    choice.value = current().broker.id; choice.dispatchEvent(new Event('change'));
  });
  const editSystem = workspace.link(connectionActions, 'system');
  const nextDraft = workspace.link(connectionActions, 'draft');
  const paintCatalog = installConnectionCatalog(workspace.pages.connection);

  const localActions = document.querySelector('#draft-local-actions');
  const storedActions = document.querySelector('#draft-stored-actions');
  const local = button(localActions, 'mqtt-draft', 'desktop.steps.editDraft', () => openSource('draft'));
  const stored = button(storedActions, 'mqtt-stored', 'desktop.review.viewStored', () => openSource('stored'));
  local.className = 'primary';
  localActions.prepend(local);
  storedActions.prepend(stored);
  const sourceResult = status(workspace.pages.draft); sourceResult.className = 'desktop-feedback';
  function openSource(source) {
    return perform(async () => {
      const {system} = current();
      if (!system) return;
      sourceFeedback = '';
      if (view.desktop.source !== source) {
        const response = await command('view', system.id, {source});
        if (!response.ok) { sourceFeedback = 'project.' + response.error; return; }
      }
      workspace.show('automations');
    }, () => { sourceFeedback = 'project.failed'; });
  }

  const setup = document.createElement('details'); setup.className = 'desktop-card'; workspace.pages.connection.append(setup);
  const setupTitle = document.createElement('summary'); bindText(setupTitle, () => t('desktop.setup.connection')); setup.append(setupTitle);
  const versions = document.createElement('p'); setup.append(versions);
  const updateHelp = document.createElement('p'); bindText(updateHelp, () => t('project.extensionUpdateHelp')); setup.append(updateHelp);
  const connectionSettings = actions(setup);
  const setupResult = status(setup);
  const install = button(connectionSettings, 'mqtt-install', 'mqtt.install', () => systemCommand('install', (key, name) => { setupFeedback = {key, name}; }));
  const resolveInstall = button(connectionSettings, 'mqtt-install-check', 'project.extensionCheck', () => systemCommand('checkTransfer', (key, name) => { setupFeedback = {key, name}; }));

  const brokerChoice = document.querySelector('#project-brokerChoice');
  const tls = document.createElement('details'); tls.className = 'desktop-tls'; brokerChoice.closest('.desktop-card').append(tls);
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
    if (!system) return 'desktop.steps.need.system';
    if (broker?.error) return 'desktop.connection.' + broker.error;
    if (broker?.autoConnect?.issue) return 'desktop.connection.' + broker.autoConnect.issue;
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
    bindText(catalogState, () => system?.fresh ? t('desktop.steps.catalog', {devices: formatNumber(system.devices), scenes: formatNumber(system.scenes)}) : '');
    paintCatalog(view, connected && system?.fresh, selected);
    connect.hidden = connected;
    connect.disabled = pending || !system || connecting;
    read.hidden = !connected;
    read.disabled = pending || Boolean(system?.reading);
    read.classList.toggle('primary', !system?.fresh);
    nextDraft.classList.toggle('primary', Boolean(system?.fresh));
    editBroker.hidden = !broker?.error && !broker?.autoConnect?.issue;
    editSystem.hidden = !system?.error;
    const update = state.extensionUpdates?.find(update => update.id === system?.id);
    const updating = Boolean(update && !update.failed && update.stage !== 'complete');
    bindText(setupResult, () => updating ? t('project.extensionUpdate.' + update.stage) : feedbackText(setupFeedback));
    setup.setAttribute('aria-busy', String(updating));
    resolveInstall.hidden = !update?.failed && setupFeedback?.key !== 'project.transferUncertain';
    resolveInstall.disabled = pending || !connected;
    disconnect.disabled = pending || (!connected && !connecting);
    install.disabled = pending || !connected;
    versions.hidden = !system;
    bindText(versions, () => t('project.extensionBuilds', {installed: system?.extensionVersion || '—', bundled: state.bundledExtension?.version ?? '—'}));
    local.disabled = pending || !system;
    stored.disabled = pending || !system?.stored;
    bindText(sourceResult, () => sourceFeedback ? t(sourceFeedback) : '');

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
      connectionFeedback = operationFeedback = setupFeedback = sourceFeedback = undefined;
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
