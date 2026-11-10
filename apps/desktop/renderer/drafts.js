import {t, bindText, formatNumber} from './localization.js';

export function installDraftExchange(bridge, workspace) {
  function card(key) {
    const panel = document.createElement('section'); panel.className = 'desktop-card';
    const title = document.createElement('h2'); bindText(title, () => t('desktop.steps.' + key));
    const summary = document.createElement('p');
    const help = document.createElement('p'); bindText(help, () => t('desktop.steps.' + key + 'Help'));
    const controls = document.createElement('div'); controls.id = 'draft-' + key + '-actions'; controls.className = 'project-actions';
    const feedback = document.createElement('p'); feedback.className = 'desktop-feedback'; feedback.setAttribute('role', 'status');
    panel.append(title, summary, help, controls, feedback); workspace.pages.draft.append(panel);
    return {summary, controls, feedback};
  }
  const local = card('local');
  const stored = card('stored');
  const read = workspace.link(stored.controls, 'connection', 'desktop.steps.readStored');
  const feedback = document.createElement('p'); feedback.id = 'desktop-yaml-feedback'; feedback.className = 'desktop-feedback';
  feedback.setAttribute('role', 'status'); workspace.actions.after(feedback);
  let busy = false;
  let view;
  const buttons = new Map();
  function update() {
    const revision = view?.status.storedRevision;
    const showingStored = view?.desktop.source === 'stored';
    read.hidden = Boolean(view?.status.confirmed);
    bindText(local.summary, () => t('mqtt.localRevision', {revision: formatNumber(view?.desktop.draftRevision ?? 0)}));
    bindText(stored.summary, () => revision == null ? t('desktop.steps.noStored') : revision === 0 && view?.status.confirmed
      ? t('desktop.steps.noStoredRules')
      : t(view.status.confirmed ? 'desktop.steps.storedSource' : 'desktop.steps.lastReadSource', {revision: formatNumber(revision)}));
    for (const [route, button] of buttons) {
      button.hidden = route !== 'adopt' && showingStored;
      button.disabled = busy || !view?.workspaceContext?.systemId || (route === 'adopt' && !(revision > 0));
    }
  }
  for (const [route, key] of [['import', 'importDraft'], ['export', 'exportDraft'], ['adopt', 'adoptStored']]) {
    const button = document.createElement('button'); button.type = 'button'; button.id = 'draft-' + route;
    buttons.set(route, button);
    bindText(button, () => t(route === 'export' ? 'editor.export' : 'project.' + key));
    (route === 'export' ? workspace.actions : route === 'adopt' ? stored.controls : local.controls).append(button);
    button.addEventListener('click', async () => {
      if (busy || document.querySelector('dialog[open]') || workspace.review.hasAttribute('aria-busy')) return;
      const target = route === 'export' ? feedback : route === 'adopt' ? stored.feedback : local.feedback;
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
  document.addEventListener('z2ma-designer-view', event => {
    if (view?.workspaceContext?.systemId !== event.detail.workspaceContext?.systemId || view?.desktop.epoch !== event.detail.desktop.epoch) {
      for (const label of [feedback, local.feedback, stored.feedback]) bindText(label, '');
    }
    view = event.detail;
    update();
  });
}
