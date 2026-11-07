import {designerRequest as fetch} from './transport.js';
import {t, bindText, bindHTML, bindAttribute, localizedOption, localizeRecord, MessageError, ResponseError, locale, formatDate, formatNumber, onLanguageChange, installLanguagePicker, localizeResponse} from './localization.js';
import {createUUID} from './identity.js';
import {systemHeaders} from './workspace.js';

/* An explicit POST starts the read workflow. Polling never starts or repeats MQTT. */
export async function catalogRequest(data, action, {token, request = fetch, base = location.href, requestId = createUUID()} = {}) {
    const ctx = data?.workspaceContext;
    if (!ctx || !['refresh', 'status'].includes(action)) throw new MessageError("ui.please.select.a.z2m.system.ec4dffcc");
    const endpoint = new URL(action === 'refresh' ? 'catalog-refresh' : 'catalog-status', base); endpoint.hash = '';
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        let response; let result;
        try {
            response = await request(endpoint, {method: action === 'refresh' ? 'POST' : 'GET',
                headers: {'X-Z2MA-Read-Token': token, ...systemHeaders(data), ...(action === 'refresh' ? {'Content-Type': 'application/json'} : {})},
                ...(action === 'refresh' ? {body: JSON.stringify({requestId})} : {}),
                credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal});
            const text = await response.text(); if (text.length > 16384) throw new Error('response_limit'); result = localizeResponse(JSON.parse(text));
        } catch {
            throw new MessageError("ui.no.clear.reply.about.device.44125747");
        }
        if (!response.ok || !result.ok) throw new ResponseError(result, () => t("ui.device.data.could.not.be.2b5c6d20"));
        const view = result.catalogRefresh;
        if (view?.systemId !== ctx.systemId || view.generation !== ctx.generation || typeof view.message !== 'string'
            || typeof view.fingerprint !== 'string' || typeof view.operation !== 'string' || typeof view.phase !== 'string'
            || typeof view.pending !== 'boolean' || typeof view.canRefresh !== 'boolean'
            || !view.counts || !['devices', 'groups', 'scenes'].every(key => Number.isSafeInteger(view.counts[key]) && view.counts[key] >= 0)
            || !(view.loadedAt === null || Number.isSafeInteger(view.loadedAt))
            || !(view.storedAt === null || Number.isSafeInteger(view.storedAt))) throw new MessageError("ui.the.reply.does.not.belong.a2b7d3c8");
        return view;
    } finally { clearTimeout(timeout); }
}

export function installCatalogRefresh({getData, reload, isLoading = () => false, message}) {
    const panel = document.createElement('section'); panel.className = 'system-catalog'; panel.hidden = true;
    const heading = document.createElement('strong');
    const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const details = document.createElement('p'); details.className = 'field-help';
    const actions = document.createElement('div'); actions.className = 'catalog-actions';
    const refresh = document.createElement('button'); refresh.type = 'button'; bindText(refresh, () => t("ui.refresh.device.data.150e4e86"));
    const poll = document.createElement('button'); poll.type = 'button'; bindText(poll, () => t("ui.check.loading.status.d0ff7371"));
    actions.append(refresh, poll);
    const note = document.createElement('p'); note.className = 'field-help';
    bindText(note, () => t("ui.loads.only.devices.channels.groups.813e397b"));
    panel.append(heading, status, details, actions, note); document.querySelector('.system-selector').after(panel);
    let busy = false; let timer = null; let observed = ''; let windowEnd = 0; let localError = null;
    const current = captured => getData()?.workspaceContext?.systemId === captured?.workspaceContext?.systemId
        && getData()?.workspaceContext?.generation === captured?.workspaceContext?.generation;
    function paint() {
        const data = getData(); const view = data?.catalogRefresh;
        panel.hidden = !data?.workspace || !view;
        if (panel.hidden) return;
        bindText(heading, () => t("ui.device.data.1fc04522", {p1: data.module.baseTopic}));
        bindText(status, () => localError && current(localError.data) ? localError.message : view.message);
        bindText(details, () => view.loadedAt === null ? (view.storedAt === null ? t("ui.no.confirmed.device.catalog.has.5b10c8e4")
            : t("ui.previously.saved.not.currently.confirmed.16ba7ca9", {p1: new Date(view.storedAt * 1000).toLocaleString(locale())}))
            : t("ui.last.loaded.devices.groups.scenes.917d026d", {p1: new Date(view.loadedAt * 1000).toLocaleString(locale()), p2: view.counts.devices, p3: view.counts.groups, p4: view.counts.scenes}));
        panel.setAttribute('aria-busy', String(busy || view.pending));
        panel.classList.toggle('is-loading', busy || view.pending);
        refresh.disabled = busy || isLoading() || !view.canRefresh;
        poll.disabled = busy || isLoading();
        bindText(refresh, () => view.pending ? t("ui.loading.device.data.62d8fef4") : t("ui.refresh.device.data.150e4e86"));
    }
    function schedule() {
        clearTimeout(timer);
        if (getData()?.catalogRefresh?.pending && Date.now() < windowEnd) timer = setTimeout(() => send('status', true), 1200);
    }
    async function send(action, automatic = false) {
        if (busy || isLoading()) { if (automatic) schedule(); return; }
        const data = getData(); if (!data?.catalogRefresh) return;
        if (action === 'refresh' && document.querySelector('dialog[open]')) { message(() => (t("ui.apply.or.close.the.open.dd23d097"))); return; }
        if (action === 'refresh' && !data.catalogRefresh.canRefresh) return;
        localError = null; busy = true; clearTimeout(timer); paint();
        if (!automatic) windowEnd = Date.now() + 610000;
        if (action === 'refresh') { bindText(status, () => t("ui.requesting.device.data.refresh.38dedb33")); message(() => (t("ui.requesting.current.device.data.drafts.a5e89e33"))); }
        try {
            const view = await catalogRequest(data, action, {token: location.hash.slice(1)});
            if (!current(data)) return;
            // Do not replace an editing model while the user has a modal with unsaved inputs.
            if (getData() !== data) { if (!document.querySelector('dialog[open]')) await reload(); return; }
            data.catalogRefresh = view;
            if (view.phase === 'loaded' && view.fingerprint !== data.workspaceContext.fingerprint) {
                if (document.querySelector('dialog[open]')) message(() => (t("ui.device.data.has.loaded.your.f59288f4")));
                else {
                    const loaded = await reload();
                    message(() => (loaded === false ? t("ui.device.data.has.loaded.the.3d94e1f2") : view.message));
                }
            } else if (!automatic || !view.pending) message(() => (view.message));
        } catch (error) {
            if (current(data)) { localError = {data, message: error.message}; message(() => (error.message)); }
        } finally { busy = false; paint(); schedule(); }
    }
    refresh.addEventListener('click', () => send('refresh'));
    poll.addEventListener('click', () => send('status'));
    return () => {
        const data = getData(); const key = `${data?.workspaceContext?.systemId ?? ''}:${data?.catalogRefresh?.operation ?? ''}`;
        if (observed !== key) { observed = key; windowEnd = Date.now() + 610000; }
        paint(); schedule();
    };
}
