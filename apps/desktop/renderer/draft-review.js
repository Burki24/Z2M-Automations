import {t, bindText, formatNumber} from './localization.js';

function validationLocation(issue) {
  const parts = issue.path.split('/').slice(1);
  const labels = [];
  for (let index = 0; index < parts.length; index++) {
    const field = parts[index];
    const position = parts[index + 1];
    let label = /^\d+$/.test(field) ? formatNumber(Number(field) + 1) : t('validation.field.' + field);
    if (position && /^\d+$/.test(position)) {
      label = t('validation.position', {label, number: formatNumber(Number(position) + 1)});
      index++;
    }
    labels.push(!labels.length && issue.name ? t('validation.named', {label, name: issue.name}) : label);
  }
  return labels.join(' → ') || t('validation.document');
}

function validationReason(issue) {
  const field = issue.path.split('/').at(-1);
  if (issue.reason === 'required' || issue.reason === 'minItems' && issue.limit === 1) {
    if (field === 'triggers') return t('validation.addTrigger');
    if (field === 'actions') return t('validation.addAction');
    if (field === 'values') return t('desktop.review.missingActionValue');
  }
  if (issue.reason === 'pattern' && ['at', 'after', 'before'].includes(field)) return t('validation.timeFormat');
  return t('validation.reason.' + issue.reason, issue.limit === undefined ? {} : {limit: formatNumber(issue.limit)});
}

export function validationSummary(details) {
  const issues = details?.issues ?? [];
  const messages = issues.slice(0, 4).map(issue => validationLocation(issue) + ' · ' + validationReason(issue));
  if (details?.truncated || issues.length > messages.length) messages.push(t('validation.more'));
  return messages.join('\n');
}

export const draftScope = view => JSON.stringify([view?.desktop.projectId, view?.desktop.epoch, view?.workspaceContext?.systemId, view?.desktop.draftRevision]);

export function installDraftReview(bridge, workspace, {current, perform, command, busy, button, flags}) {
  const check = button(workspace.actions, 'mqtt-validate', 'desktop.review.check', () => validate(false));
  const store = button(workspace.actions, 'mqtt-store', 'desktop.review.store', () => transfer(false));
  const checkFlags = button(flags, 'mqtt-validateEnabled', 'desktop.review.checkFlags', () => validate(true));
  const storeFlags = button(flags, 'mqtt-storeFlags', 'desktop.review.storeFlags', () => transfer(true));
  const explanation = document.createElement('p'); explanation.id = 'desktop-review-message'; explanation.setAttribute('role', 'status');
  const flagExplanation = document.createElement('p'); flagExplanation.setAttribute('role', 'status');
  const findings = document.createElement('ul'); findings.id = 'mqtt-validation-issues'; findings.className = 'desktop-findings'; findings.hidden = true;
  const more = document.createElement('p'); more.hidden = true; bindText(more, () => t('validation.more'));
  const next = document.createElement('div'); next.className = 'project-actions';
  workspace.review.append(explanation, findings, more, next);
  flags.append(flagExplanation);
  check.setAttribute('aria-describedby', explanation.id);
  store.setAttribute('aria-describedby', explanation.id);
  const reconcile = button(next, 'mqtt-checkTransfer', 'desktop.review.checkTransfer', () => checkTransfer());
  let result;
  let shown;
  let messageKey;

  function issueList(assessment) {
    if (shown === assessment) return;
    shown = assessment;
    const issues = assessment?.validation?.issues ?? [];
    findings.replaceChildren(...issues.map(issue => {
      const row = document.createElement('li');
      const text = document.createElement('div');
      const location = document.createElement('strong'); bindText(location, () => validationLocation(issue));
      const reason = document.createElement('span'); bindText(reason, () => validationReason(issue));
      text.append(location, reason); row.append(text);
      const [kind, index, ...path] = issue.path.split('/').slice(1);
      const id = ['automations', 'sequences'].includes(kind) && /^\d+$/.test(index)
        ? assessment.view.configuration[kind][Number(index)]?.id : null;
      if (id) button(row, '', 'desktop.review.correct', () => {
        const view = current().view;
        if (draftScope(view) !== assessment.scope || view.desktop.source !== 'draft') return;
        const opened = !document.dispatchEvent(new CustomEvent('z2ma-open-draft-issue', {cancelable: true,
          detail: {systemId: view.workspaceContext.systemId, revision: view.desktop.draftRevision, kind, id, path, message: () => validationReason(issue)}}));
        if (!opened) bindText(explanation, () => t('desktop.review.changed'));
      });
      return row;
    }));
    findings.hidden = !issues.length; more.hidden = !assessment?.validation?.truncated;
  }
  function paint() {
    const {view, system, broker} = current();
    const stored = view?.desktop.source === 'stored';
    const connected = broker?.state === 'connected';
    const scope = draftScope(view);
    if (result?.scope !== scope && result) {
      result = result.view.workspaceContext.systemId === view?.workspaceContext?.systemId
        && result.view.desktop.epoch === view?.desktop.epoch ? {scope, view, key: 'changed'} : undefined;
    }
    if (!connected && result?.key === 'ready') result = {...result, key: 'local'};
    if (connected && result?.key === 'ready' && system?.fresh && result.remote
      && (system.revision !== result.remote.revision || system.build !== result.remote.build)) result = {...result, key: 'changed'};
    const running = system?.executing || system?.runtime?.resume || system?.runtime?.runs.some(run => run.state === 'running');
    const ready = result?.key === 'ready' && connected && !running;
    const blocked = busy() || !system || stored;
    check.disabled = checkFlags.disabled = blocked;
    store.disabled = blocked || !ready || result.flags;
    storeFlags.disabled = blocked || !ready || !result.flags;
    check.hidden = store.hidden = stored;
    check.classList.toggle('primary', !stored && !ready && !!view?.configuration.automations.length);
    store.classList.toggle('primary', !store.disabled);
    const create = workspace.actions.querySelector('#draft-wizard-start');
    create?.classList.toggle('primary', !view?.configuration.automations.length);
    const key = stored ? 'storedView' : result?.key === 'ready' && running ? 'stopFirst'
      : result?.key === 'local' && connected ? 'connectedAfterCheck' : result?.key ?? (connected ? 'start' : 'startDisconnected');
    const message = result?.error ? (result.validation?.issues.length ? t('desktop.review.invalid')
      : t(errorKeys[result.error] ?? 'project.' + result.error, {name: system?.name ?? ''})) : t('desktop.review.' + key, {name: system?.name ?? ''});
    if (message !== messageKey) {
      messageKey = message;
      // The status lives beside the actions, including after a review of rule flags.
      bindText(explanation, message);
      bindText(flagExplanation, message);
    }
    explanation.dataset.tone = result?.error ? 'error' : ready ? 'success' : '';
    reconcile.hidden = result?.error !== 'transferUncertain' && result?.error !== 'transferConflict';
    reconcile.disabled = busy() || !connected;
    issueList(stored ? null : result);
  }
  const errorKeys = {
    draftSchema: 'desktop.review.invalid', disconnected: 'desktop.review.connectionLost', timeout: 'desktop.review.timeout',
    applyFirst: 'desktop.review.pending', draftStale: 'desktop.review.changed', transferChanged: 'desktop.review.receiverChanged',
    transferConflict: 'desktop.review.conflict', transferRunning: 'desktop.review.stopFirst', transferUncertain: 'desktop.review.uncertain',
    transferValidateFirst: 'desktop.review.changed', protocol: 'desktop.review.protocol', failed: 'desktop.review.failed'
  };
  function set(view, flags, update) {
    if (draftScope(current().view) !== draftScope(view)) return;
    result = {scope: draftScope(view), view, flags, ...update};
    paint();
  }
  function updateOutcome(view, flags, response) {
    if (!response.ok) set(view, flags, {key: 'error', error: response.error, validation: response.validation});
    else {
      const key = {transferValidated: 'ready', transferStored: flags ? 'flagsStored' : 'stored', transferCanceled: 'canceled',
        transferChecked: 'receiverRead', transferInstalled: 'receiverRead'}[response.state.outcome] ?? 'changed';
      set(view, flags, {key, remote: response.state.systems.find(system => system.id === view.workspaceContext.systemId)});
    }
  }
  function validate(flags) {
    return perform(async () => {
      const {view, system} = current();
      if (!system || view.desktop.source !== 'draft') return;
      set(view, flags, {key: 'checking'});
      const snapshot = await bridge.snapshot();
      if (draftScope(snapshot) !== draftScope(view) || snapshot.desktop.source !== 'draft') {
        set(view, flags, {key: 'changed'});
        return;
      }
      const context = snapshot.workspaceContext;
      const local = await bridge.designer({route: 'check-draft', systemId: context.systemId,
        generation: context.generation, fingerprint: context.fingerprint, payload: {}});
      if (!local.ok) { set(snapshot, flags, {key: 'error', error: local.error, validation: local.validation}); return; }
      if (current().broker?.state !== 'connected') { set(snapshot, flags, {key: 'local'}); return; }
      if (draftScope(current().view) !== draftScope(snapshot)) return;
      set(snapshot, flags, {key: 'checkingReceiver'});
      updateOutcome(snapshot, flags, await command(flags ? 'validateEnabled' : 'validate', context.systemId));
    }, () => set(current().view, flags, {key: 'error', error: 'failed'}));
  }
  function transfer(flags) {
    return perform(async () => {
      const {view, system} = current();
      if (!system || result?.key !== 'ready' || result.flags !== flags || result.scope !== draftScope(view)) return;
      set(view, flags, {key: 'transferring'});
      updateOutcome(view, flags, await command('store', system.id));
    }, () => set(current().view, flags, {key: 'error', error: 'failed'}));
  }
  function checkTransfer() {
    return perform(async () => {
      const {view, system} = current();
      if (system) updateOutcome(view, result?.flags ?? false, await command('checkTransfer', system.id));
    }, () => set(current().view, false, {key: 'error', error: 'failed'}));
  }
  return {paint, next, checkTransfer};
}
