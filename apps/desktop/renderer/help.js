import {t, language, bindText, onLanguageChange} from './localization.js';

const chapters = {project: 'project', broker: 'broker', system: 'systems', connection: 'connection', draft: 'drafts', automations: 'editor', review: 'check', transfer: 'transfer', operation: 'operation'};
const tips = [
  ['#desktop-help', 'open'], ['#project-save,#project-saveAs', 'save'],
  ['#designer-system', 'system'], ['#mqtt-connect', 'connect'], ['#mqtt-refresh', 'catalog'],
  ['#symcon-refresh-draft', 'merge'], ['#symcon-restore-draft,#project-restore', 'restore'],
  ['#draft-export', 'export'], ['#draft-import', 'import'],
  ['#draft-wizard-start,#new-automation-button', 'new'], ['#mqtt-validate,#desktop-check-draft', 'check'], ['#mqtt-store', 'transfer'],
  ['#mqtt-checkTransfer,#mqtt-install-check', 'readOnly'], ['#mqtt-install', 'extension'],
  ['#mqtt-activate', 'activate'], ['#mqtt-deactivate', 'stop'], ['#mqtt-apply-flags', 'flags'],
  ['#mqtt-run_once', 'once'], ['#mqtt-resume', 'restart'],
  ['[data-section=triggers] summary', 'triggers'], ['[data-section=conditions] summary', 'conditions'],
  ['[data-section=actions] summary', 'actions']
];
export function installHelp(bridge) {
  const button = document.createElement('button'); button.type = 'button'; button.id = 'desktop-help';
  bindText(button, () => t('desktop.help.button'));
  const feedback = document.createElement('span'); feedback.id = 'desktop-help-feedback'; feedback.setAttribute('role', 'status');
  document.querySelector('.app-header .toolbar').append(button, feedback);
  let opening = false;
  async function open() {
    if (opening) return;
    opening = true; feedback.textContent = '';
    const dialog = document.querySelector('dialog[open]');
    const section = dialog?.matches('.draft-file-dialog') ? 'files' : dialog?.matches('.desktop-link-dialog') ? 'networks'
      : dialog ? 'editor' : chapters[document.querySelector('#desktop-step')?.value] ?? 'concepts';
    try { await bridge.help({language: language(), section}); }
    catch { feedback.textContent = t('desktop.help.failed'); }
    finally { opening = false; }
  }
  button.addEventListener('click', open);
  document.addEventListener('keydown', event => {
    if (event.key !== 'F1' || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault(); if (!event.repeat) void open();
  }, true);
  installTooltips();
}
function installTooltips() {
  const bubble = document.createElement('div'); bubble.id = 'desktop-tooltip'; bubble.className = 'desktop-tooltip';
  bubble.setAttribute('role', 'tooltip'); bubble.hidden = true; document.body.append(bubble);
  let owner = null; let key = ''; let timer; let hideTimer;
  function hide() {
    clearTimeout(timer); clearTimeout(hideTimer); bubble.hidden = true;
    if (owner) {
      const ids = (owner.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(id => id && id !== bubble.id);
      if (ids.length) owner.setAttribute('aria-describedby', ids.join(' ')); else owner.removeAttribute('aria-describedby');
    }
    owner = null;
  }
  function position() {
    if (!owner?.isConnected || !owner.getClientRects().length) { hide(); return; }
    const rect = owner.getBoundingClientRect();
    bubble.style.left = Math.max(8, Math.min(rect.left, innerWidth - bubble.offsetWidth - 8)) + 'px';
    const below = rect.bottom + 8;
    bubble.style.top = Math.max(8, below + bubble.offsetHeight <= innerHeight - 8 ? below : rect.top - bubble.offsetHeight - 8) + 'px';
  }
  function show(element, message) {
    hide(); owner = element; key = message;
    (element.closest('dialog[open]') ?? document.body).append(bubble);
    bubble.textContent = t('desktop.tip.' + key); bubble.hidden = false;
    const ids = new Set((element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)); ids.add(bubble.id);
    element.setAttribute('aria-describedby', [...ids].join(' ')); position();
  }
  function hint(target) {
    if (!(target instanceof Element)) return null;
    for (const [selector, message] of tips) { const element = target.closest(selector); if (element) return {element, message}; }
    return null;
  }
  function schedule(event) {
    const found = hint(event.target);
    if (!found) { if (event.type === 'focusin') hide(); return; }
    if (found.element === owner && !bubble.hidden) return;
    clearTimeout(timer); clearTimeout(hideTimer);
    if (event.type === 'focusin') show(found.element, found.message);
    else timer = setTimeout(() => show(found.element, found.message), 400);
  }
  document.addEventListener('pointerover', schedule);
  document.addEventListener('focusin', schedule);
  const leave = event => {
    const trigger = owner ?? hint(event.target)?.element;
    if (bubble.contains(event.relatedTarget) || trigger?.contains(event.relatedTarget)) return;
    clearTimeout(timer);
    hideTimer = setTimeout(() => { if (!owner?.contains(document.activeElement) && !bubble.matches(':hover')) hide(); }, 120);
  };
  document.addEventListener('pointerout', leave); document.addEventListener('focusout', leave);
  bubble.addEventListener('pointerenter', () => clearTimeout(hideTimer)); bubble.addEventListener('pointerleave', leave);
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('scroll', hide, true); window.addEventListener('resize', hide);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || bubble.hidden) return;
    const modal = document.querySelector('dialog[open]');
    const visible = owner?.isConnected && owner.getClientRects().length && (!modal || modal.contains(owner));
    hide();
    if (visible) { event.preventDefault(); event.stopPropagation(); }
  }, true);
  onLanguageChange(() => { if (owner && !bubble.hidden) { bubble.textContent = t('desktop.tip.' + key); position(); } });
}
