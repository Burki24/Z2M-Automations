import {t, bindText} from './localization.js';

export function installDraftExchange(bridge) {
  const panel = document.createElement('details'); panel.className = 'desktop-project'; panel.id = 'draft-exchange';
  const title = document.createElement('summary'); bindText(title, () => t('project.exchangeTitle')); panel.append(title);
  const help = document.createElement('p'); bindText(help, () => t('project.exchangeHelp')); panel.append(help);
  const feedback = document.createElement('p'); feedback.setAttribute('role', 'status');
  const controls = document.createElement('div'); controls.className = 'project-actions'; panel.append(controls, feedback);
  let busy = false;
  for (const [route, key] of [['import', 'importDraft'], ['export', 'exportDraft'], ['adopt', 'adoptStored']]) {
    const button = document.createElement('button'); button.type = 'button'; button.id = 'draft-' + route;
    bindText(button, () => t('project.' + key)); controls.append(button);
    button.addEventListener('click', async () => {
      if (busy || document.querySelector('dialog[open]')) return;
      busy = true; controls.querySelectorAll('button').forEach(button => { button.disabled = true; });
      try {
        const view = await bridge.snapshot(); const context = view.workspaceContext;
        if (!view.desktop.project || !context?.systemId) { bindText(feedback, () => t('project.noSystems')); return; }
        const result = await bridge.designer({route, systemId: context.systemId, generation: context.generation, fingerprint: context.fingerprint, payload: {}});
        bindText(feedback, () => t(!result.ok ? 'project.' + result.error : result.state.canceled ? 'project.exchangeCanceled' : 'project.exchangeComplete'));
        if (result.ok && !result.state.canceled) document.dispatchEvent(new Event('z2ma-project-changed'));
      } catch { bindText(feedback, () => t('project.failed')); }
      finally { busy = false; controls.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
    });
  }
  document.querySelector('#mqtt-panel').after(panel);
}
