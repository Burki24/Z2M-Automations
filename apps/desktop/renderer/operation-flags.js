import {t, bindText, formatNumber, sortByName, language} from './localization.js';
import {validationSummary} from './draft-review.js';

const storageKey = 'z2ma.desktop.operation-flags';
const validIds = ids => Array.isArray(ids) && ids.length <= 100 && new Set(ids).size === ids.length
  && ids.every(id => typeof id === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(id));

export function installOperationFlags(workspace, {operation, automatic, activate, current, perform, command, busy, button}) {
  const count = document.createElement('p'); count.id = 'mqtt-rule-count'; count.className = 'desktop-flags-count';
  count.setAttribute('role', 'status'); operation.insertBefore(count, automatic);
  const reason = document.createElement('p'); reason.id = 'mqtt-operation-reason'; reason.setAttribute('role', 'status');
  automatic.append(reason); activate.setAttribute('aria-describedby', reason.id);
  const panel = document.createElement('section'); panel.className = 'desktop-card'; panel.id = 'mqtt-rule-flags';
  const title = document.createElement('h2'); title.id = 'mqtt-rule-flags-title'; bindText(title, () => t('desktop.operation.flags'));
  const help = document.createElement('p'); bindText(help, () => t('desktop.flags.help'));
  const list = document.createElement('ul'); list.className = 'desktop-rule-flags'; list.id = 'mqtt-rule-flags-list';
  list.tabIndex = 0; list.setAttribute('aria-labelledby', title.id);
  const selection = document.createElement('p'); selection.setAttribute('role', 'status');
  const feedback = document.createElement('p'); feedback.id = 'mqtt-rule-flags-feedback'; feedback.setAttribute('role', 'status');
  const actions = document.createElement('div'); actions.className = 'project-actions';
  const apply = button(actions, 'mqtt-apply-flags', 'desktop.flags.apply', () => submit()); apply.classList.add('primary');
  const reset = button(actions, 'mqtt-reset-flags', 'desktop.flags.reset', () => {
    const {system} = current(); const key = scope();
    if (!system?.flagsContext || !system.runtime) return;
    entries.delete(key); saved.delete(key); persist(); paint();
  });
  const reconcile = button(actions, 'mqtt-check-flags', 'desktop.flags.reconcile', () => submit(true));
  panel.append(title, help, list, selection, feedback, actions); workspace.pages.operation.append(panel);
  const entries = new Map(); const saved = new Map();
  try {
    const raw = sessionStorage.getItem(storageKey);
    const rows = raw && raw.length <= 131072 ? JSON.parse(raw) : [];
    if (Array.isArray(rows) && rows.length <= 8) for (const row of rows) {
      if (typeof row.key === 'string' && row.key.length <= 180 && /^[a-f0-9]{64}$/.test(row.context) && validIds(row.enabled)) saved.set(row.key, row);
    }
  } catch { /* Invalid temporary selections never become commands. */ }
  let shown; let applying = false;
  const scope = () => {
    const {view, system} = current();
    return JSON.stringify([view?.desktop.projectId, view?.desktop.epoch, system?.id]);
  };
  const changed = entry => entry.enabled.size !== entry.rules.filter(rule => rule.enabled).length
    || entry.rules.some(rule => entry.enabled.has(rule.id) !== rule.enabled);
  function persist() {
    try { sessionStorage.setItem(storageKey, JSON.stringify([...saved.values()])); } catch { /* In-memory selections remain available. */ }
  }
  function remember(key, entry) {
    if (changed(entry)) saved.set(key, {key, context: entry.context, enabled: [...entry.enabled]}); else saved.delete(key);
    while (saved.size > 8) saved.delete(saved.keys().next().value);
    persist();
  }
  function paint() {
    const {system, broker, transferProgress} = current(); const key = scope();
    const runtime = broker?.state === 'connected' && system?.fresh && !system.reading ? system.runtime : null;
    const known = Boolean(runtime); const total = runtime?.rules.length ?? 0;
    const enabled = runtime?.rules.filter(rule => rule.enabled).length ?? 0;
    count.dataset.enabled = known ? String(enabled) : '';
    count.dataset.total = known ? String(total) : '';
    bindText(count, () => known ? t('desktop.flags.count', {enabled: formatNumber(enabled), total: formatNumber(total), count: total}) : t('desktop.flags.unknown'));
    count.dataset.tone = known && !enabled ? 'warning' : '';
    const blocked = system?.transferPending || system?.updatePending;
    bindText(reason, () => blocked ? t('desktop.flags.confirmFirst') : known && total && !enabled ? t('desktop.flags.none') : '');
    reason.dataset.tone = blocked || known && total && !enabled ? 'warning' : '';
    panel.hidden = !system;
    let entry = entries.get(key);
    if (known && system.flagsContext && (!entry || entry.applied || !changed(entry) && entry.context !== system.flagsContext)) {
      const previous = saved.get(key);
      const completed = entry?.applied ? entry.feedback : undefined;
      entry = {context: previous?.context ?? system.flagsContext, enabled: new Set(previous?.enabled ?? runtime.rules.filter(rule => rule.enabled).map(rule => rule.id)),
        rules: structuredClone(runtime.rules), feedback: completed};
      entries.set(key, entry);
      while (entries.size > 8) entries.delete(entries.keys().next().value);
    }
    const stale = Boolean(entry && system?.flagsContext && entry.context !== system.flagsContext && changed(entry) && !entry.applied);
    const signature = JSON.stringify([key, entry?.context, entry?.rules, language()]);
    if (shown !== signature) {
      shown = signature;
      list.replaceChildren(...sortByName(entry?.rules ?? []).map(rule => {
        const row = document.createElement('li'); const label = document.createElement('label');
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.dataset.ruleId = rule.id;
        const text = document.createElement('span'); const name = document.createElement('strong'); name.textContent = rule.name;
        const stored = document.createElement('span'); bindText(stored, () => t(rule.enabled ? 'desktop.flags.storedOn' : 'desktop.flags.storedOff'));
        text.append(name, stored); label.append(checkbox, text); row.append(label);
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) entry.enabled.add(rule.id); else entry.enabled.delete(rule.id);
          entry.feedback = undefined; remember(key, entry); paint();
        });
        return row;
      }));
    }
    for (const checkbox of list.querySelectorAll('input')) {
      checkbox.checked = entry.enabled.has(checkbox.dataset.ruleId);
      checkbox.disabled = busy() || !known || !system.flagsContext || stale || Boolean(blocked);
    }
    const dirty = Boolean(entry && changed(entry) && !entry.applied);
    bindText(selection, () => stale ? t('desktop.flags.changed') : dirty ? t('desktop.flags.selected', {count: entry.enabled.size})
      : known && !total ? t('desktop.operation.noRules') : '');
    const progressing = applying && transferProgress && !transferProgress.failed && transferProgress.phase !== 'complete';
    bindText(feedback, () => progressing ? t('desktop.transfer.' + transferProgress.phase)
      : entry?.feedback ? [t(entry.feedback.key), validationSummary(entry.feedback.validation)].filter(Boolean).join('\n') : '');
    feedback.dataset.tone = entry?.feedback?.error ? 'error' : entry?.feedback?.key === 'desktop.flags.applied' ? 'success' : '';
    apply.disabled = busy() || !known || !system?.flagsContext || stale || !dirty || Boolean(blocked);
    reset.disabled = busy() || !known || !system?.flagsContext;
    reset.hidden = !dirty && !stale;
    reconcile.hidden = !system?.transferPending;
    reconcile.disabled = busy() || broker?.state !== 'connected';
    panel.setAttribute('aria-busy', String(applying));
  }
  function submit(check = false) {
    const {system} = current(); const key = scope(); let entry = entries.get(key);
    if (!system || !entry && !check) return;
    if (!entry) {
      entry = {context: '', rules: [], enabled: new Set()}; entries.set(key, entry);
    }
    return perform(async () => {
      applying = true; entry.feedback = {key: 'desktop.flags.checking'}; paint();
      try {
        const response = await command(check ? 'checkTransfer' : 'setRuleFlags', system.id,
          check ? {} : {context: entry.context, enabled: [...entry.enabled]});
        if (response.ok && ['transferStored', 'transferUnchanged'].includes(response.state.outcome)) {
          saved.delete(key); persist(); entry.applied = true;
          entry.feedback = {key: response.state.outcome === 'transferStored' ? 'desktop.flags.applied' : 'desktop.flags.unchanged'};
        } else if (response.ok) entry.feedback = {key: response.state.outcome === 'transferCanceled' ? 'desktop.flags.canceled' : 'project.' + response.state.outcome};
        else entry.feedback = {key: 'project.' + response.error, error: true, validation: response.validation};
      } finally { applying = false; }
    }, () => { applying = false; entry.feedback = {key: 'project.failed', error: true}; });
  }
  return {paint};
}
