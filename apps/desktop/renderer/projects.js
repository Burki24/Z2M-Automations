import {t, bindText, onLanguageChange, language, sortByName} from './localization.js';

// File paths and credential reads are intentionally absent from the renderer bridge.
export async function installProjects(bridge, workspace) {
  function group(step, id) {
    const card = document.createElement('section'); card.id = id; card.className = 'desktop-card';
    const feedback = document.createElement('p'); feedback.className = 'setup-feedback'; feedback.setAttribute('role', 'status');
    feedback.hidden = true; card.append(feedback); workspace.pages[step].append(card); return card;
  }
  const file = group('project', 'local-project');
  const brokerGroup = group('broker', 'desktop-setup-brokers');
  const systemGroup = group('system', 'desktop-setup-systems');
  for (const [group, step] of [[brokerGroup, 'broker'], [systemGroup, 'system']]) {
    const help = document.createElement('p'); bindText(help, () => t('desktop.steps.' + step + 'Help')); group.append(help);
  }
  const nextBroker = workspace.link(workspace.pages.project, 'broker');
  const nextSystem = workspace.link(workspace.pages.broker, 'system');
  const nextConnection = workspace.link(workspace.pages.system, 'connection');
  for (const next of [nextBroker, nextSystem, nextConnection]) next.className = 'primary';
  const stateLabel = document.createElement('p'); file.append(stateLabel);
  const actions = document.createElement('div'); actions.className = 'project-actions'; file.append(actions);
  let state = null;
  let busy = false;
  const pending = new Set();
  const inputStorageKey = () => 'z2ma.project.forms.' + state?.project.id + '.' + state?.epoch;
  function rememberForms() {
    if (!state?.active) return;
    const values = {};
    for (const element of pending) {
      if (element.id === 'project-credentials-form') continue;
      values[element.id] = [...element.querySelectorAll('input,select')].map(input => [input.id, input.value, input.checked ?? false]);
    }
    try { sessionStorage.setItem(inputStorageKey(), JSON.stringify(values)); } catch { /* In-memory forms remain usable. */ }
  }
  async function restoreForms() {
    try {
      const raw = sessionStorage.getItem(inputStorageKey()); if (!raw || raw.length > 16384) return;
      const values = JSON.parse(raw);
      for (const form of [nameForm, brokerForm, systemForm]) {
        if (!Array.isArray(values[form.id])) continue;
        for (const [id, value, checked] of values[form.id]) {
          const element = [...form.querySelectorAll('input,select')].find(input => input.id === id);
          if (!element || typeof value !== 'string' || value.length > 4096) continue;
          element.value = value; if (element.type === 'checkbox') element.checked = checked === true;
          if (['project-brokerChoice', 'project-systemChoice'].includes(id)) form.dataset.selected = value;
        }
        pending.add(form);
      }
      if (pending.size) await bridge.project({action: 'editing'});
      paintSecretState();
      brokerOverview.markSelection();
      systemOverview.markSelection();
    } catch { /* Never let unavailable or invalid session storage discard the project. */ }
  }
  const refresh = () => document.dispatchEvent(new Event('z2ma-project-changed'));
  function show(card, key, values = {}) {
    const feedback = card.querySelector('.setup-feedback');
    feedback.hidden = false;
    card.append(feedback);
    bindText(feedback, () => t(key, values));
  }
  function button(parent, key, action) {
    const element = document.createElement('button'); element.type = 'button'; element.id = 'project-' + key;
    bindText(element, () => t('project.' + key)); element.addEventListener('click', action); parent.append(element); return element;
  }
  function form(key, card) {
    const element = document.createElement('form'); element.className = 'project-form'; element.id = 'project-' + key + '-form';
    const legend = document.createElement('h3'); bindText(legend, () => t('project.' + key)); element.append(legend); card.append(element);
    element.addEventListener('input', event => {
      if (key === 'credentials') return;
      if (['project-brokerChoice', 'project-systemChoice'].includes(event.target.id)) return;
      pending.add(element); rememberForms();
      if (element === brokerForm) paintSecretState();
      if (state) { state.dirty = true; paintFileState(); }
      void bridge.project({action: 'editing'});
    });
    return element;
  }
  function input(parent, key, type = 'text') {
    const label = document.createElement('label'); const caption = document.createElement('span'); bindText(caption, () => t('project.' + key));
    const element = document.createElement('input'); element.id = 'project-' + key; element.type = type; element.maxLength = 160;
    element.required = type !== 'checkbox'; label.append(caption, element); parent.append(label); return element;
  }
  function select(parent, key) {
    const label = document.createElement('label'); const caption = document.createElement('span'); bindText(caption, () => t('project.' + key));
    const element = document.createElement('select'); element.id = 'project-' + key; label.append(caption, element); parent.append(label); return element;
  }
  function options(element, entries, emptyKey) {
    const identity = JSON.stringify([t('project.' + emptyKey), entries]);
    if (element.dataset.options === identity) return;
    element.dataset.options = identity;
    const previous = element.value;
    element.replaceChildren(...[[ '', t('project.' + emptyKey)], ...entries].map(([value, label]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = label; return option;
    }));
    if (entries.some(([value]) => value === previous)) element.value = previous;
  }
  function overview(key, card, choice, nameField) {
    const section = document.createElement('section'); section.className = 'project-overview';
    const title = document.createElement('h2'); title.id = 'project-' + key + '-overview';
    const empty = document.createElement('p'); empty.id = 'project-' + key + '-empty';
    bindText(empty, () => t('desktop.overview.empty.' + key));
    const list = document.createElement('ul'); list.id = 'project-' + key + '-list'; list.setAttribute('role', 'list');
    section.setAttribute('aria-labelledby', title.id);
    section.append(title, empty, list);
    choice.form.before(section);

    function markSelection() {
      for (const row of list.querySelectorAll('button')) row.setAttribute('aria-current', String(row.dataset.entryId === choice.value));
    }
    function paint(entries) {
      const signature = JSON.stringify(entries);
      if (signature !== list.dataset.entries) {
        list.dataset.entries = signature;
        bindText(title, () => t('desktop.overview.' + key, {count: entries.length}));
        empty.hidden = Boolean(entries.length);
        list.hidden = !entries.length;
        list.replaceChildren(...entries.map(([id, name, ...details]) => {
          const item = document.createElement('li');
          const row = document.createElement('button'); row.type = 'button'; row.dataset.entryId = id;
          row.setAttribute('aria-controls', choice.form.id);
          const label = document.createElement('strong'); label.textContent = name; row.append(label);
          for (const detail of details) {
            const text = document.createElement('span'); text.textContent = detail; row.append(text);
          }
          row.addEventListener('click', () => {
            if (busy) return;
            if (choice.value !== id) {
              choice.value = id;
              choice.dispatchEvent(new Event('change'));
            }
            if (choice.value === id) nameField.focus();
            else card.querySelector('.setup-feedback').scrollIntoView({block: 'nearest'});
          });
          item.append(row);
          return item;
        }));
      }
      markSelection();
    }
    return {paint, markSelection};
  }
  function protectSelection(form, choice, card) {
    if (!pending.has(form)) return false;
    choice.value = form.dataset.selected ?? '';
    show(card, 'project.applyFirst');
    form.before(card.querySelector('.setup-feedback'));
    return true;
  }
  function resetForms() {
    for (const element of [nameForm, brokerForm, systemForm, credentialForm]) { element.reset(); element.dataset.selected = ''; }
    pending.clear();
  }
  async function run(command, submitted = null) {
    if (busy) return false;
    const card = submitted?.closest('.desktop-card') ?? file;
    busy = true; card.setAttribute('aria-busy', 'true');
    try {
      const result = await bridge.project(command);
      if (!result.ok) { show(card, 'project.' + result.error); return false; }
      if (result.state.canceled) { show(card, 'desktop.setup.canceled'); return false; }
      const changedProject = result.state.epoch !== state?.epoch;
      if (changedProject) { try { sessionStorage.removeItem(inputStorageKey()); } catch {} resetForms(); }
      state = result.state;
      if (submitted) {
        pending.delete(submitted);
        if (!pending.size) {
          const applied = await bridge.project({action: 'edited'});
          if (applied.ok) state = applied.state;
        }
        rememberForms();
      }
      paint(command.action === 'open');
      if (command.action === 'broker') {
        brokerChoice.value = brokerForm.dataset.selected = command.broker.id;
        brokerOverview.markSelection();
        paintSecretState();
      }
      if (command.action === 'system') {
        systemChoice.value = systemForm.dataset.selected = command.system.id;
        systemOverview.markSelection();
      }
      const key = ['save', 'saveAs'].includes(command.action) ? 'save' : command.action;
      show(card, 'desktop.setup.result.' + key, {name: command.broker?.name ?? command.system?.name ?? state.project.name});
      refresh();
      return true;
    } catch { show(card, 'project.failed'); return false; }
    finally { busy = false; card.removeAttribute('aria-busy'); }
  }
  for (const action of ['new', 'open', 'save']) button(actions, action, () => run({action}));
  const projectOptions = document.createElement('details'); projectOptions.className = 'desktop-project-options';
  const optionsTitle = document.createElement('summary'); bindText(optionsTitle, () => t('desktop.steps.projectOptions'));
  const optionsActions = document.createElement('div'); optionsActions.className = 'project-actions';
  projectOptions.append(optionsTitle, optionsActions);
  for (const action of ['saveAs', 'export', 'restore']) button(optionsActions, action, () => run({action}));
  button(optionsActions, 'refresh', () => run({action: 'status'}));
  button(optionsActions, 'discardInputs', async () => {
    if (busy) return;
    try { sessionStorage.removeItem(inputStorageKey()); } catch {}
    resetForms(); const result = await bridge.project({action: 'edited'});
    if (result.ok) { state = result.state; paint(); show(file, 'desktop.setup.result.discard'); }
  });
  const nameForm = form('projectName', file); const name = input(nameForm, 'name');
  button(nameForm, 'applyName', () => { if (nameForm.reportValidity()) void run({action: 'rename', name: name.value}, nameForm); });
  file.append(projectOptions);
  const brokerForm = form('broker', brokerGroup); const brokerChoice = select(brokerForm, 'brokerChoice');
  const brokerName = input(brokerForm, 'brokerName'); const host = input(brokerForm, 'host'); host.maxLength = 253;
  const port = input(brokerForm, 'port', 'number'); port.min = '1'; port.max = '65535'; port.defaultValue = '1883';
  const tls = input(brokerForm, 'tls', 'checkbox');
  const brokerOverview = overview('broker', brokerGroup, brokerChoice, brokerName);
  brokerChoice.addEventListener('change', () => {
    if (protectSelection(brokerForm, brokerChoice, brokerGroup)) return;
    brokerForm.dataset.selected = brokerChoice.value;
    const broker = state?.project.brokers.find(item => item.id === brokerChoice.value);
    brokerName.value = broker?.name ?? ''; host.value = broker?.host ?? ''; port.value = String(broker?.port ?? 1883); tls.checked = broker?.tls ?? false;
    brokerOverview.markSelection();
    paintSecretState();
  });
  button(brokerForm, 'applyBroker', () => {
    if (brokerForm.reportValidity()) void run({action: 'broker', broker: {id: brokerChoice.value || crypto.randomUUID(), name: brokerName.value, host: host.value, port: Number(port.value), tls: tls.checked}}, brokerForm);
  });
  const systemForm = form('system', systemGroup); const systemChoice = select(systemForm, 'systemChoice');
  const systemName = input(systemForm, 'systemName'); const systemBroker = select(systemForm, 'systemBroker'); systemBroker.required = true;
  const topic = input(systemForm, 'topic'); topic.maxLength = 256;
  const systemOverview = overview('system', systemGroup, systemChoice, systemName);
  systemChoice.addEventListener('change', () => {
    if (protectSelection(systemForm, systemChoice, systemGroup)) return;
    systemForm.dataset.selected = systemChoice.value;
    const system = state?.project.systems.find(item => item.id === systemChoice.value);
    systemName.value = system?.name ?? ''; systemBroker.value = system?.brokerId ?? ''; topic.value = system?.baseTopic ?? '';
    systemOverview.markSelection();
  });
  button(systemForm, 'applySystem', () => {
    if (systemForm.reportValidity()) void run({action: 'system', system: {id: systemChoice.value || crypto.randomUUID(), name: systemName.value, brokerId: systemBroker.value, baseTopic: topic.value}}, systemForm);
  });
  const credentialForm = form('credentials', brokerGroup); brokerForm.after(credentialForm);
  const mode = select(credentialForm, 'credentialMode');
  const modeHint = document.createElement('p'); modeHint.id = 'project-credential-mode-hint';
  bindText(modeHint, () => t('project.chooseCredentialStorageFirst')); credentialForm.append(modeHint);
  mode.setAttribute('aria-describedby', modeHint.id);
  const secretState = document.createElement('p'); credentialForm.append(secretState);
  const secretHelp = document.createElement('p'); bindText(secretHelp, () => t('project.secretHelp')); credentialForm.append(secretHelp);
  async function credential(source) {
    const remove = source === 'remove';
    const brokerId = brokerChoice.value;
    if (busy || !brokerId || pending.has(brokerForm) || (!remove && !mode.value)) return;
    busy = true;
    try {
      const input = {brokerId, mode: remove ? 'remove' : mode.value, ...(source === 'manual' ? {source} : {})};
      const result = await bridge.credential(input);
      if (!result.ok) { show(brokerGroup, 'project.' + result.error); return; }
      if (result.state.canceled) { show(brokerGroup, 'desktop.setup.canceled'); return; }
      state = result.state;
      paint();
      show(brokerGroup, remove ? 'desktop.setup.credentialsRemoved' : 'desktop.setup.credentialsSaved',
        {name: state.project.brokers.find(broker => broker.id === brokerId)?.name ?? ''});
      refresh();
    } catch { show(brokerGroup, 'project.failed'); }
    finally { busy = false; }
  }
  const enterCredentials = button(credentialForm, 'enterCredentials', () => credential('manual'));
  const importCredentials = button(credentialForm, 'storeCredentials', () => credential());
  const removeCredentials = button(credentialForm, 'removeCredentials', () => credential('remove'));
  const automaticGroup = document.createElement('div'); automaticGroup.className = 'project-auto-connect';
  credentialForm.append(automaticGroup);
  const automatic = select(automaticGroup, 'autoConnect');
  const automaticHelp = document.createElement('p'); automaticHelp.id = 'project-autoConnect-help';
  bindText(automaticHelp, () => t('project.autoConnectHelp'));
  automatic.setAttribute('aria-describedby', automaticHelp.id);
  const automaticStatus = document.createElement('p'); automaticStatus.setAttribute('role', 'status');
  automaticGroup.append(automaticHelp, automaticStatus);
  automatic.addEventListener('change', async () => {
    const id = brokerChoice.value;
    if (busy || !id || pending.has(brokerForm)) { paintSecretState(); return; }
    const mode = automatic.value || 'off';
    busy = true; automatic.disabled = true;
    try {
      const result = await bridge.network({action: 'autoConnect', id, mode});
      if (!result.ok) { show(brokerGroup, 'project.' + result.error); return; }
      state.autoConnect = {...state.autoConnect, [id]: result.state.brokers.find(broker => broker.id === id).autoConnect};
      paint(); show(brokerGroup, 'project.autoConnectSaved'); refresh();
    } catch { show(brokerGroup, 'project.autoConnectSettings'); }
    finally { busy = false; paintSecretState(); }
  });
  mode.addEventListener('input', paintSecretState);
  function paintSecretState() {
    const available = Boolean(brokerChoice.value) && !pending.has(brokerForm);
    mode.disabled = !available;
    enterCredentials.disabled = importCredentials.disabled = !available || !mode.value;
    removeCredentials.disabled = !available;
    bindText(secretState, () => available ? t('project.secret.' + (state?.credentials[brokerChoice.value] ?? 'none'))
      : t('project.applyBrokerForCredentials'));
    options(automatic, [['credentials', t('project.autoConnect.credentials')], ['anonymous', t('project.autoConnect.anonymous')]], 'autoConnect.off');
    const setting = state?.autoConnect?.[brokerChoice.value];
    automatic.value = setting?.mode === 'off' ? '' : setting?.mode ?? '';
    automatic.disabled = !available;
    automaticStatus.hidden = !setting?.issue;
    bindText(automaticStatus, () => setting?.issue ? t('desktop.connection.' + setting.issue,
      {broker: state.project.brokers.find(broker => broker.id === brokerChoice.value)?.name ?? ''}) : '');
  }
  function paintFileState() {
    bindText(stateLabel, () => state?.active
      ? t(state.dirty ? 'desktop.fileUnsaved' : 'desktop.fileSaved', {name: state.project.name}) : t('desktop.noProjectHelp'));
  }
  function paintOverviews() {
    const {brokers, systems} = state.project;
    const sortedSystems = sortByName(systems);
    brokerOverview.paint(sortByName(brokers).map(({id, name, host, port, tls}) => {
      const address = (host.includes(':') ? '[' + host + ']' : host) + ':' + port;
      const assigned = sortedSystems.filter(system => system.brokerId === id).map(system => system.name);
      const setting = state.autoConnect?.[id];
      return [id, name, address + ' · ' + t(tls ? 'desktop.overview.tls' : 'desktop.overview.plain'),
        (assigned.length ? t('desktop.overview.assigned', {names: assigned.join(', ')}) : t('desktop.overview.unassigned'))
          + ' · ' + t('project.autoConnect.' + (setting?.mode ?? 'off'))
          + (setting?.issue ? ' · ' + t('desktop.autoConnect.' + setting.issue) : '')];
    }));
    systemOverview.paint(sortedSystems.map(({id, name, brokerId, baseTopic}) => [
      id, name, t('desktop.overview.brokerName', {name: brokers.find(broker => broker.id === brokerId)?.name ?? ''}),
      t('desktop.overview.baseTopic', {topic: baseTopic})
    ]));
  }
  function paint(open = false) {
    paintFileState();
    workspace.updateProject(state, open);
    nameForm.hidden = projectOptions.hidden = nextBroker.hidden = !state.active;
    file.querySelector('#project-save').hidden = !state.active;
    nextSystem.hidden = !state.project.brokers.length;
    nextConnection.hidden = !state.project.systems.length;
    if (!state.active) return;
    if (!pending.has(nameForm)) name.value = state.project.name;
    options(brokerChoice, state.project.brokers.map(broker => [broker.id, broker.name]), 'newBroker');
    options(systemChoice, state.project.systems.map(system => [system.id, system.name]), 'newSystem');
    options(systemBroker, state.project.brokers.map(broker => [broker.id, broker.name]), 'chooseBroker');
    paintOverviews();
    const previous = mode.value;
    options(mode, [['session', t('project.session')], ...(state.protectedAvailable ? [['protected', t('project.protected')]] : [])], 'chooseMode');
    mode.value = previous === 'protected' && !state.protectedAvailable ? '' : previous;
    mode.required = true; paintSecretState();
  }
  for (const element of [nameForm, brokerForm, systemForm, credentialForm]) element.addEventListener('submit', event => event.preventDefault());
  document.addEventListener('z2ma-project-changed', async () => {
    if (busy || !state) return;
    const epoch = state.epoch;
    try {
      const result = await bridge.project({action: 'status'});
      if (!busy && result.ok && result.state.epoch === epoch) { state = result.state; state.dirty ||= pending.size > 0; paint(); }
    } catch { /* A later explicit refresh can still recover the latest main-process state. */ }
  });
  document.addEventListener('z2ma-designer-view', ({detail: {desktop}}) => {
    if (!desktop.project || state?.epoch !== desktop.epoch) return;
    // The editor refreshes its own view after saving a draft.
    const dirty = desktop.projectDirty || pending.size > 0;
    if (state.dirty === dirty) return;
    state.dirty = dirty;
    paintFileState();
  });
  onLanguageChange(() => { if (!busy && state) paint(); });
  // Synchronize native dialog language even when the stored preference overrides the OS.
  await bridge.language({language: language(), previousLanguage: language(), openEditor: false});
  const result = await bridge.project({action: 'status'});
  if (result.ok) { state = result.state; paint(true); await restoreForms(); } else show(file, 'project.failed');
}
