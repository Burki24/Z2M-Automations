import {t, formatNumber} from './localization.js';

export function validationLocation(issue) {
  const parts = issue.path.split('/').slice(1);
  const labels = [];
  for (let index = 0; index < parts.length; index++) {
    const field = parts[index];
    const position = parts[index + 1];
    let label = /^\d+$/.test(field) ? formatNumber(Number(field) + 1) : t(`validation.field.${field}`);
    if (position && /^\d+$/.test(position)) {
      label = t('validation.position', {label, number: formatNumber(Number(position) + 1)});
      index++;
    }
    labels.push(!labels.length && issue.name ? t('validation.named', {label, name: issue.name}) : label);
  }
  return labels.join(' → ') || t('validation.document');
}

export function validationReason(issue) {
  if (issue.capability) {
    const capability = issue.capability;
    const comparison = {eq: 'ui.is.equal.to.456b1261', ne: 'ui.is.not.equal.to.c72da4b0', gt: 'ui.is.greater.than.c23edfd9',
      gte: 'ui.is.at.least.8adebfa3', lt: 'ui.is.less.than.f2641c8f', lte: 'ui.is.at.most.53bbaac0'};
    const compare = value => comparison[value] ? t(comparison[value]) + ' (' + value + ')' : value;
    const operator = issue.reason === 'capability_operator';
    const entered = t('validation.capability.entered', {value: operator ? compare(capability.actual) : capability.actual,
      type: t(operator ? 'validation.type.operator' : 'validation.type.' + capability.actualType)});
    const number = value => formatNumber(value ?? 0) + (capability.unit ? ' ' + capability.unit : '');
    return entered + ' ' + t(`validation.reason.${issue.reason}`, {values: capability.allowed.map(value => operator ? compare(value) : value).join(', '),
      minimum: number(capability.minimum), maximum: number(capability.maximum), step: number(capability.step)});
  }
  const field = issue.path.split('/').at(-1);
  if (issue.reason === 'required' || issue.reason === 'minItems' && issue.limit === 1) {
    if (field === 'triggers') return t('validation.addTrigger');
    if (field === 'actions') return t('validation.addAction');
    if (field === 'values') return t('desktop.review.missingActionValue');
  }
  if (issue.reason === 'pattern' && ['at', 'after', 'before'].includes(field)) return t('validation.timeFormat');
  return t(`validation.reason.${issue.reason}`, issue.limit === undefined ? {} : {limit: formatNumber(issue.limit)});
}

export function validationCapability(issue) {
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

