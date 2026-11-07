import {designerRequest as fetch} from './transport.js';
import {t, bindText, bindHTML, bindAttribute, localizedOption, localizeRecord, MessageError, ResponseError, locale, formatDate, formatNumber, onLanguageChange, installLanguagePicker, localizeResponse} from './localization.js';
import {createUUID} from './identity.js';
/* Explicit, local-only event migration. Never execute a Symcon event or send a Z2M command. */
import {systemHeaders} from './workspace.js';

export function importRows(view, search = '', supportedOnly = false) {
    const term = search.trim().toLocaleLowerCase(locale());
    return (view?.rows ?? []).filter(row => (!supportedOnly || row.importable)
        && `${row.name} ${row.device} ${row.id} ${row.instanceId}`.toLocaleLowerCase(locale()).includes(term));
}

export function importMessage(view, preview = false) {
    return view?.blocked || (preview ? view?.selected?.assessment : '') || view?.message || t("ui.refresh.the.import.view.03cfa009");
}

function checkedView(view, context) {
    return view?.systemId === context.systemId && view.generation === context.generation && typeof view.context === 'string'
        && /^[a-f0-9]{64}$/.test(view.context) && typeof view.message === 'string' && typeof view.canEvaluate === 'boolean'
        && typeof view.scanned === 'boolean' && typeof view.limited === 'boolean' && Array.isArray(view.rows) && view.rows.length <= 256
        && view.rows.every(row => Number.isSafeInteger(row.id) && row.id > 0 && (row.instanceId === '' || Number.isSafeInteger(row.instanceId))
            && ['name', 'device', 'assessment'].every(key => typeof row[key] === 'string') && typeof row.importable === 'boolean' && typeof row.imported === 'boolean')
        && Number.isSafeInteger(view.selected?.id) && typeof view.selected.canImport === 'boolean'
        && ['name', 'summary', 'assessment', 'token'].every(key => typeof view.selected[key] === 'string')
        && (view.selected.canImport ? /^[a-f0-9]{32}$/.test(view.selected.token) : view.selected.token === '');
}

export async function importRequest(data, payload, {token, base = location.href, request = fetch} = {}) {
    if (!data?.workspaceContext) throw new MessageError("ui.please.select.a.z2m.system.ec4dffcc");
    const endpoint = new URL('event-import', base); endpoint.hash = '';
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        let response; let result;
        try {
            response = await request(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Z2MA-Read-Token': token, ...systemHeaders(data)},
                body: JSON.stringify(payload), credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal});
            const text = await response.text(); if (text.length > 524288) throw Error('response_limit'); result = localizeResponse(JSON.parse(text));
        } catch { throw new MessageError("ui.no.clear.reply.was.received.0cd0ca79"); }
        if (result.view && !checkedView(result.view, data.workspaceContext)) throw new MessageError("ui.the.import.reply.does.not.ed166390");
        if (!response.ok || result.ok !== true) { const error = new ResponseError(result, () => t("ui.the.import.was.not.applied.e16f15ac")); error.view = result.view; throw error; }
        if (!checkedView(result.view, data.workspaceContext)) throw new MessageError("ui.the.import.reply.is.incomplete.bbb87e7c");
        return result;
    } finally { clearTimeout(timeout); }
}

export function installEventImport({getData, isLoading, reload, onImported, message}) {
    const button = document.createElement('button'); button.id = 'event-import-button'; bindText(button, () => t("ui.import.symcon.events.50a4d7c2"));
    document.querySelector('.toolbar').append(button);
    const dialog = document.createElement('dialog'); dialog.className = 'creation-dialog event-import-dialog'; dialog.id = 'event-import-dialog'; dialog.setAttribute('aria-labelledby', 'event-import-title');
    bindHTML(dialog, () => `<h2 id="event-import-title">${t("ui.import.symcon.events.50a4d7c2")}</h2><p class="event-import-system"></p>`
        + `<p>${t("ui.supported.symcon.events.are.imported.7e965a6d")}</p>`
        + `<div class="event-import-controls"><button type="button" class="event-import-scan">${t("ui.check.existing.events.6bea48c8")}</button><button type="button" class="event-import-refresh">${t("ui.refresh.view.6540358c")}</button>`
        + `<label>${t("ui.search.by.event.device.or.f6218f87")}<input class="event-import-search" type="search"></label><label class="event-import-filter"><input type="checkbox"> ${t("import.onlyImportable")}</label></div>`
        + `<p class="event-import-count"></p><div class="event-import-list"><table><thead><tr><th>${t("ui.event.af9e77ea")}</th><th>${t("ui.trigger.device.0b939f2d")}</th><th>${t("ui.import.check.802395ab")}</th></tr></thead><tbody></tbody></table></div>`
        + `<section class="event-import-preview" aria-label="${t("ui.import.preview.37a53c65")}"><h3>${t("ui.preview.69337f6d")}</h3><strong></strong><p class="event-import-assessment"></p><p class="event-import-summary"></p></section>`
        + `<p class="event-import-message" role="status" aria-live="polite"></p><div class="dialog-actions"><button type="button" class="event-import-cancel">${t("ui.close.b808f6e9")}</button><button type="button" class="event-import-accept primary">${t("ui.add.to.draft.disabled.aea3e1b7")}</button></div>`);
    document.body.append(dialog);
    const $ = selector => dialog.querySelector(selector);
    const search = $('.event-import-search'); const filter = $('.event-import-filter input');
    let captured; let view; let busy = false; let pending = null;
    const node = (tag, text) => { const element = document.createElement(tag); bindText(element, () => text); return element; };
    const current = () => Boolean(captured?.workspaceContext?.systemId) && captured.workspaceContext.systemId === getData()?.workspaceContext?.systemId && captured.workspaceContext.generation === getData()?.workspaceContext?.generation;
    const hint = text => { bindText($('.event-import-message'), () => text); };
    function paint() {
        bindText($('.event-import-system'), () => t("ui.z2m.system.2dafe324", {p1: captured?.module?.baseTopic ?? ''}));
        const rows = importRows(view, search.value, filter.checked); const body = $('tbody'); body.replaceChildren();
        bindText($('.event-import-count'), () => t("ui.of.events.037d77bb", {p1: rows.length, p2: view?.rows?.length ?? 0}) + (view?.limited ? t("ui.search.limit.reached.at.most.d23fa988") : ''));
        for (const row of rows) {
            const tr = document.createElement('tr'); if (row.id === view.selected.id) tr.classList.add('is-selected');
            const name = document.createElement('td'); const pick = node('button', () => (row.name)); pick.type = 'button'; pick.dataset.eventId = String(row.id); pick.disabled = busy;
            pick.addEventListener('click', () => send('preview', row.id)); name.append(pick, node('small', () => (t("ui.event.bb0cd0d1", {p1: row.id}))));
            const device = node('td', () => (row.device)); device.append(node('small', () => (t("ui.instance.f13732cb", {p1: row.instanceId || t("ui.no.longer.available.3b0eac8d")}))));
            const assessment = document.createElement('td'); assessment.append(node('strong', () => (row.imported ? t("ui.already.imported.dcb650a7") : row.importable ? t("ui.importable.5c60cd4f") : view.canEvaluate ? t("ui.not.importable.60809e0a") : t("ui.cannot.be.checked.yet.7e6170cb"))), node('p', () => (row.assessment)));
            tr.append(name, device, assessment); body.append(tr);
        }
        bindText($('.event-import-preview strong'), () => view?.selected?.name || (view?.selected?.id ? t("ui.event.bb0cd0d1", {p1: view.selected.id}) : t("ui.select.an.entry.for.the.e32ccb53")));
        bindText($('.event-import-assessment'), () => view?.selected?.assessment ?? '');
        bindText($('.event-import-summary'), () => view?.selected?.summary ?? '');
        $('.event-import-accept').disabled = busy || !current() || !view?.selected?.canImport;
        for (const selector of ['.event-import-scan', '.event-import-refresh', '.event-import-cancel', '.event-import-search', '.event-import-filter input']) $(selector).disabled = busy;
        $('.event-import-scan').disabled = busy || !current();
        dialog.setAttribute('aria-busy', String(busy));
    }
    async function send(action, eventId = 0) {
        if (busy || isLoading() || !current()) return;
        if (action === 'import' && !view.selected.canImport) return;
        const context = view.context; const previewToken = view.selected.token;
        if (!pending || pending.action !== action || pending.eventId !== eventId || pending.previewToken !== previewToken || pending.context !== context) {
            pending = {requestId: createUUID(), context, action, ...(action === 'scan' ? {} : {eventId}), ...(action === 'import' ? {previewToken} : {})};
        }
        busy = true; paint(); hint(() => (action === 'scan' ? t("ui.checking.events.for.this.system.e2665193") : action === 'preview' ? t("ui.checking.trigger.and.action.the.ccdf48a0") : t("ui.checking.the.event.again.and.3f3e0deb")));
        try {
            const result = await importRequest(captured, pending, {token: location.hash.slice(1)});
            if (!current() || !dialog.open) return;
            view = result.view; captured.eventImport = view; pending = null;
            hint(() => (importMessage(view, action === 'preview')));
            if (action === 'import') { dialog.close(); await onImported(result.ruleId); message(() => (result.message)); }
        } catch (error) { if (current() && dialog.open) { if (error.view) { view = error.view; captured.eventImport = view; } hint(() => (error.message)); } }
        finally { busy = false; paint(); }
    }
    button.addEventListener('click', () => {
        if (busy || isLoading() || !getData()?.eventImportAllowed) return;
        captured = getData(); view = structuredClone(captured.eventImport); pending = null; search.value = ''; filter.checked = false; paint(); hint(() => (importMessage(view))); dialog.showModal(); $('.event-import-scan').focus();
    });
    search.addEventListener('input', paint); filter.addEventListener('change', paint);
    $('.event-import-scan').addEventListener('click', () => send('scan'));
    $('.event-import-accept').addEventListener('click', () => send('import', view.selected.id));
    $('.event-import-cancel').addEventListener('click', () => { if (!busy) dialog.close(); });
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    $('.event-import-refresh').addEventListener('click', async () => {
        if (busy || isLoading()) return;
        busy = true; paint();
        try { if (await reload()) { captured = getData(); view = structuredClone(captured.eventImport); pending = null; hint(() => (importMessage(view))); } else hint(() => (t("ui.view.not.loaded.the.previous.3acdb137"))); }
        finally { busy = false; paint(); }
    });
    return {refresh() { button.hidden = !getData()?.workspace; button.disabled = isLoading() || !getData()?.eventImportAllowed; button.title = t("ui.check.events.for.the.selected.109174ec"); }};
}
