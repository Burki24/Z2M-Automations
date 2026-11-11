import {t, bindText, bindAttribute, onLanguageChange, locale} from './localization.js';

export function installPartnerOverview() {
  const panel = document.createElement('section'); panel.id = 'desktop-partner-overview'; panel.className = 'desktop-partner-overview';
  const header = document.createElement('div'); header.className = 'desktop-partner-header';
  const heading = document.createElement('h2'); heading.id = 'desktop-partner-title';
  const actions = document.createElement('div'); actions.id = 'desktop-partner-actions';
  header.append(heading, actions); panel.append(header);
  panel.setAttribute('aria-labelledby', heading.id);
  const scope = document.createElement('p'); bindText(scope, () => t('desktop.partners.scope')); panel.append(scope);
  const saved = document.createElement('p'); saved.className = 'field-help'; panel.append(saved);
  const empty = document.createElement('p'); bindText(empty, () => t('desktop.partners.empty')); panel.append(empty);
  const scroll = document.createElement('div'); scroll.className = 'desktop-partner-scroll'; scroll.tabIndex = 0;
  bindAttribute(scroll, 'aria-label', () => t('desktop.partners.title'));
  const table = document.createElement('table'); table.setAttribute('aria-labelledby', heading.id);
  const head = document.createElement('thead'); const labels = document.createElement('tr');
  for (const key of ['source', 'receiver', 'project', 'z2m']) {
    const cell = document.createElement('th'); cell.scope = 'col'; bindText(cell, () => t('desktop.partners.' + key)); labels.append(cell);
  }
  head.append(labels); const body = document.createElement('tbody'); table.append(head, body); scroll.append(table); panel.append(scroll);
  const requirements = document.createElement('details'); requirements.className = 'desktop-partner-requirements';
  const title = document.createElement('summary'); bindText(title, () => t('desktop.partners.requirements')); requirements.append(title);
  for (const key of ['accounts', 'acl', 'bridge', 'unverified']) {
    const text = document.createElement('p'); bindText(text, () => t('desktop.partners.' + key)); requirements.append(text);
  }
  panel.append(requirements);
  document.querySelector('#project-system-form').before(panel);
  let view;
  let signature = '';
  function paint() {
    panel.hidden = !view?.desktop?.project;
    if (panel.hidden) return;
    const {compare} = new Intl.Collator(locale(), {numeric: true, sensitivity: 'base'});
    const rows = (view.partnerPermissions ?? []).toSorted((a, b) => {
      return compare(a.receiver, b.receiver) || compare(a.source, b.source) || compare(a.sourceTopic, b.sourceTopic);
    });
    bindText(heading, () => t('desktop.partners.count', {count: rows.filter(row => row.configured).length}));
    bindText(saved, () => t(view.desktop.projectDirty ? 'desktop.partners.unsaved' : 'desktop.partners.saved'));
    empty.hidden = Boolean(rows.length); scroll.hidden = !rows.length;
    const next = JSON.stringify([locale(), rows]);
    if (signature === next) return;
    signature = next;
    const note = (cell, text) => { const line = document.createElement('span'); line.className = 'field-help'; line.textContent = text; cell.append(line); };
    body.replaceChildren(...rows.map(row => {
      const tr = document.createElement('tr');
      tr.dataset.source = row.sourceTopic; tr.dataset.receiver = row.receiverId;
      for (const [name, topic, broker] of [[row.source, row.sourceTopic, row.sourceBroker], [row.receiver, row.receiverTopic, row.receiverBroker]]) {
        const cell = document.createElement('td'); const strong = document.createElement('strong'); strong.textContent = name; cell.append(strong);
        note(cell, topic); if (broker) note(cell, t('desktop.overview.brokerName', {name: broker})); tr.append(cell);
      }
      const local = document.createElement('td'); local.textContent = t(row.configured ? 'desktop.partners.configured' : 'desktop.partners.removed');
      if (!row.assigned) note(local, t('desktop.partners.unassigned'));
      else if (row.configured && !row.reciprocal) note(local, t('desktop.partners.oneWay'));
      const stored = document.createElement('td');
      stored.textContent = t(row.stored === null ? 'desktop.partners.unknown' : row.confirmed
        ? row.stored ? 'desktop.partners.confirmed' : 'desktop.partners.denied'
        : row.stored ? 'desktop.partners.lastGranted' : 'desktop.partners.lastDenied');
      if (row.stored && row.confirmed) note(stored, t(row.active === true ? 'desktop.partners.active' : row.active === false ? 'desktop.partners.stopped' : 'desktop.partners.runtimeUnknown'));
      tr.append(local, stored); return tr;
    }));
  }
  document.addEventListener('z2ma-designer-view', ({detail}) => { view = detail; paint(); });
  onLanguageChange(paint);
  paint();
}
