import {designerRequest as fetch} from './transport.js';
import {t, bindText, bindHTML, bindAttribute, localizedOption, localizeRecord, MessageError, ResponseError, locale, formatDate, formatNumber, onLanguageChange, installLanguagePicker, localizeResponse} from './localization.js';
import {createUUID} from './identity.js';
/* Local-only rule management. Confirmation captures its system and exact draft. */
export function matchesRuleState(entry, state) {
    return state === 'all' || entry.enabled === undefined || entry.enabled === (state === 'enabled');
}

export function sequenceUsers(configuration, id) {
    return (configuration?.automations ?? []).filter(rule => rule.actions.some(action => action.type === 'sequence' && action.sequence_id === id));
}

export function installManagement({getData, getEntry, isLoading, reload, copied, message, filterChanged}) {
    const tools = document.querySelector('.entry-tools');
    const makeButton = (label, action) => {
        const button = document.createElement('button'); button.type = 'button'; bindText(button, () => label);
        button.addEventListener('click', action); tools.append(button); return button;
    };
    const copy = makeButton(() => t("ui.copy.automation.a11c6559"), () => open('copy-rule'));
    const remove = makeButton(() => t("ui.delete.6c2d3521"), () => open(getEntry()?.kind === 'sequence' ? 'delete-sequence' : 'delete-rule'));
    remove.classList.add('danger');
    const filterLabel = document.createElement('label'); filterLabel.className = 'rule-state-filter'; bindText(filterLabel, () => t("ui.rule.switch.in.draft.a8efd4ee"));
    const filter = document.createElement('select'); bindAttribute(filter, 'aria-label', () => t("ui.filter.automations.by.rule.switch.9c15797e"));
    for (const [value, label] of [['all', () => t("ui.all.3801a35c")], ['enabled', () => t("ui.enabled.10639ced")], ['disabled', () => t("ui.disabled.89fc217b")]]) filter.add(localizedOption(() => label, value));
    filterLabel.append(filter); document.querySelector('#categories').before(filterLabel);
    const dialog = document.createElement('dialog'); dialog.className = 'management-dialog';
    dialog.setAttribute('aria-labelledby', 'management-title');
    bindHTML(dialog, () => `<h2 id="management-title"></h2><p class="management-description"></p><ul class="management-users"></ul><p class="creation-feedback" role="status"></p><div class="dialog-actions"><button type="button" class="management-cancel">${t("ui.cancel.f7ff1178")}</button><button type="button" class="primary management-accept">${t("ui.confirm.15b63b4d")}</button></div>`);
    document.body.append(dialog);
    const $ = selector => dialog.querySelector(selector);
    let busy = false; let pending = null; let lastCategory = 'device'; let lastState = 'all';
    const binding = () => {
        const ctx = getData()?.workspaceContext;
        return ctx ? {'X-Z2MA-System-ID': ctx.systemId, 'X-Z2MA-Generation': String(ctx.generation), 'X-Z2MA-Fingerprint': ctx.fingerprint} : {};
    };
    async function send(payload, headers) {
        const endpoint = new URL('manage', location.href); endpoint.hash = '';
        const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Z2MA-Read-Token': location.hash.slice(1), ...headers},
                body: JSON.stringify(payload), credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal});
            const text = await response.text(); if (text.length > 65536) throw new Error('transport');
            return {ok: response.ok, result: localizeResponse(JSON.parse(text))};
        } finally { clearTimeout(timeout); }
    }
    const showUsers = users => {
        $('.management-users').replaceChildren(...users.map(user => { const item = document.createElement('li'); bindText(item, () => user); return item; }));
    };
    function open(operation) {
        if (busy || isLoading() || !getData()?.manageAllowed || !getEntry()) return;
        const entry = getEntry();
        pending = {payload: {requestId: createUUID(), context: getData().createContext, operation, id: entry.id}, headers: binding()};
        const users = operation === 'delete-sequence' ? sequenceUsers(getData().configuration, entry.id) : [];
        bindText($('#management-title'), () => operation === 'copy-rule' ? t("ui.copy.automation.a11c6559") : operation === 'delete-sequence' ? t("ui.delete.action.sequence.513f26f2") : t("ui.delete.automation.e085c565"));
        bindText($('.management-description'), () => users.length ? t("ui.is.still.used.by.the.ed7ff2ea", {p1: entry.name})
            : operation === 'copy-rule' ? t("ui.add.to.the.local.draft.5dfad1ef", {p1: entry.name})
            : t("ui.delete.from.the.local.draft.9833206b", {p1: entry.name}));
        showUsers(users.map(rule => rule.name)); bindText($('.creation-feedback'), () => '');
        $('.management-accept').hidden = users.length > 0;
        bindText($('.management-accept'), () => operation === 'copy-rule' ? t("ui.create.disabled.copy.a694e619") : t("ui.delete.from.draft.8f1da547"));
        dialog.showModal();
    }
    $('.management-cancel').addEventListener('click', () => { if (!busy) dialog.close(); });
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    $('.management-accept').addEventListener('click', async () => {
        if (busy || !pending) return;
        busy = true; $('.management-accept').disabled = true; $('.management-cancel').disabled = true;
        bindText($('.creation-feedback'), () => t("ui.checking.and.applying.the.change.8b5294a6"));
        try {
            const {ok, result} = await send(pending.payload, pending.headers);
            if (!ok) { bindText($('.creation-feedback'), () => result.message || t("ui.the.change.was.not.applied.e22055f1")); showUsers(result.users ?? []); return; }
            dialog.close();
            let refreshed;
            if (result.operation === 'copy-rule') { filter.value = 'all'; filterChanged('all'); refreshed = await copied(result.ruleId); }
            else refreshed = await reload();
            message(() => (result.message + (refreshed === false ? t("ui.the.view.could.not.be.cc3a5826") : '')));
        } catch { bindText($('.creation-feedback'), () => t("ui.no.confirmation.from.the.module.c11ca7f5")); }
        finally { busy = false; $('.management-accept').disabled = false; $('.management-cancel').disabled = false; refresh(lastCategory, lastState); }
    });
    filter.addEventListener('change', async () => {
        filterChanged(filter.value);
        if (!getData()?.manageAllowed || isLoading()) return;
        const payload = {requestId: createUUID(), context: getData().createContext, operation: 'filter', id: filter.value};
        try { const {ok, result} = await send(payload, binding()); message(() => (ok ? t("ui.overview.filtered.enabled.refers.to.cd4a66c1") : result.message)); }
        catch { message(() => (t("ui.the.overview.was.filtered.locally.3811d8e0"))); }
    });
    function refresh(category, state) {
        lastCategory = category; lastState = state;
        const entry = getEntry(); const rule = Boolean(entry?.triggers);
        copy.hidden = !rule; copy.disabled = busy || isLoading() || !getData()?.manageAllowed;
        remove.hidden = !rule && entry?.kind !== 'sequence'; remove.disabled = busy || isLoading() || !getData()?.manageAllowed;
        bindText(remove, () => entry?.kind === 'sequence' ? t("ui.delete.action.sequence.513f26f2") : t("ui.delete.automation.e085c565"));
        filterLabel.hidden = !['device', 'time'].includes(category); filter.value = state;
    }
    return {refresh};
}
