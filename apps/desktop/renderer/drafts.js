import {t, bindText} from './localization.js';

export function installDraftExchange(bridge, workspace) {
  const panel = document.createElement('details'); panel.className = 'desktop-project'; panel.id = 'draft-exchange';
  const title = document.createElement('summary'); bindText(title, () => t('desktop.review.files')); panel.append(title);
  const help = document.createElement('p'); bindText(help, () => t('desktop.review.filesHelp')); panel.append(help);
  const feedback = document.createElement('p'); feedback.id = 'desktop-yaml-feedback'; feedback.setAttribute('role', 'status'); workspace.review.append(feedback);
  const controls = document.createElement('div'); controls.id = 'draft-exchange-actions'; controls.className = 'project-actions'; panel.append(controls);
  let busy = false;
  let view;
  const buttons = new Map();
  function update() {
    for (const [route, button] of buttons) {
      button.disabled = busy || !view?.workspaceContext?.systemId || (route !== 'adopt' && view.desktop.source === 'stored')
        || (route === 'adopt' && !(view?.status.storedRevision > 0));
    }
  }
  for (const [route, key] of [['import', 'importDraft'], ['export', 'exportDraft'], ['adopt', 'adoptStored']]) {
    const button = document.createElement('button'); button.type = 'button'; button.id = 'draft-' + route;
    buttons.set(route, button);
    bindText(button, () => t(route === 'export' ? 'editor.export' : 'project.' + key));
    (route === 'export' ? workspace.actions : controls).append(button);
    button.addEventListener('click', async () => {
      if (busy || document.querySelector('dialog[open]') || workspace.review.hasAttribute('aria-busy')) return;
      const target = route === 'export' ? feedback : panel.querySelector('[role="status"]');
      busy = true; update();
      try {
        const snapshot = await bridge.snapshot(); const context = snapshot.workspaceContext;
        if (!snapshot.desktop.project || !context?.systemId) { bindText(target, () => t('project.noSystems')); return; }
        const result = await bridge.designer({route, systemId: context.systemId, generation: context.generation, fingerprint: context.fingerprint, payload: {}});
        bindText(target, () => t(!result.ok ? 'project.' + result.error : result.state.canceled ? 'project.exchangeCanceled' : 'desktop.review.' + route));
        if (result.ok && !result.state.canceled && route !== 'export') document.dispatchEvent(new Event('z2ma-project-changed'));
      } catch { bindText(target, () => t('project.failed')); }
      finally { busy = false; update(); }
    });
  }
  const exchangeStatus = document.createElement('p'); exchangeStatus.setAttribute('role', 'status'); panel.append(exchangeStatus);
  workspace.review.after(panel);
  document.addEventListener('z2ma-designer-view', event => {
    if (view?.workspaceContext?.systemId !== event.detail.workspaceContext?.systemId || view?.desktop.epoch !== event.detail.desktop.epoch) {
      bindText(feedback, ''); bindText(exchangeStatus, '');
    }
    view = event.detail;
    update();
  });
}
