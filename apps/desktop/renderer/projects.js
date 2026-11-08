import {t, bindText, onLanguageChange, language} from './localization.js';

// File paths and credential reads are intentionally absent from the renderer bridge.
export async function installProjects(bridge) {
  const root = document.createElement('details'); root.id = 'local-project'; root.className = 'desktop-project';
  const title = document.createElement('summary'); bindText(title, () => t('project.title')); root.append(title);
  const intro = document.createElement('p'); bindText(intro, () => t('project.help')); root.append(intro);
  const stateLabel = document.createElement('p'); stateLabel.setAttribute('role', 'status'); root.append(stateLabel);
  const feedback = document.createElement('p'); feedback.setAttribute('role', 'status'); root.append(feedback);
  const actions = document.createElement('div'); actions.className = 'project-actions'; root.append(actions);
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
      for (const form of [nameForm, brokerForm, systemForm, draftForm]) {
        if (!Array.isArray(values[form.id])) continue;
        for (const [id, value, checked] of values[form.id]) {
          const element = [...form.querySelectorAll('input,select')].find(input => input.id === id);
          if (!element || typeof value !== 'string' || value.length > 4096) continue;
          element.value = value; if (element.type === 'checkbox') element.checked = checked === true;
          if (['project-brokerChoice', 'project-systemChoice', 'project-draftSystem'].includes(id)) form.dataset.selected = value;
          if (id === 'project-draftChoice') form.dataset.rule = value;
          if (id === 'project-draftSystem') draftOptions();
        }
        pending.add(form);
      }
      if (pending.size) await bridge.project({action: 'editing'});
    } catch { /* Never let unavailable or invalid session storage discard the project. */ }
  }
  const refresh = () => document.dispatchEvent(new Event('z2ma-project-changed'));
  const show = key => bindText(feedback, () => t('project.' + key));
  function button(parent, key, action) {
    const element = document.createElement('button'); element.type = 'button'; element.id = 'project-' + key;
    bindText(element, () => t('project.' + key)); element.addEventListener('click', action); parent.append(element); return element;
  }
  function form(key) {
    const element = document.createElement('form'); element.className = 'project-form'; element.id = 'project-' + key + '-form';
    const legend = document.createElement('h3'); bindText(legend, () => t('project.' + key)); element.append(legend); root.append(element);
    element.addEventListener('input', event => {
      if (['project-brokerChoice', 'project-systemChoice', 'project-draftSystem', 'project-draftChoice', 'project-credentialBroker'].includes(event.target.id)) return;
      pending.add(element); rememberForms();
      if (state) state.dirty = true;
      bindText(stateLabel, () => t('project.unsaved'));
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
    const previous = element.value;
    element.replaceChildren(...[[ '', t('project.' + emptyKey)], ...entries].map(([value, label]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = label; return option;
    }));
    if (entries.some(([value]) => value === previous)) element.value = previous;
  }
  function resetForms() {
    for (const element of [nameForm, brokerForm, systemForm, draftForm, credentialForm]) { element.reset(); element.dataset.selected = ''; element.dataset.rule = ''; }
    pending.clear();
  }
  async function run(command, submitted = null) {
    if (busy) return false;
    busy = true; root.setAttribute('aria-busy', 'true');
    try {
      const result = await bridge.project(command);
      if (!result.ok) { show(result.error); return false; }
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
      paint();
      if (command.action === 'broker') { brokerChoice.value = command.broker.id; brokerForm.dataset.selected = command.broker.id; }
      if (command.action === 'system') { systemChoice.value = command.system.id; systemForm.dataset.selected = command.system.id; }
      refresh(); show('done'); return true;
    } catch { show('failed'); return false; }
    finally { busy = false; root.removeAttribute('aria-busy'); }
  }
  for (const action of ['new', 'open', 'save', 'saveAs', 'export', 'restore']) button(actions, action, () => run({action}));
  button(actions, 'refresh', () => run({action: 'status'}));
  button(actions, 'discardInputs', async () => {
    if (busy) return;
    try { sessionStorage.removeItem(inputStorageKey()); } catch {}
    resetForms(); const result = await bridge.project({action: 'edited'});
    if (result.ok) { state = result.state; paint(); show('done'); }
  });
  const nameForm = form('projectName'); const name = input(nameForm, 'name');
  button(nameForm, 'applyName', () => { if (nameForm.reportValidity()) void run({action: 'rename', name: name.value}, nameForm); });
  const brokerForm = form('broker'); const brokerChoice = select(brokerForm, 'brokerChoice');
  const brokerName = input(brokerForm, 'brokerName'); const host = input(brokerForm, 'host'); host.maxLength = 253;
  const port = input(brokerForm, 'port', 'number'); port.min = '1'; port.max = '65535'; port.defaultValue = '1883';
  const tls = input(brokerForm, 'tls', 'checkbox');
  brokerChoice.addEventListener('change', () => {
    // Selecting an existing broker must not discard unfinished fields.
    if (pending.has(brokerForm)) { brokerChoice.value = brokerForm.dataset.selected ?? ''; show('applyFirst'); return; }
    brokerForm.dataset.selected = brokerChoice.value;
    const broker = state?.project.brokers.find(item => item.id === brokerChoice.value);
    brokerName.value = broker?.name ?? ''; host.value = broker?.host ?? ''; port.value = String(broker?.port ?? 1883); tls.checked = broker?.tls ?? false;
  });
  button(brokerForm, 'applyBroker', () => {
    if (brokerForm.reportValidity()) void run({action: 'broker', broker: {id: brokerChoice.value || crypto.randomUUID(), name: brokerName.value, host: host.value, port: Number(port.value), tls: tls.checked}}, brokerForm);
  });
  const systemForm = form('system'); const systemChoice = select(systemForm, 'systemChoice');
  const systemName = input(systemForm, 'systemName'); const systemBroker = select(systemForm, 'systemBroker'); systemBroker.required = true;
  const topic = input(systemForm, 'topic'); topic.maxLength = 256;
  systemChoice.addEventListener('change', () => {
    if (pending.has(systemForm)) { systemChoice.value = systemForm.dataset.selected ?? ''; show('applyFirst'); return; }
    systemForm.dataset.selected = systemChoice.value;
    const system = state?.project.systems.find(item => item.id === systemChoice.value);
    systemName.value = system?.name ?? ''; systemBroker.value = system?.brokerId ?? ''; topic.value = system?.baseTopic ?? '';
  });
  button(systemForm, 'applySystem', () => {
    if (systemForm.reportValidity()) void run({action: 'system', system: {id: systemChoice.value || crypto.randomUUID(), name: systemName.value, brokerId: systemBroker.value, baseTopic: topic.value}}, systemForm);
  });
  const draftForm = form('draft'); const draftSystem = select(draftForm, 'draftSystem'); draftSystem.required = true; const draftChoice = select(draftForm, 'draftChoice');
  const draftName = input(draftForm, 'draftName');
  const draftHelp = document.createElement('p'); bindText(draftHelp, () => t('project.draftHelp')); draftForm.append(draftHelp);
  function draftOptions() {
    const system = state?.project.systems.find(item => item.id === draftSystem.value);
    options(draftChoice, (system?.configuration.automations ?? []).map(rule => [rule.id, rule.name]), 'newDraft');
  }
  draftSystem.addEventListener('change', () => {
    if (pending.has(draftForm)) { draftSystem.value = draftForm.dataset.selected ?? ''; show('applyFirst'); return; }
    draftForm.dataset.selected = draftSystem.value; draftOptions();
  });
  draftChoice.addEventListener('change', () => {
    if (pending.has(draftForm)) { draftChoice.value = draftForm.dataset.rule ?? ''; show('applyFirst'); return; }
    draftForm.dataset.rule = draftChoice.value;
    const system = state?.project.systems.find(item => item.id === draftSystem.value);
    const rule = system?.configuration.automations.find(rule => rule.id === draftChoice.value);
    if (!pending.has(draftForm)) draftName.value = rule?.name ?? '';
  });
  for (const operation of ['new', 'rename', 'copy', 'delete']) button(draftForm, operation + 'Draft', async () => {
    if (!draftSystem.value || !draftForm.reportValidity()) return;
    if (operation !== 'new' && !draftChoice.value) { show('selectDraft'); return; }
    // Main-process confirmation protects deletion through every caller.
    await run({action: 'draft', systemId: draftSystem.value, operation, ruleId: draftChoice.value, name: draftName.value}, draftForm);
  });
  const credentialForm = form('credentials'); const credentialBroker = select(credentialForm, 'credentialBroker'); credentialBroker.required = true;
  const mode = select(credentialForm, 'credentialMode');
  const secretState = document.createElement('p'); credentialForm.append(secretState);
  const secretHelp = document.createElement('p'); bindText(secretHelp, () => t('project.secretHelp')); credentialForm.append(secretHelp);
  async function credential(remove = false) {
    if (busy || !credentialBroker.value || (!remove && !credentialForm.reportValidity())) return;
    busy = true;
    try {
      const input = {brokerId: credentialBroker.value, mode: remove ? 'remove' : mode.value};
      const result = await bridge.credential(input);
      if (!result.ok) { show(result.error); return; }
      pending.delete(credentialForm); state = result.state;
      if (!pending.size) { const applied = await bridge.project({action: 'edited'}); if (applied.ok) state = applied.state; }
      paint(); show('done');
    } catch { show('failed'); }
    finally { busy = false; }
  }
  button(credentialForm, 'storeCredentials', () => credential());
  button(credentialForm, 'removeCredentials', () => credential(true));
  credentialBroker.addEventListener('change', () => {
    if (pending.has(credentialForm)) { credentialBroker.value = credentialForm.dataset.selected ?? ''; show('applyFirst'); return; }
    credentialForm.dataset.selected = credentialBroker.value;
    paintSecretState();
  });
  function paintSecretState() {
    bindText(secretState, () => t('project.secret.' + (state?.credentials[credentialBroker.value] ?? 'none')));
  }
  function paint() {
    bindText(stateLabel, () => t(state?.active ? state.dirty ? 'project.unsaved' : 'project.saved' : 'project.examples'));
    for (const element of [nameForm, brokerForm, systemForm, draftForm, credentialForm]) element.hidden = !state?.active;
    for (const action of ['save', 'saveAs', 'export', 'restore']) document.querySelector('#project-' + action).disabled = !state?.active;
    if (!state?.active) return;
    if (!pending.has(nameForm)) name.value = state.project.name;
    options(brokerChoice, state.project.brokers.map(broker => [broker.id, broker.name]), 'newBroker');
    options(systemChoice, state.project.systems.map(system => [system.id, system.name]), 'newSystem');
    options(systemBroker, state.project.brokers.map(broker => [broker.id, broker.name]), 'chooseBroker');
    options(draftSystem, state.project.systems.map(system => [system.id, system.name]), 'chooseSystem');
    options(credentialBroker, state.project.brokers.map(broker => [broker.id, broker.name]), 'chooseBroker');
    draftOptions();
    const previous = mode.value;
    options(mode, [['session', t('project.session')], ...(state.protectedAvailable ? [['protected', t('project.protected')]] : [])], 'chooseMode');
    mode.value = previous === 'protected' && !state.protectedAvailable ? '' : previous;
    mode.required = true; paintSecretState();
  }
  for (const element of [nameForm, brokerForm, systemForm, draftForm, credentialForm]) element.addEventListener('submit', event => event.preventDefault());
  document.body.prepend(root);
  onLanguageChange(() => { if (!busy) paint(); });
  // Synchronize native dialog language even when the stored preference overrides the OS.
  await bridge.language({language: language(), previousLanguage: language(), openEditor: false});
  const result = await bridge.project({action: 'status'});
  if (result.ok) { state = result.state; paint(); await restoreForms(); } else show('failed');
}
