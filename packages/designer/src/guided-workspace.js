import {t, bindText, bindAttribute, formatNumber} from './localization.js';

const orderedSteps = ['project', 'broker', 'system', 'connection', 'draft', 'automations', 'review', 'transfer'];
const pageKeys = [...orderedSteps, 'operation'];

export function installGuidedWorkspace({prefix = 'desktop', partnerActions = '#desktop-partner-actions'} = {}) {
  document.body.classList.add('guided-foundation');
  const shell = document.createElement('div'); shell.className = 'desktop-shell';
  const nav = document.createElement('nav'); nav.className = 'desktop-steps';
  bindAttribute(nav, 'aria-label', () => t(prefix + '.workspace'));
  const list = document.createElement('ol'); list.setAttribute('role', 'list');
  const compact = document.createElement('label'); compact.className = 'desktop-step-picker';
  const caption = document.createElement('span'); bindText(caption, () => t(prefix + '.steps.picker'));
  const picker = document.createElement('select'); picker.id = 'desktop-step';
  compact.append(caption, picker);
  nav.append(list, compact);

  const area = document.createElement('div'); area.className = 'desktop-content';
  const context = document.createElement('div'); context.className = 'desktop-context'; context.hidden = true;
  const project = document.createElement('span'); project.className = 'desktop-project-context';
  const connection = document.createElement('span'); connection.id = 'desktop-connection';
  connection.setAttribute('role', 'status');
  context.append(project, connection);
  area.append(context);
  shell.append(nav, area);
  document.querySelector('.app-header').after(shell);

  const pages = {};
  const sections = new Map();
  const buttons = new Map();
  let active = 'project';
  for (const [index, key] of pageKeys.entries()) {
    const numbered = index < orderedSteps.length;
    const number = () => formatNumber(index + 1).padStart(2, '0');
    const label = () => t(prefix + '.steps.' + key);
    const button = document.createElement('button'); button.type = 'button'; button.id = 'desktop-nav-' + key;
    const badge = document.createElement('span'); badge.className = 'desktop-step-number'; badge.setAttribute('aria-hidden', 'true');
    bindText(badge, () => numbered ? number() : '·');
    const name = document.createElement('span'); bindText(name, label);
    button.append(badge, name);
    button.addEventListener('click', () => show(key));
    buttons.set(key, button);
    if (numbered) {
      const item = document.createElement('li'); item.append(button); list.append(item);
    } else {
      button.classList.add('desktop-operation-link');
      nav.insertBefore(button, compact);
    }

    const option = new Option('', key);
    bindText(option, () => numbered ? number() + ' · ' + label() : label());
    picker.append(option);

    const section = document.createElement('section'); section.id = 'desktop-view-' + key; section.className = 'desktop-view';
    section.hidden = key !== active;
    const title = document.createElement('h1'); title.id = section.id + '-title'; title.tabIndex = -1;
    bindText(title, label);
    section.setAttribute('aria-labelledby', title.id);
    button.setAttribute('aria-controls', section.id);
    if (key === active) button.setAttribute('aria-current', 'step');
    const body = document.createElement('div'); body.className = 'desktop-step-body';
    const gate = document.createElement('div'); gate.className = 'desktop-card desktop-prerequisite'; gate.hidden = true;
    const hint = document.createElement('p'); gate.append(hint);
    const back = link(gate, 'project'); back.className = 'primary';
    section.append(title, gate, body);
    area.append(section);
    pages[key] = body;
    sections.set(key, {section, title, body, gate, hint, back});
  }
  picker.value = active;
  picker.addEventListener('change', () => { if (!show(picker.value, false)) picker.value = active; });

  const actions = document.createElement('div'); actions.className = 'project-actions desktop-workbar';
  const source = document.createElement('p'); source.className = 'desktop-source';
  pages.automations.append(source, actions);
  link(actions, 'draft');
  const review = document.createElement('section'); review.className = 'desktop-card desktop-review'; review.id = 'desktop-draft-review';
  pages.review.append(review);

  const observer = new ResizeObserver(() => {
    const offset = compact.offsetHeight ? nav.offsetHeight : context.offsetHeight;
    document.documentElement.style.setProperty('--desktop-scroll-top', offset + 'px');
  });
  observer.observe(nav);
  observer.observe(context);

  function show(key, focus = true) {
    if (document.querySelector('dialog[open]')) return false;
    if (key === active) return true;
    for (const [name, {section}] of sections) {
      section.hidden = name !== key;
      const button = buttons.get(name);
      if (name === key) button.setAttribute('aria-current', name === 'operation' ? 'page' : 'step');
      else button.removeAttribute('aria-current');
    }
    active = picker.value = key;
    sections.get(key).section.scrollTop = sections.get(key).body.scrollTop = 0;
    window.scrollTo(0, 0);
    if (focus) sections.get(key).title.focus({preventScroll: true});
    return true;
  }

  function link(parent, key, label = prefix + '.steps.' + key) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.step = key;
    bindText(button, () => t(label));
    button.addEventListener('click', () => show(button.dataset.step));
    parent.append(button);
    return button;
  }

  function updateProject(state, open = false) {
    context.hidden = !state.active;
    bindText(project, () => t(prefix + '.steps.projectContext', {name: state.project.name}));
    const needed = !state.active ? 'project' : !state.project.brokers.length ? 'broker' : !state.project.systems.length ? 'system' : '';
    const limit = orderedSteps.indexOf(needed);
    for (const [index, key] of pageKeys.entries()) {
      const {body, gate, hint, back} = sections.get(key);
      const blocked = limit !== -1 && index > limit;
      body.hidden = blocked;
      gate.hidden = !blocked;
      if (!blocked) continue;
      back.dataset.step = needed;
      bindText(hint, () => t(prefix + '.steps.need.' + needed));
      bindText(back, () => t(prefix + '.steps.' + needed));
    }
    if (open) show(needed || 'automations');
  }

  function mountDesigner() {
    connection.before(document.querySelector('.system-selector'));
    const menu = document.querySelector('.designer-menu');
    const create = document.querySelector('#draft-wizard-start');
    create.classList.add('primary');
    actions.prepend(create, menu.querySelector('#new-sequence-button'));
    const permissions = menu.querySelector('.permissions-open');
    if (permissions && document.querySelector(partnerActions)) document.querySelector(partnerActions).append(permissions);
    const navigation = document.querySelector('.workspace .navigation');
    const entries = navigation.querySelector('#entry-list');
    // Shared layout may place these siblings inside a responsive fold.
    const listContainer = entries.parentElement;
    const tools = document.createElement('div'); tools.className = 'desktop-navigation-tools';
    const heading = navigation.querySelector('.list-label');
    for (const child of [...listContainer.children]) if (child !== entries && child !== heading) tools.append(child);
    listContainer.prepend(tools);
    entries.tabIndex = 0;
    entries.setAttribute('role', 'region'); entries.setAttribute('aria-labelledby', 'list-label');
    entries.addEventListener('focusin', event => {
      const entry = event.target.closest('.entry');
      if (entry?.matches(':focus-visible') && entry.offsetHeight > entries.clientHeight) {
        queueMicrotask(() => entry.querySelector('strong')?.scrollIntoView({block: 'nearest'}));
      }
    });
    pages.automations.append(document.querySelector('.designer-feedback'), document.querySelector('.workspace'));
  }

  function update(data) {
    connection.hidden = !data.desktop.project || !data.workspaceContext?.systemId;
    context.dataset.hasSystem = String(!connection.hidden);
    connection.dataset.connected = String(data.status.mqttConnected);
    bindText(connection, () => t(data.status.mqttConnected ? prefix + '.connected'
      : data.status.autoConnectIssue ? prefix + '.autoConnect.' + data.status.autoConnectIssue : prefix + '.disconnected'));
    bindText(source, () => {
      if (data.desktop.source === 'stored') {
        return t(data.status.confirmed ? prefix + '.steps.storedSource' : prefix + '.steps.lastReadSource',
          {revision: formatNumber(data.status.storedRevision ?? 0)});
      }
      return t('mqtt.localRevision', {revision: formatNumber(data.desktop.draftRevision ?? 0)});
    });
  }

  return {pages, context, review, actions, show, link, mountDesigner, updateProject, update};
}
