import {t, bindText, bindAttribute, onLanguageChange, sortByName, language} from './localization.js';

const key = name => 'desktop.link.' + name;
function text(parent, tag, message, values = {}) {
  const element = document.createElement(tag); bindText(element, () => t(key(message), values)); parent.append(element); return element;
}
function button(parent, id, message, action) {
  const element = document.createElement('button'); element.type = 'button'; if (id) element.id = id;
  bindText(element, () => t(key(message))); element.addEventListener('click', action); parent.append(element); return element;
}

export function installSystemLink(bridge, workspace) {
  const entry = document.createElement('div'); entry.className = 'desktop-link-entry';
  const start = button(entry, 'desktop-link-start', 'title', open);
  const available = text(entry, 'p', 'needSystems'); available.className = 'field-help';
  document.querySelector('#desktop-partner-overview').before(entry);

  const dialog = document.createElement('dialog'); dialog.id = 'desktop-link-dialog'; dialog.className = 'desktop-link-dialog';
  dialog.setAttribute('aria-labelledby', 'desktop-link-title');
  const header = document.createElement('header');
  text(header, 'h2', 'title').id = 'desktop-link-title';
  const progress = document.createElement('p'); progress.className = 'field-help'; header.append(progress);
  const content = document.createElement('div'); content.className = 'desktop-link-content';
  const pages = ['choose', 'check', 'suggestions'].map((name, index) => {
    const page = document.createElement('section'); page.id = 'desktop-link-page-' + name;
    const title = text(page, 'h3', 'step.' + name); title.tabIndex = -1;
    page.setAttribute('aria-labelledby', title.id = page.id + '-title');
    content.append(page); return {page, title, index};
  });
  const choose = pages[0].page; text(choose, 'p', 'intro');
  const choices = document.createElement('div'); choices.className = 'desktop-link-choices'; choose.append(choices);
  const selects = ['first', 'second'].map(name => {
    const label = document.createElement('label'); text(label, 'span', name);
    const select = document.createElement('select'); select.id = 'desktop-link-' + name; label.append(select); choices.append(label);
    select.addEventListener('change', () => {
      plan = null; signature = ''; session++; loading = checking = false;
      if (selects[0].value === selects[1].value) selects[1].value = '';
      paint();
    });
    return select;
  });
  text(choose, 'p', 'readOnly').className = 'desktop-link-notice';
  const check = pages[1].page;
  const summary = document.createElement('p'); summary.setAttribute('role', 'status'); check.append(summary);
  const findings = document.createElement('div'); findings.id = 'desktop-link-findings'; check.append(findings);
  const external = document.createElement('section'); external.className = 'desktop-link-card';
  text(external, 'h4', 'externalTitle'); text(external, 'p', 'externalHelp');
  const externals = document.createElement('ul'); externals.className = 'desktop-link-checks'; external.append(externals); check.append(external);
  const checkActions = document.createElement('div'); checkActions.className = 'project-actions'; check.append(checkActions);
  const repeat = button(checkActions, 'desktop-link-repeat', 'repeat', () => void load(true));
  button(checkActions, 'desktop-link-connection', 'toConnection', () => jump('connection'));
  const suggestions = pages[2].page;
  text(suggestions, 'p', 'suggestionHelp').className = 'desktop-link-notice';
  const topology = document.createElement('p'); suggestions.append(topology);
  const snippets = document.createElement('div'); snippets.id = 'desktop-link-snippets'; suggestions.append(snippets);
  const followup = document.createElement('section'); followup.className = 'desktop-link-card';
  text(followup, 'h4', 'followupTitle');
  const steps = document.createElement('ol'); followup.append(steps);
  for (const name of ['backup', 'placeholders', 'apply', 'transfer', 'test']) text(steps, 'li', 'followup.' + name);
  const links = document.createElement('div'); links.className = 'project-actions';
  button(links, 'desktop-link-transfer', 'toTransfer', () => jump('transfer'));
  followup.append(links); suggestions.append(followup);
  const feedback = document.createElement('p'); feedback.className = 'desktop-link-feedback'; feedback.setAttribute('role', 'status');
  const footer = document.createElement('footer'); footer.className = 'dialog-actions';
  const cancel = button(footer, 'desktop-link-cancel', 'cancel', () => dialog.close());
  const back = button(footer, 'desktop-link-back', 'back', () => show(stage - 1));
  const next = button(footer, 'desktop-link-next', 'inspect', () => {
    if (stage === 0) { show(1); void load(true); }
    else if (stage === 1) show(2);
    else dialog.close();
  });
  next.className = 'primary';
  dialog.append(header, content, feedback, footer); document.body.append(dialog);

  let view;
  let stage = 0;
  let plan = null;
  let loading = false;
  let checking = false;
  let error = '';
  let signature = '';
  let session = 0;
  let timer;
  const projectKey = () => view?.desktop?.projectId + ':' + view?.desktop?.epoch;
  const systems = () => sortByName((view?.workspace?.systems ?? []).map(system => ({
    id: system.binding.systemId, name: system.name, topic: system.binding.baseTopic
  })));

  function paintOptions() {
    const options = systems();
    const identity = JSON.stringify([language(), options]);
    for (const select of selects) {
      if (select.dataset.items === identity) continue;
      const previous = select.value;
      select.replaceChildren(new Option(t(key('selectSystem')), ''), ...options.map(system => new Option(system.name + ' · ' + system.topic, system.id)));
      select.value = previous; select.dataset.items = identity;
    }
  }
  function row(parent, id, state, detail, values = {}) {
    const item = document.createElement('li'); item.dataset.state = state;
    const badge = document.createElement('strong'); badge.className = 'desktop-link-badge';
    badge.textContent = t(key('state.' + state));
    const line = document.createElement('div'); text(line, 'strong', 'check.' + id);
    text(line, 'p', 'detail.' + detail, values);
    item.append(badge, line); parent.append(item);
  }
  function paintPlan() {
    const identity = JSON.stringify([language(), plan]);
    if (identity === signature) return;
    signature = identity;
    const oldScroll = content.scrollTop;
    findings.replaceChildren(); externals.replaceChildren(); snippets.replaceChildren();
    if (!plan) return;
    const report = plan;
    const general = document.createElement('ul'); general.className = 'desktop-link-checks';
    for (const item of plan.checks) row(general, item.id, item.state, item.detail);
    findings.append(general);
    for (const system of plan.systems) {
      const card = document.createElement('section'); card.className = 'desktop-link-card'; card.dataset.system = system.id;
      const title = document.createElement('h4'); title.textContent = system.name; card.append(title);
      text(card, 'p', 'endpoint', {broker: system.broker.name, host: system.broker.host, port: system.broker.port, topic: system.baseTopic});
      const list = document.createElement('ul'); list.className = 'desktop-link-checks'; card.append(list);
      for (const item of system.checks) row(list, item.id, item.state, item.detail,
        {system: system.name, partner: system.partner, version: system.extensionVersion || '—'});
      if (system.error) {
        const reason = document.createElement('p'); reason.className = 'desktop-link-notice';
        bindText(reason, () => t('mqtt.error.' + system.error)); card.append(reason);
      }
      button(card, '', 'toPermissions', () => void jump('system', system.id));
      findings.append(card);
    }
    for (const [name, state] of Object.entries(plan.external)) {
      row(externals, name, state, name === 'bridge' && state === 'unneeded' ? 'bridgeUnneeded' : 'external.' + name);
    }
    bindText(topology, () => t(key('topology.' + report.topology)));
    if (!plan.suggestions.length) text(snippets, 'p', 'noSuggestions').className = 'desktop-link-notice';
    for (const item of plan.suggestions) {
      const system = plan.systems.find(system => system.id === item.systemId);
      const box = document.createElement('details'); box.className = 'desktop-link-card'; box.dataset.kind = item.kind;
      text(box, 'summary', 'snippet.' + item.kind, {system: system.name, broker: system.broker.name});
      text(box, 'p', 'snippetHelp.' + item.kind);
      const code = document.createElement('textarea'); code.readOnly = true; code.spellcheck = false;
      code.value = item.text; code.rows = Math.min(16, item.text.trimEnd().split('\n').length + 1);
      bindAttribute(code, 'aria-label', () => t(key('snippet.' + item.kind), {system: system.name, broker: system.broker.name}));
      box.append(code);
      button(box, '', 'selectText', () => { code.focus(); code.select(); });
      text(box, 'p', 'copyHelp').className = 'field-help';
      snippets.append(box);
    }
    content.scrollTop = oldScroll;
  }
  function paint() {
    const count = systems().length;
    entry.hidden = !view?.desktop?.project;
    start.disabled = count < 2; available.hidden = count >= 2;
    if (!dialog.open) return;
    paintOptions();
    bindText(progress, () => t(key('progress'), {step: stage + 1, total: pages.length}));
    for (const {page, index} of pages) page.hidden = stage !== index;
    back.hidden = stage === 0;
    next.disabled = stage === 0 ? !selects[0].value || !selects[1].value || selects[0].value === selects[1].value : !plan || checking || plan.reading;
    repeat.disabled = loading || plan?.reading;
    bindText(next, () => t(key(stage === 0 ? 'inspect' : stage === 1 ? 'showSuggestions' : 'finish')));
    bindText(cancel, () => t(key(stage === 2 ? 'close' : 'cancel')));
    bindText(feedback, () => error ? t(key(error)) : '');
    bindText(summary, () => checking || plan?.reading ? t(key('checking')) : plan
      ? t(key(plan.missing ? 'issues' : 'checked'), {count: plan.missing}) : t(key('waiting')));
    dialog.setAttribute('aria-busy', String(checking || plan?.reading || false));
    paintPlan();
  }
  function show(value) {
    stage = Math.max(0, Math.min(pages.length - 1, value));
    clearTimeout(timer);
    paint(); content.scrollTop = 0; pages[stage].title.focus();
    if (stage > 0) schedule();
  }
  function schedule() {
    clearTimeout(timer);
    if (dialog.open && stage > 0) timer = setTimeout(() => void load(false), 1000);
  }
  async function load(check) {
    if (loading || !dialog.open || !selects[0].value || !selects[1].value) return;
    const captured = session; const context = projectKey();
    loading = true; checking = check; if (check) error = ''; paint();
    try {
      const response = await bridge.network({action: check ? 'linkCheck' : 'linkPlan', id: selects[0].value, peerId: selects[1].value});
      if (!dialog.open || captured !== session || context !== projectKey()) return;
      if (!response.ok || !response.state.linkPlan || response.state.linkPlan.projectId !== view.desktop.projectId
        || response.state.epoch !== view.desktop.epoch) throw new Error();
      plan = response.state.linkPlan; error = '';
    } catch {
      if (dialog.open && captured === session) { error = 'failed'; plan = null; }
    } finally {
      if (captured === session) { loading = checking = false; paint(); schedule(); }
    }
  }
  function open() {
    if (start.disabled || document.querySelector('dialog[open]')) return;
    session++; loading = checking = false; error = ''; plan = null; signature = ''; stage = 0;
    paintOptions();
    const choices = systems();
    if (!selects[0].value) selects[0].value = view.workspaceContext?.systemId || choices[0].id;
    if (!selects[1].value || selects[1].value === selects[0].value) selects[1].value = choices.find(system => system.id !== selects[0].value).id;
    dialog.showModal(); paint(); selects[0].focus();
  }
  async function jump(step, systemId) {
    if (systemId) {
      try { await bridge.selectSystem(systemId); }
      catch { error = 'failed'; paint(); return; }
      document.dispatchEvent(new Event('z2ma-project-changed'));
    }
    dialog.close(); workspace.show(step);
  }
  dialog.addEventListener('close', () => {
    // A queued close event may arrive after a new session has already opened.
    if (dialog.open) return;
    session++; loading = checking = false; clearTimeout(timer);
  });
  document.addEventListener('z2ma-designer-view', ({detail}) => {
    const previous = projectKey(); view = detail;
    if (dialog.open && previous !== projectKey()) dialog.close();
    paint();
  });
  onLanguageChange(paint);
  paint();
}
