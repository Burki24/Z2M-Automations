import {t, bindText, bindAttribute} from './localization.js';

export function installDesktopWorkspace() {
  const bar = document.createElement('div'); bar.className = 'desktop-navigation';
  const nav = document.createElement('nav'); bindAttribute(nav, 'aria-label', () => t('desktop.workspace'));
  const context = document.createElement('div'); context.className = 'desktop-context';
  const connection = document.createElement('span'); connection.id = 'desktop-connection'; connection.setAttribute('role', 'status');
  context.append(connection); bar.append(nav, context);
  document.querySelector('.app-header').after(bar);
  const sections = new Map();
  const navigation = new Map();
  let active = 'automations';
  for (const key of ['automations', 'setup', 'operation']) {
    const button = document.createElement('button'); button.type = 'button'; button.id = 'desktop-nav-' + key;
    const section = document.createElement('section'); section.id = 'desktop-view-' + key; section.className = 'desktop-view';
    section.hidden = key !== active; section.setAttribute('aria-labelledby', button.id);
    button.setAttribute('aria-controls', section.id);
    if (key === active) button.setAttribute('aria-current', 'page');
    bindText(button, () => t('desktop.' + key));
    button.addEventListener('click', () => show(key));
    sections.set(key, section); navigation.set(key, button);
    nav.append(button); document.body.append(section);
  }
  const automations = sections.get('automations');
  const setup = sections.get('setup');
  const operation = sections.get('operation');
  const welcome = document.createElement('section'); welcome.className = 'desktop-card desktop-welcome';
  const welcomeTitle = document.createElement('h1');
  const welcomeText = document.createElement('p');
  const welcomeActions = document.createElement('div'); welcomeActions.className = 'project-actions';
  const openProject = document.createElement('button'); openProject.type = 'button'; openProject.id = 'desktop-open-project'; openProject.className = 'primary';
  const newProject = document.createElement('button'); newProject.type = 'button'; newProject.id = 'desktop-new-project';
  const setupSystem = document.createElement('button'); setupSystem.type = 'button'; setupSystem.id = 'desktop-setup-system'; setupSystem.className = 'primary';
  bindText(openProject, () => t('desktop.openProject'));
  bindText(newProject, () => t('project.new'));
  bindText(setupSystem, () => t('desktop.setupSystem'));
  for (const [button, action] of [[openProject, 'open'], [newProject, 'new']]) {
    button.addEventListener('click', () => {
      showSetup('file');
      document.querySelector('#project-' + action).click();
    });
  }
  setupSystem.addEventListener('click', () => showSetup(document.querySelector('#project-systemBroker').options.length > 1 ? 'systems' : 'brokers'));
  welcomeActions.append(openProject, newProject, setupSystem);
  welcome.append(welcomeTitle, welcomeText, welcomeActions);
  const work = document.createElement('div'); work.id = 'desktop-automation-work'; work.hidden = true;
  const review = document.createElement('section'); review.className = 'desktop-card desktop-review'; review.id = 'desktop-draft-review';
  const workbar = document.createElement('div'); workbar.className = 'desktop-workbar';
  const actions = document.createElement('div'); actions.className = 'project-actions';
  workbar.append(actions); work.append(workbar, review); automations.append(welcome, work);
  bindText(welcomeTitle, () => t('desktop.automations'));
  bindText(welcomeText, () => t('desktop.noProjectHelp'));
  const observer = new ResizeObserver(() => {
    document.documentElement.style.setProperty('--desktop-nav-height', bar.offsetHeight + 'px');
    document.documentElement.style.setProperty('--desktop-workbar-height', workbar.offsetHeight + 'px');
  });
  observer.observe(bar); observer.observe(workbar);

  function show(key) {
    if (key === active || document.querySelector('dialog[open]')) return;
    for (const [name, section] of sections) {
      section.hidden = name !== key;
      if (name === key) navigation.get(name).setAttribute('aria-current', 'page');
      else navigation.get(name).removeAttribute('aria-current');
    }
    active = key;
    window.scrollTo(0, 0);
  }
  function showSetup(group) {
    show('setup');
    const details = setup.querySelector('#desktop-setup-' + group);
    if (details) {
      details.open = true;
      details.querySelector('summary')?.focus();
    }
  }
  function mountDesigner() {
    context.prepend(document.querySelector('.system-selector'));
    const menu = document.querySelector('.designer-menu');
    const sequence = menu.querySelector('#new-sequence-button');
    const permissions = menu.querySelector('.permissions-open');
    document.querySelector('#draft-exchange-actions').append(sequence);
    if (permissions) setup.querySelector('#desktop-setup-systems').append(permissions);
    actions.prepend(document.querySelector('#draft-wizard-start'));
    work.append(document.querySelector('.designer-feedback'), document.querySelector('.workspace'), document.querySelector('#draft-exchange'));
  }
  function update(data) {
    const system = data.desktop.project && data.workspaceContext?.systemId;
    document.body.classList.toggle('desktop-has-system', Boolean(system));
    welcome.hidden = Boolean(system); work.hidden = !system;
    openProject.hidden = newProject.hidden = Boolean(data.desktop.project);
    setupSystem.hidden = !data.desktop.project;
    connection.hidden = !system;
    connection.dataset.connected = String(data.status.mqttConnected);
    bindText(connection, () => t(data.status.mqttConnected ? 'desktop.connected' : 'desktop.disconnected'));
    bindText(welcomeTitle, () => t(data.desktop.project ? 'desktop.noSystemTitle' : 'desktop.automations'));
    bindText(welcomeText, () => t(data.desktop.project ? 'desktop.noSystemHelp' : 'desktop.noProjectHelp'));
  }
  return {setup, operation, review, actions, show, showSetup, mountDesigner, update};
}
