import {bindText, formatNumber, locale, onLanguageChange, t} from './localization.js';

const runStates = new Set(['running', 'stopped', 'completed', 'skipped', 'failed']);

export function installAutomationOverview(page, reload) {
    const actions = document.createElement('div'); actions.className = 'project-actions';
    const refresh = document.createElement('button'); refresh.type = 'button'; refresh.id = 'automation-overview-reload';
    bindText(refresh, () => t('automationOverview.reload'));
    actions.append(refresh);
    const feedback = document.createElement('p'); feedback.setAttribute('role', 'status');
    const cards = document.createElement('div'); cards.className = 'automation-overview';
    page.append(actions, feedback, cards);
    let systems = [];
    let shown;
    let message = '';

    const make = (tag, parent, text) => {
        const element = document.createElement(tag);
        if (text !== undefined) element.textContent = text;
        parent.append(element);
        return element;
    };
    function paint() {
        feedback.textContent = message ? t(`automationOverview.${message}`) : '';
        const signature = JSON.stringify([locale(), systems]);
        if (signature === shown) return;
        shown = signature;
        cards.replaceChildren();
        const compare = new Intl.Collator(locale(), {numeric: true, sensitivity: 'base'}).compare;
        for (const system of [...systems].sort((a, b) => compare(a.name, b.name) || compare(a.baseTopic, b.baseTopic))) {
            const card = make('section', cards); card.className = 'desktop-card';
            const heading = make('h2', card, system.name); heading.id = 'automation-overview-' + system.id;
            card.setAttribute('aria-labelledby', heading.id);
            make('p', card, system.baseTopic);
            const status = system.executing === true ? 'running' : system.executing === false ? 'stopped' : 'unknown';
            make('p', card, t(`automationOverview.operation.${status}`));
            if (system.rules === null) {
                make('p', card, t('automationOverview.unread'));
                continue;
            }
            make('p', card, t(system.confirmed ? 'automationOverview.current' : 'automationOverview.lastRead', {revision: formatNumber(system.revision)}));
            if (!system.rules.length) {
                make('p', card, t('automationOverview.empty'));
                continue;
            }
            const table = make('table', card); table.setAttribute('aria-labelledby', heading.id);
            const header = make('tr', make('thead', table));
            for (const key of ['rule', 'enabled', 'run']) make('th', header, t(`automationOverview.${key}`)).scope = 'col';
            const body = make('tbody', table);
            for (const rule of [...system.rules].sort((a, b) => compare(a.name, b.name))) {
                const row = make('tr', body);
                make('th', row, rule.name).scope = 'row';
                make('td', row, t(rule.enabled ? 'mqtt.ruleEnabled' : 'mqtt.ruleDisabled'));
                make('td', row, system.confirmed && runStates.has(rule.run) ? t(`mqtt.run.${rule.run}`) : '—');
            }
        }
        if (!systems.length) make('p', cards, t('automationOverview.noSystems'));
    }
    refresh.addEventListener('click', async () => {
        refresh.disabled = true;
        message = 'reading'; paint();
        try { message = await reload() === false ? 'failed' : ''; }
        catch { message = 'failed'; }
        finally { refresh.disabled = false; paint(); }
    });
    onLanguageChange(paint);
    paint();
    return value => { systems = value ?? []; paint(); };
}
