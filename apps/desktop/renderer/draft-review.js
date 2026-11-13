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
  if (issue.capability) {
    const capability = issue.capability;
    const comparison = {eq: 'ui.is.equal.to.456b1261', ne: 'ui.is.not.equal.to.c72da4b0', gt: 'ui.is.greater.than.c23edfd9',
      gte: 'ui.is.at.least.8adebfa3', lt: 'ui.is.less.than.f2641c8f', lte: 'ui.is.at.most.53bbaac0'};
    const compare = value => comparison[value] ? t(comparison[value]) + ' (' + value + ')' : value;
    const operator = issue.reason === 'capability_operator';
    const entered = t('validation.capability.entered', {value: operator ? compare(capability.actual) : capability.actual,
      type: t(operator ? 'validation.type.operator' : 'validation.type.' + capability.actualType)});
    const number = value => formatNumber(value ?? 0) + (capability.unit ? ' ' + capability.unit : '');
    return entered + ' ' + t('validation.reason.' + issue.reason, {values: capability.allowed.map(value => operator ? compare(value) : value).join(', '),
      minimum: number(capability.minimum), maximum: number(capability.maximum), step: number(capability.step)});
  }
  const field = issue.path.split('/').at(-1);
  if (issue.reason === 'required' || issue.reason === 'minItems' && issue.limit === 1) {
    if (field === 'triggers') return t('validation.addTrigger');
    if (field === 'actions') return t('validation.addAction');
    if (field === 'values') return t('desktop.review.missingActionValue');
  }
  if (issue.reason === 'pattern' && ['at', 'after', 'before'].includes(field)) return t('validation.timeFormat');
  return t('validation.reason.' + issue.reason, issue.limit === undefined ? {} : {limit: formatNumber(issue.limit)});
}

function validationCapability(issue) {
  const capability = issue.capability;
  return capability ? t('validation.capability.context', {system: capability.system, device: capability.device,
    property: capability.label === capability.property ? capability.property : capability.label + ' (' + capability.property + ')'}) : '';
}

export function validationSummary(details) {
  const issues = details?.issues ?? [];
  const messages = [];
  for (const issue of issues.slice(0, 4)) {
    const message = [validationLocation(issue), validationCapability(issue), validationReason(issue)].filter(Boolean).join(' · ');
    if (messages.join('\n').length + message.length > 2600) {
      if (!messages.length) messages.push(message.slice(0, 2600) + '…');
      break;
    }
    messages.push(message);
  }
  if (details?.truncated || issues.length > messages.length || messages.some(message => message.endsWith('…'))) messages.push(t('validation.more'));
  return messages.join('\n');
}

const draftScope = view => JSON.stringify([view?.desktop.projectId, view?.desktop.epoch, view?.workspaceContext?.systemId, view?.module.baseTopic, view?.desktop.draftRevision]);

export function installDraftReview(bridge, workspace, {current, perform, command, busy, button}) {
  const checkFromEditor = button(workspace.actions, 'desktop-check-draft', 'desktop.review.check', () => {
    if (workspace.show('review')) void validate();
  });
  const contents = document.createElement('p');
  const reviewActions = document.createElement('div'); reviewActions.className = 'project-actions';
  const check = button(reviewActions, 'mqtt-validate', 'desktop.review.check', () => validate());
  check.classList.add('primary');
  const explanation = document.createElement('p'); explanation.id = 'desktop-review-message'; explanation.setAttribute('role', 'status');
  const findings = document.createElement('ul'); findings.id = 'mqtt-validation-issues'; findings.className = 'desktop-findings'; findings.hidden = true;
  const more = document.createElement('p'); more.hidden = true; bindText(more, () => t('validation.more'));
  const nextReview = workspace.link(reviewActions, 'transfer'); nextReview.hidden = true;
  workspace.review.append(contents, explanation, findings, more, reviewActions);
  check.setAttribute('aria-describedby', explanation.id);

  const transferCard = document.createElement('section'); transferCard.className = 'desktop-card';
  const target = document.createElement('h2'); target.id = 'desktop-transfer-target';
  const transferContents = document.createElement('p');
  const transferMode = document.createElement('p'); transferMode.id = 'desktop-transfer-mode';
  const transferChanges = document.createElement('p'); transferChanges.id = 'desktop-transfer-changes';
  const transferHelp = document.createElement('p');
  const transferStatus = document.createElement('p'); transferStatus.id = 'desktop-transfer-message'; transferStatus.setAttribute('role', 'status');
  const transferActions = document.createElement('div'); transferActions.className = 'project-actions';
  const store = button(transferActions, 'mqtt-store', 'desktop.review.store', transfer);
  store.setAttribute('aria-describedby', transferStatus.id);
  const reconcile = button(transferActions, 'mqtt-checkTransfer', 'desktop.review.checkTransfer', checkTransfer);
  const nextTransfer = workspace.link(transferActions, 'review');
  const nextActions = document.createElement('div'); nextActions.className = 'project-actions';
  const testNext = workspace.link(nextActions, 'operation', 'desktop.review.testNext');
  testNext.id = 'desktop-transfer-test';
  testNext.addEventListener('click', () => document.querySelector('#mqtt-rule')?.focus());
  const operationNext = workspace.link(nextActions, 'operation', 'desktop.review.operationNext');
  operationNext.addEventListener('click', () => document.querySelector('#mqtt-resume')?.focus());
  transferCard.append(target, transferContents, transferMode, transferChanges, transferHelp, transferStatus, transferActions, nextActions);
  workspace.pages.transfer.append(transferCard);
  let result;
  let shown;

  function issueList(assessment) {
    if (shown === assessment) return;
    shown = assessment;
    const issues = assessment?.validation?.issues ?? [];
    findings.replaceChildren(...issues.map(issue => {
      const row = document.createElement('li');
      const text = document.createElement('div');
      const location = document.createElement('strong'); bindText(location, () => validationLocation(issue));
      if (issue.capability) {
        const context = document.createElement('span'); bindText(context, () => validationCapability(issue));
        text.append(location, context);
      } else text.append(location);
      const reason = document.createElement('span'); bindText(reason, () => validationReason(issue));
      text.append(reason); row.append(text);
      const [kind, index, ...path] = issue.path.split('/').slice(1);
      const id = ['automations', 'sequences'].includes(kind) && /^\d+$/.test(index)
        ? assessment.view.configuration[kind][Number(index)]?.id : null;
      if (id) button(row, '', 'desktop.review.correct', () => {
        const view = current().view;
        if (draftScope(view) !== assessment.scope || view.desktop.source !== 'draft' || !workspace.show('automations')) return;
        const opened = !document.dispatchEvent(new CustomEvent('z2ma-open-draft-issue', {cancelable: true,
          detail: {systemId: view.workspaceContext.systemId, revision: view.desktop.draftRevision, kind, id, path,
            property: issue.capability?.property, message: () => validationReason(issue)}}));
        if (!opened) {
          workspace.show('review');
          set(view, assessment.flags, {key: 'changed'});
        }
      });
      return row;
    }));
    findings.hidden = !issues.length; more.hidden = !assessment?.validation?.truncated;
  }
  function paintLink(link, step) {
    link.hidden = !step;
    if (!step) return;
    link.dataset.step = step;
    bindText(link, () => t('desktop.steps.' + step));
  }
  function paint() {
    const {view, system, broker, transferProgress} = current();
    const stored = view?.desktop.source === 'stored';
    const connected = broker?.state === 'connected';
    const fresh = connected && system?.fresh && !system.reading;
    const scope = draftScope(view);
    if (result?.scope !== scope && result) {
      result = result.view.workspaceContext.systemId === view?.workspaceContext?.systemId
        && result.view.desktop.epoch === view?.desktop.epoch ? {scope, view, key: 'changed'} : undefined;
    }
    if (!fresh && result?.key === 'ready') result = {...result, key: 'local'};
    if (fresh && ['ready', 'stored', 'flagsStored'].includes(result?.key) && result.remote
      && (system.revision !== result.remote.revision || system.build !== result.remote.build)) result = {...result, key: 'changed', check: undefined};
    const checked = result?.key === 'ready';
    const ready = checked && fresh && !stored;
    const blocked = busy() || !system || stored;
    const sent = result?.key === 'stored' || result?.key === 'flagsStored';
    const confirmedReceipt = sent && fresh && system.runtime && !system.transferPending && !system.updatePending;
    check.disabled = checkFromEditor.disabled = blocked;
    store.disabled = blocked || !ready;
    check.hidden = checkFromEditor.hidden = store.hidden = stored;
    check.classList.toggle('primary', !ready);
    store.classList.toggle('primary', ready);
    bindText(store, () => t('desktop.review.store'));
    let key = result?.key ?? (fresh ? 'start' : 'startDisconnected');
    if (stored) key = 'storedView';
    else if (sent && !confirmedReceipt) key = 'storedUnconfirmed';
    else if (ready && result.flags) key = 'readyFlags';
    else if (key === 'local' && fresh) key = 'connectedAfterCheck';
    else if (key === 'local' && connected) key = 'readAfterLocal';
    const name = system?.name ?? view?.desktop.systemName ?? '';
    let message = !stored && result?.error ? t(result.validation?.issues.length ? 'desktop.review.invalid'
      : errorKeys[result.error] ?? 'project.' + result.error, {name}) : t('desktop.review.' + key, {name});
    if (!stored && confirmedReceipt) {
      const total = system.runtime.rules.length;
      const enabled = system.runtime.rules.filter(rule => rule.enabled).length;
      message += ' ' + t('desktop.flags.count', {enabled: formatNumber(enabled), total: formatNumber(total), count: total});
    }
    const progressing = busy() && transferProgress && !transferProgress.failed && transferProgress.phase !== 'complete';
    const transferMessage = progressing ? t('desktop.transfer.' + transferProgress.phase)
      : stored || result ? message : t('desktop.steps.transferNeedsReview');
    transferCard.setAttribute('aria-busy', String(Boolean(progressing)));
    if (explanation.textContent !== message) explanation.textContent = message;
    if (transferStatus.textContent !== transferMessage) transferStatus.textContent = transferMessage;
    explanation.dataset.tone = transferStatus.dataset.tone = stored ? '' : result?.error ? 'error'
      : sent && !confirmedReceipt || key === 'changed' ? 'warning' : ready || confirmedReceipt ? 'success' : '';
    const draftContents = () => stored ? '' : t('desktop.steps.contents', {rules: formatNumber(view?.configuration.automations.length ?? 0),
      sequences: formatNumber(view?.configuration.sequences.length ?? 0)});
    bindText(contents, draftContents);
    bindText(transferContents, draftContents);
    const assessment = result?.check;
    transferMode.hidden = !assessment || stored || sent;
    transferChanges.hidden = !assessment || stored || sent || assessment.kind === 'unchanged';
    bindText(transferMode, () => assessment ? t('desktop.review.mode.' + assessment.kind) : '');
    bindText(transferChanges, () => assessment ? t('desktop.review.changeCounts', {
      added: formatNumber(assessment.added), changed: formatNumber(assessment.changed), removed: formatNumber(assessment.removed)
    }) : '');
    bindText(target, () => t('desktop.steps.transferTarget', {name, topic: system?.baseTopic ?? view?.module.baseTopic ?? ''}));
    bindText(transferHelp, () => stored || sent ? '' : t(result?.flags ? 'desktop.steps.transferFlagsHelp' : 'desktop.steps.transferHelp'));
    const needRead = result?.key === 'local' && !fresh || ['disconnected', 'timeout', 'protocol', 'transferChanged'].includes(result?.error);
    paintLink(nextReview, stored ? 'draft' : ready ? 'transfer' : sent || key === 'unchanged' ? 'operation' : needRead ? 'connection' : '');
    nextReview.classList.toggle('primary', ready);
    paintLink(nextTransfer, stored ? 'draft' : sent || key === 'unchanged' ? ''
      : ready || busy() ? '' : needRead ? 'connection' : 'review');
    nextTransfer.classList.add('primary');
    reconcile.hidden = !connected || ready;
    reconcile.disabled = busy();
    nextActions.hidden = stored || !sent && key !== 'unchanged';
    testNext.disabled = operationNext.disabled = busy() || !fresh;
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
    const scope = draftScope(view);
    result = {scope, view, flags, ...(result?.scope === scope ? {check: result.check} : {}), ...update};
    paint();
  }
  function updateOutcome(view, flags, response) {
    if (!response.ok) set(view, flags, {key: 'error', error: response.error, validation: response.validation});
    else {
      const assessment = response.state.draftChecks?.find(item => item.id === view.workspaceContext.systemId);
      if (assessment) flags = assessment.kind === 'flags';
      const key = {transferValidated: 'ready', transferUnchanged: 'unchanged', transferStopped: 'stoppedAfterUncertain', transferStored: flags ? 'flagsStored' : 'stored', transferCanceled: 'canceled',
        transferChecked: 'receiverRead', transferInstalled: 'receiverRead'}[response.state.outcome] ?? 'changed';
      set(view, flags, {key, ...(assessment ? {check: assessment} : {}), remote: response.state.systems.find(system => system.id === view.workspaceContext.systemId)});
    }
  }
  function validate() {
    const flags = false;
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
      const latest = current();
      if (draftScope(latest.view) !== draftScope(snapshot)) return;
      if (latest.broker?.state !== 'connected' || !latest.system?.fresh) { set(snapshot, flags, {key: 'local'}); return; }
      set(snapshot, flags, {key: 'checkingReceiver'});
      updateOutcome(snapshot, flags, await command('validate', context.systemId));
    }, () => set(current().view, flags, {key: 'error', error: 'failed'}));
  }
  function transfer() {
    return perform(async () => {
      const {view, system} = current();
      if (!system || view.desktop.source !== 'draft' || result?.key !== 'ready' || result.scope !== draftScope(view)) return;
      const {flags} = result;
      set(view, flags, {key: 'transferring'});
      updateOutcome(view, flags, await command('store', system.id));
    }, () => set(current().view, result?.flags ?? false, {key: 'error', error: 'failed'}));
  }
  function checkTransfer() {
    return perform(async () => {
      const {view, system} = current();
      if (system) updateOutcome(view, result?.flags ?? false, await command('checkTransfer', system.id));
    }, () => set(current().view, false, {key: 'error', error: 'failed'}));
  }
  return {paint};
}
