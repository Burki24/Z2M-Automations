import {t, language, bindText, onLanguageChange} from './localization.js';

const chapters = {project: 'project', broker: 'broker', system: 'systems', connection: 'connection', draft: 'drafts', automations: 'editor', review: 'check', transfer: 'transfer', operation: 'operation'};
const tips = [
  ['#desktop-help', 'open'], ['#project-save,#project-saveAs', 'save'],
  ['#designer-system', 'system'], ['#mqtt-connect', 'connect'], ['#mqtt-refresh', 'catalog'],
  ['#symcon-refresh-draft', 'merge'], ['#symcon-restore-draft,#project-restore', 'restore'],
  ['#draft-export', 'export'], ['#draft-import', 'import'],
  ['button[data-step="draft"],#desktop-nav-draft', 'workingCopy'],
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
  let owner = null; let key; let pending = null; let hovered = null; let dismissed = null; let timer; let hideTimer;
  const content = (element, message) => message ? t('desktop.tip.' + message) : element.getAttribute('title') ?? element.dataset.desktopTooltip ?? '';
  const valid = element => element?.isConnected && element.getClientRects().length
    && (!document.querySelector('dialog[open]') || document.querySelector('dialog[open]').contains(element));
  function cancelPending() { clearTimeout(timer); pending = null; }
  function hide() {
    cancelPending(); clearTimeout(hideTimer); bubble.hidden = true;
    if (owner) {
      const ids = (owner.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(id => id && id !== bubble.id);
      if (ids.length) owner.setAttribute('aria-describedby', ids.join(' ')); else owner.removeAttribute('aria-describedby');
    }
    owner = null;
  }
  function position() {
    if (!valid(owner)) { hide(); return; }
    const width = document.documentElement.clientWidth;
    bubble.style.maxWidth = 'min(23rem, ' + Math.max(0, width - 16) + 'px)';
    // Measure the new text without the previous anchor shrinking its available width.
    bubble.style.left = '8px'; bubble.style.top = '8px';
    const rect = owner.getBoundingClientRect();
    bubble.style.left = Math.max(8, Math.min(rect.left, width - bubble.offsetWidth - 8)) + 'px';
    const below = rect.bottom + 8;
    bubble.style.top = Math.max(8, below + bubble.offsetHeight <= innerHeight - 8 ? below : rect.top - bubble.offsetHeight - 8) + 'px';
  }
  function show(element, message) {
    const value = content(element, message);
    hide();
    if (!value || !valid(element)) return;
    owner = element; key = message;
    (element.closest('dialog[open]') ?? document.body).append(bubble);
    bubble.textContent = value; bubble.hidden = false;
    const ids = new Set((element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)); ids.add(bubble.id);
    element.setAttribute('aria-describedby', [...ids].join(' ')); position();
  }
  function hint(target) {
    if (!(target instanceof Element)) return null;
    for (const [selector, message] of tips) { const element = target.closest(selector); if (element) return {element, message}; }
    const element = target.closest('[title],[data-desktop-tooltip]');
    if (element && content(element)) return {element};
    return null;
  }
  function delayedHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (!owner?.contains(document.activeElement) && hovered !== owner && !bubble.matches(':hover')) hide(); }, 120);
  }
  function schedule(event) {
    if (event.pointerType === 'touch') return;
    if (bubble.contains(event.target)) { clearTimeout(hideTimer); return; }
    const found = hint(event.target);
    if (!found) {
      if (event.type === 'focusin') hide();
      else { hovered = null; cancelPending(); delayedHide(); }
      return;
    }
    if (event.type !== 'focusin') hovered = found.element;
    if (dismissed === found.element) return;
    clearTimeout(hideTimer);
    if (found.element === owner && !bubble.hidden) return;
    if (event.type === 'focusin') show(found.element, found.message);
    else if (pending?.element !== found.element) {
      if (owner && owner !== found.element) hide();
      cancelPending(); pending = found;
      timer = setTimeout(() => {
        const next = pending;
        if (next && hovered === next.element) show(next.element, next.message);
        else cancelPending();
      }, 400);
    }
  }
  document.addEventListener('pointerover', schedule, true);
  document.addEventListener('pointermove', schedule, true);
  document.addEventListener('focusin', schedule);
  const leave = event => {
    const from = hint(event.target)?.element;
    const to = hint(event.relatedTarget)?.element;
    if ((from && from === to) || bubble.contains(event.relatedTarget)) return;
    if (owner?.contains(event.relatedTarget)) { clearTimeout(hideTimer); return; }
    if (dismissed === from) dismissed = null;
    if (pending?.element === from) cancelPending();
    if (hovered === from || bubble.contains(event.target)) hovered = null;
    if (owner && (owner === from || bubble.contains(event.target))) delayedHide();
  };
  document.addEventListener('pointerout', leave, true); document.addEventListener('focusout', leave);
  bubble.addEventListener('pointerenter', () => clearTimeout(hideTimer)); bubble.addEventListener('pointerleave', leave);
  document.addEventListener('pointerdown', () => { dismissed = null; hide(); }, true);
  document.addEventListener('scroll', event => { if (!bubble.contains(event.target) && owner && !bubble.hidden) position(); }, true);
  window.addEventListener('resize', () => { if (owner && !bubble.hidden) position(); });
  window.addEventListener('blur', () => { hovered = null; hide(); });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const visible = !bubble.hidden && valid(owner);
    dismissed = owner ?? pending?.element ?? null;
    hide();
    if (visible) { event.preventDefault(); event.stopPropagation(); }
  }, true);
  function refresh() {
    if (pending && (!valid(pending.element) || !content(pending.element, pending.message))) cancelPending();
    if (!owner || bubble.hidden) return;
    const value = content(owner, key);
    if (!value || !valid(owner)) { hide(); return; }
    if (bubble.textContent !== value) bubble.textContent = value;
    position();
  }
  // Keep shared title bindings intact while routing their output through the same
  // localized, keyboard-accessible tooltip. Data attributes survive DOM cloning.
  function adoptTitle(element) {
    const value = element.getAttribute('title')?.trim() ?? '';
    const ownedLabel = element.dataset.desktopTooltipLabel;
    if (ownedLabel && element.getAttribute('aria-label') === ownedLabel) {
      if (value) { element.setAttribute('aria-label', value); element.dataset.desktopTooltipLabel = value; }
      else { element.removeAttribute('aria-label'); delete element.dataset.desktopTooltipLabel; }
    } else {
      delete element.dataset.desktopTooltipLabel;
      if (value && element.matches('button,a,[role="button"]') && !element.textContent.trim()
        && !element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) {
        element.setAttribute('aria-label', value); element.dataset.desktopTooltipLabel = value;
      }
    }
    if (value) element.dataset.desktopTooltip = value;
    else delete element.dataset.desktopTooltip;
    element.removeAttribute('title');
  }
  function adoptTree(node) {
    if (!(node instanceof Element)) return;
    if (node.hasAttribute('title')) adoptTitle(node);
    for (const element of node.querySelectorAll('[title]')) adoptTitle(element);
  }
  const observation = {subtree: true, childList: true, attributes: true, attributeFilter: ['title', 'open']};
  const observer = new MutationObserver(records => {
    observer.disconnect();
    try {
      const titles = new Set(); const additions = new Set();
      for (const record of records) {
        if (record.type === 'attributes' && record.attributeName === 'title') titles.add(record.target);
        else if (record.type === 'childList') for (const node of record.addedNodes) additions.add(node);
      }
      // Read the final value once when rendering writes the same title repeatedly.
      for (const element of titles) adoptTitle(element);
      for (const node of additions) adoptTree(node);
    } finally { observer.observe(document.body, observation); }
    refresh();
  });
  adoptTree(document.body); observer.observe(document.body, observation);
  onLanguageChange(refresh);
}
