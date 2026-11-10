import {designerRequest as fetch} from './transport.js';
import {t, bindText, bindHTML, bindAttribute, localizedOption, localizeRecord, MessageError, ResponseError, locale, formatDate, formatNumber, onLanguageChange, installLanguagePicker, localizeResponse} from './localization.js';
import {createUUID} from './identity.js';
import {systemHeaders} from './workspace.js';

/* A POST is sent only after an explicit click. Polling reads cached module results. */
export async function transferRequest(data, action, {token, request = fetch, base = location.href, requestId = createUUID()} = {}) {
    const context = data?.workspaceContext;
    if (!context || (action !== 'status' && !['validate', 'store'].includes(action))) throw new MessageError("ui.invalid.system.request.refresh.the.81925fd9");
    const endpoint = new URL(action === 'status' ? 'transfer-status' : 'transfer', base); endpoint.hash = '';
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        let response; let result;
        try {
            response = await request(endpoint, {method: action === 'status' ? 'GET' : 'POST',
                headers: {'X-Z2MA-Read-Token': token, ...systemHeaders(data), ...(action === 'status' ? {} : {'Content-Type': 'application/json'})},
                ...(action === 'status' ? {} : {body: JSON.stringify({action, context: data.transfer.context, requestId})}),
                credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal});
            result = localizeResponse(await response.json());
        } catch (error) {
            if (error.name === 'AbortError') throw error;
            throw new MessageError("ui.no.readable.reply.from.the.377fece8");
        }
        if (!response.ok || !result.ok) throw new ResponseError(result, () => t("ui.request.not.confirmed.refresh.transfer.6e2b8c3c"));
        if (result.transfer?.systemId !== context.systemId || result.transfer?.generation !== context.generation
            || typeof result.transfer.message !== 'string' || typeof result.transfer.details !== 'string'
            || typeof result.transfer.context !== 'string' || typeof result.transfer.pending !== 'boolean'
            || typeof result.transfer.canValidate !== 'boolean' || typeof result.transfer.canStore !== 'boolean') throw new MessageError("ui.the.reply.does.not.belong.9f61c4ab");
        return result.transfer;
    } finally { clearTimeout(timeout); }
}

export function installTransfers({getData, reload, isLoading = () => false, message}) {
    const panel = document.createElement('section'); panel.className = 'system-transfer'; panel.hidden = true;
    const heading = document.createElement('strong');
    const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const details = document.createElement('p'); details.className = 'transfer-details';
    const actions = document.createElement('div'); actions.className = 'transfer-actions';
    const buttons = {};
    for (const [action, text] of [['validate', t("ui.validate.draft.in.z2m.dc5dee26")], ['store', t("ui.save.validated.draft.in.z2m.a3205ccc")], ['status', t("ui.refresh.transfer.status.efafc952")]]) {
        const button = document.createElement('button'); button.type = 'button'; button.setAttribute('data-transfer-action', action); bindText(button, () => text);
        button.addEventListener('click', () => send(action)); buttons[action] = button; actions.append(button);
    }
    const note = document.createElement('p'); note.className = 'field-help';
    bindText(note, () => t("ui.saving.replaces.only.this.system.76c800ba"));
    panel.append(heading, status, details, actions, note); document.querySelector('.system-selector').after(panel);
    let timer = null; let busy = false; let windowEnd = 0; let observed = '';
    const current = captured => getData()?.workspaceContext?.systemId === captured?.workspaceContext?.systemId
        && getData()?.workspaceContext?.generation === captured?.workspaceContext?.generation;
    const paint = () => {
        const data = getData(); const view = data?.transfer;
        panel.hidden = !data?.workspace || !view;
        if (panel.hidden) return;
        bindText(heading, () => t("ui.validate.and.transfer.2656b35e", {p1: data.module.baseTopic}));
        bindText(status, () => view.message); bindText(details, () => view.details);
        buttons.validate.disabled = busy || isLoading() || !view.canValidate;
        buttons.store.disabled = busy || isLoading() || !view.canStore;
        buttons.status.disabled = busy || isLoading();
    };
    const schedule = () => {
        clearTimeout(timer);
        if (getData()?.transfer?.pending && Date.now() < windowEnd) timer = setTimeout(() => send('status', true), 1200);
    };
    async function send(action, automatic = false) {
        if (busy || isLoading()) { if (automatic) schedule(); return; }
        const data = getData(); if (!data?.transfer) return;
        if (action !== 'status' && document.querySelector('dialog[open]')) { message(() => (t("ui.apply.or.close.the.open.fc12a342"))); return; }
        if (action === 'validate' && !data.transfer.canValidate || action === 'store' && !data.transfer.canStore) return;
        if (action === 'store' && !confirm(t("ui.save.the.validated.draft.for.7095eb90", {p1: data.module.baseTopic}))) return;
        busy = true; clearTimeout(timer); paint();
        if (!automatic) windowEnd = Date.now() + 120000;
        try {
            const view = await transferRequest(data, action, {token: location.hash.slice(1)});
            if (!current(data)) return;
            // A stale read must never replace the model of a newer local edit.
            if (getData() !== data) { await reload(); return; }
            data.transfer = view;
            if (typeof view.receiverConfirmed === 'boolean') {
                data.status = {...data.status, storedConfirmed: view.receiverConfirmed,
                    storedRevision: view.storedRevision ?? data.status?.storedRevision};
            }
            if (view.fingerprint !== data.workspaceContext.fingerprint) await reload();
            else paint();
        } catch (error) {
            if (current(data)) message(() => (error.name === 'AbortError'
                ? t("ui.still.awaiting.a.reply.nothing.43fe03b3") : error.message));
        } finally { busy = false; paint(); schedule(); }
    }
    return () => {
        const data = getData(); const key = `${data?.workspaceContext?.systemId ?? ''}:${data?.transfer?.operation ?? ''}`;
        if (observed !== key) { observed = key; windowEnd = Date.now() + 120000; }
        paint(); schedule();
    };
}
