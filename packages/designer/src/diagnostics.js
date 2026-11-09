import {designerRequest as fetch} from './transport.js';
import {t, bindText, bindHTML, bindAttribute, localizedOption, localizeRecord, MessageError, ResponseError, locale, formatDate, formatNumber, onLanguageChange, installLanguagePicker, localizeResponse} from './localization.js';
import {createUUID} from './identity.js';
import {systemHeaders} from './workspace.js';
import {checkedInstallation, installExtensionControl} from './installation.js';

const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
function checkedRow(v) {
    const b = v?.build; const d = v?.debug;
    return typeof v?.systemId === 'string' && integer(v.generation) && v.generation > 0 && integer(v.connection) && integer(v.mqttParent)
        && ['name', 'baseTopic', 'healthText'].every(key => typeof v[key] === 'string') && typeof v.mqttConnected === 'boolean' && typeof v.online === 'boolean'
        && (b === null || (['current', 'different', 'legacy', 'missing', 'unconfirmed'].includes(b?.comparison)
            && [b.installed, b.bundled].every(value => value === null || digest(value))
            && ['InstalledExtensionInfo', 'BundledExtensionInfo', 'ExtensionUpdateInfo'].every(key => typeof b.fields?.[key] === 'string')))
        && ['idle', 'starting', 'active', 'stopping'].includes(d?.phase) && typeof d.active === 'boolean' && typeof d.pending === 'boolean'
        && typeof d.canStart === 'boolean' && typeof d.canStop === 'boolean' && typeof d.message === 'string' && integer(d.remaining)
        && (d.until === null || integer(d.until));
}

export async function diagnosticsRequest(data, payload, {token, base = location.href, request = fetch} = {}) {
    const ctx = data?.workspaceContext;
    if (!ctx) throw new MessageError("ui.please.select.a.z2m.system.ec4dffcc");
    const endpoint = new URL(payload ? 'diagnostics' : 'diagnostics-status', base); endpoint.hash = '';
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        let response; let result;
        try {
            response = await request(endpoint, {method: payload ? 'POST' : 'GET', headers: {'X-Z2MA-Read-Token': token, ...systemHeaders(data), ...(payload ? {'Content-Type': 'application/json'} : {})},
                ...(payload ? {body: JSON.stringify(payload)} : {}), credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal});
            const text = await response.text(); if (text.length > 32768) throw Error('response_limit'); result = localizeResponse(JSON.parse(text));
        } catch { throw new MessageError("ui.no.clear.diagnostics.reply.was.3bd6ec0f"); }
        if (!response.ok || !result.ok) throw new ResponseError(result, () => t("ui.diagnostics.are.unavailable.reopen.the.c3ea6987"));
        const v = result.diagnostics;
        if (v?.systemId !== ctx.systemId || v.generation !== ctx.generation || !checkedRow(v) || !digest(v.fingerprint) || !digest(v.context)
            || !['idle', 'pending', 'confirmed', 'error'].includes(v.phase) || typeof v.pending !== 'boolean' || typeof v.canCheck !== 'boolean'
            || typeof v.message !== 'string' || typeof v.z2mVersion !== 'string' || typeof v.lastError !== 'string' || !(v.requestedAt === null || integer(v.requestedAt))
            || !Array.isArray(result.systems) || result.systems.length > 8 || !result.systems.every(checkedRow)
            || new Set(result.systems.map(row => row.systemId)).size !== result.systems.length
            || (result.installation !== undefined && !checkedInstallation(result.installation, ctx))) {
            throw new MessageError("ui.the.diagnostics.reply.does.not.f97a0ebf");
        }
        return result;
    } finally { clearTimeout(timeout); }
}

export function recordingEnd(debug) {
    return debug.until === null ? t("ui.no.recording.end.time.1dd3b51d") : t("ui.ends.automatically.at.9ef5d571", {p1: new Date(debug.until * 1000).toLocaleString(locale())});
}

export function buildHint(build) {
    if (build?.comparison === 'different') return t("ui.update.available.the.installed.and.74c57439");
    if (build?.comparison === 'legacy') return t("ui.build.comparison.unavailable.the.installed.208e5336");
    return build?.fields?.ExtensionUpdateInfo ?? t("ui.request.extension.status.or.update.9085667c");
}

export function installDiagnostics({getData, isLoading = () => false, chooseSystem, message, reload = async () => {}}) {
    const button = document.createElement('button'); button.id = 'diagnostics-button'; bindText(button, () => t("ui.systems.and.diagnostics.798bdbd6"));
    document.querySelector('.toolbar').append(button);
    const dialog = document.createElement('dialog'); dialog.id = 'diagnostics-dialog'; dialog.className = 'creation-dialog diagnostics-dialog'; dialog.setAttribute('aria-labelledby', 'diagnostics-title');
    bindHTML(dialog, () => `<h2 id="diagnostics-title">${t("ui.systems.and.diagnostics.798bdbd6")}</h2>`
        + `<p>${t("ui.these.are.the.latest.data.34fa3e84")}</p>`
        + `<div class="diagnostics-table"><table><thead><tr><th>${t("ui.z2m.system.7a27be0b")}</th><th>${t("ui.mqtt.connection.01a550d9")}</th><th>${t("ui.zigbee2mqtt.7e778485")}</th><th>${t("ui.extension.build.18116670")}</th><th>${t("ui.recording.8de4880f")}</th></tr></thead><tbody></tbody></table></div>`
        + `<h3 class="diagnostics-system"></h3><dl class="diagnostics-facts"></dl>`
        + `<section class="diagnostics-build" aria-label="${t("ui.extension.builds.bb3b4656")}"><h3>${t("ui.extension.builds.bb3b4656")}</h3><p class="installed"></p><p class="bundled"></p><p class="comparison"></p><p class="field-help">${t("ui.after.separate.confirmation.the.bundled.c26048b4")}</p></section>`
        + `<div class="diagnostics-checks"><button type="button" data-diagnose="health">${t("ui.check.zigbee2mqtt.connection.88a475e4")}</button><button type="button" data-diagnose="extension">${t("ui.request.extension.status.e67690a8")}</button></div>`
        + `<p class="diagnostics-probe" role="status" aria-live="polite"></p>`
        + `<section class="diagnostics-recording" aria-label="${t("ui.execution.recording.384a21bb")}"><h3>${t("ui.record.z2m.execution.ae7d0121")}</h3><p class="debug-location"></p>`
        + `<p class="debug-message" role="status" aria-live="polite"></p><p class="debug-end"></p>`
        + `<div class="diagnostics-checks"><label>${t("ui.duration.668cbe31")}<select class="diagnostics-duration"><option value="60">${t("ui.1.minute.493e482e")}</option><option value="300" selected>${t("ui.5.minutes.937f3f85")}</option><option value="600">${t("ui.10.minutes.499010dd")}</option><option value="900">${t("ui.15.minutes.4299b092")}</option></select></label>`
        + `<button type="button" data-diagnose="debug_start">${t("ui.start.recording.cca4ebf5")}</button><button type="button" data-diagnose="debug_stop">${t("ui.stop.own.recording.9d2524d7")}</button></div>`
        + `<p class="field-help">${t("ui.for.actions.between.two.z2m.5a9b7ae8")}</p></section>`
        + `<p class="diagnostics-message" role="status" aria-live="polite"></p><div class="dialog-actions"><button type="button" class="diagnostics-refresh">${t("ui.reload.diagnostics.b3a30494")}</button><button type="button" class="diagnostics-close">${t("ui.close.b808f6e9")}</button></div>`);
    document.body.append(dialog);
    const $ = selector => dialog.querySelector(selector);
    const text = (tag, value) => {const node = document.createElement(tag); bindText(node, () => value); return node;};
    let captured = null; let result = null; let busy = false; let timer = null; let error = ''; let windowEnd = 0; let installed = false;
    const current = data => data?.workspaceContext?.systemId === getData()?.workspaceContext?.systemId && data?.workspaceContext?.generation === getData()?.workspaceContext?.generation;
    const paintInstallation = installExtensionControl({container: $('.diagnostics-build'), getData: () => current(captured) ? captured : null, getResult: () => result,
        isBusy: () => busy || isLoading() || !!error || !current(captured),
        onResult: v => {if (result) result.installation = v; message(() => (v.message));}, onError: value => {error = value;},
        onBusy: value => {busy = value; if (value) clearTimeout(timer); paint(); schedule();}});
    function paint() {
        const v = result?.diagnostics;
        const rows = $('tbody'); rows.replaceChildren();
        for (const row of result?.systems ?? []) {
            const tr = document.createElement('tr'); tr.classList.toggle('is-selected', row.systemId === v?.systemId);
            const name = document.createElement('td'); const pick = text('button', () => (row.name)); pick.type = 'button'; pick.dataset.systemId = row.systemId; pick.disabled = busy || isLoading();
            pick.addEventListener('click', () => switchSystem(row.systemId)); name.append(pick, text('small', () => (row.baseTopic)));
            const connection = text('td', () => (row.mqttConnected ? 'MQTT verbunden' : t("ui.mqtt.disconnected.5775d914"))); connection.append(text('small', () => (t("ui.connection.mqtt.gateway.a014b0ce", {p1: row.connection, p2: row.mqttParent}))));
            const online = text('td', () => (row.online ? t("ui.online.0d21bd52") : t("ui.not.confirmed.online.fdfed1fc"))); online.append(text('small', () => (row.healthText)));
            const comparison = text('td', () => (({current: t("ui.up.to.date.f4d865ae"), different: t("ui.update.available.e45ea9fd"), legacy: t("ui.build.comparison.unavailable.02b29610"), missing: t("ui.check.module.files.1d3fc29a")})[row.build?.comparison] ?? t("ui.build.not.confirmed.yet.4366bcea")));
            const debug = text('td', () => (row.debug.active ? t("ui.running.f85fd2bc") : row.debug.pending ? t("ui.awaiting.confirmation.957159f9") : t("ui.off.f0ce9450")));
            if (row.debug.until !== null) debug.append(text('small', () => (recordingEnd(row.debug))));
            tr.append(name, connection, online, comparison, debug); rows.append(tr);
        }
        bindText($('.diagnostics-system'), () => v ? t("ui.diagnostics.a29610be", {p1: v.baseTopic}) : t("ui.loading.diagnostics.c33fa3d0"));
        const facts = $('.diagnostics-facts'); facts.replaceChildren();
        if (v) for (const [label, value] of [[t("ui.z2m.connection.a436dc57"), `${v.name} (#${v.connection})`], ['MQTT-Gateway', `#${v.mqttParent}`], [t("ui.zigbee2mqtt.version.a55b705a"), v.z2mVersion || t("ui.not.confirmed.yet.3a06df81")], [t("ui.health.check.67377124"), v.healthText], [t("ui.last.connection.error.ff0095ed"), v.lastError || t("ui.no.error.reported.1e145fd4")]]) facts.append(text('dt', label), text('dd', value));
        const fields = v?.build?.fields;
        bindText($('.installed'), () => fields?.InstalledExtensionInfo ?? t("ui.installed.extension.build.not.confirmed.53b7deb0"));
        bindText($('.bundled'), () => fields?.BundledExtensionInfo ?? t("ui.check.the.bundled.build.in.41c02256"));
        bindText($('.comparison'), () => buildHint(v?.build));
        $('.diagnostics-build').dataset.comparison = v?.build?.comparison ?? 'unconfirmed';
        bindText($('.diagnostics-probe'), () => v?.message ?? '');
        $('.diagnostics-probe').dataset.phase = v?.phase ?? 'idle';
        bindText($('.debug-location'), () => v ? t("ui.execution.messages.appear.in.the.d6003670", {p1: v.name, p2: v.connection}) : '');
        bindText($('.debug-message'), () => v?.debug?.message ?? '');
        bindText($('.debug-end'), () => v ? recordingEnd(v.debug) : '');
        bindText($('.diagnostics-message'), () => error || (busy ? t("ui.processing.diagnostics.request.4badf11d") : ''));
        dialog.setAttribute('aria-busy', String(busy));
        for (const action of ['health', 'extension', 'debug_start', 'debug_stop']) {
            const allowed = action === 'debug_start' ? v?.debug.canStart : action === 'debug_stop' ? v?.debug.canStop : v?.canCheck;
            $(`[data-diagnose="${action}"]`).disabled = busy || isLoading() || !current(captured) || !allowed || !!error;
        }
        $('.diagnostics-duration').disabled = busy || !!v?.debug.active || !!v?.debug.pending;
        $('.diagnostics-refresh').disabled = busy || isLoading();
        $('.diagnostics-close').disabled = busy;
        installed ||= result?.installation?.status === 'installed';
        paintInstallation();
    }
    function schedule() {
        clearTimeout(timer);
        const v = result?.diagnostics;
        if (dialog.open && !error && Date.now() < windowEnd && (v?.pending || v?.debug.active || v?.debug.pending || result?.installation?.pending)) timer = setTimeout(() => send(null), 1500);
    }
    async function send(action) {
        if (busy || isLoading() || !current(captured) || !dialog.open) return;
        const data = captured; const v = result?.diagnostics;
        if (action && !v) return;
        error = ''; busy = true; clearTimeout(timer); paint();
        try {
            const model = v ? {...data, workspaceContext: {...data.workspaceContext, fingerprint: v.fingerprint}} : data;
            const reply = await diagnosticsRequest(model, action ? {requestId: createUUID(), action, seconds: action === 'debug_start' ? Number($('.diagnostics-duration').value) : 0, context: v.context} : null, {token: location.hash.slice(1)});
            if (!dialog.open || !current(data)) return;
            result = reply;
            if (action) message(() => (action.startsWith('debug_') ? reply.diagnostics.debug.message : reply.diagnostics.message));
        } catch (failure) { if (dialog.open && current(data)) error = failure.message; }
        finally { busy = false; paint(); schedule(); }
    }
    async function open() {
        if (busy || isLoading() || !getData()?.diagnosticsAllowed || document.querySelector('dialog[open]')) return;
        captured = getData(); result = null; error = ''; installed = false; windowEnd = Date.now() + 920000; paint(); dialog.showModal(); await send(null);
    }
    async function switchSystem(id) {
        if (busy || isLoading() || id === captured?.workspaceContext?.systemId) return;
        dialog.close(); clearTimeout(timer);
        await chooseSystem(id);
        if (!document.querySelector('dialog[open]')) await open();
    }
    onLanguageChange(() => { if (dialog.open) paint(); });
    button.addEventListener('click', open);
    for (const action of ['health', 'extension', 'debug_start', 'debug_stop']) $(`[data-diagnose="${action}"]`).addEventListener('click', () => send(action));
    $('.diagnostics-refresh').addEventListener('click', () => send(null));
    $('.diagnostics-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('cancel', event => {if (busy) event.preventDefault();});
    dialog.addEventListener('close', () => {clearTimeout(timer); if (installed && !busy) {installed = false; void reload();}});
    return () => {
        button.hidden = !getData()?.workspace; button.disabled = busy || isLoading() || !getData()?.diagnosticsAllowed;
        if (dialog.open && !current(captured)) {clearTimeout(timer); result = null; error = t("ui.the.selected.system.has.changed.a39b9f1d"); paint();}
    };
}
