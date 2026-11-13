import {designerRequest as fetch, isDesktop} from './transport.js';
import {t, bindText, bindHTML, bindAttribute, localizedOption, localizeRecord, MessageError, ResponseError, locale, formatDate, formatNumber, onLanguageChange, installLanguagePicker, localizeResponse} from './localization.js';
import {createUUID} from './identity.js';
import {systemHeaders} from './workspace.js';

const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const topic = value => typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(value);
export function checkedPermissions(view, context) {
    return !!view && view.systemId === context?.systemId && view.generation === context?.generation && digest(view.fingerprint) && digest(view.context)
        && ['name', 'message', 'notice', 'blocked'].every(key => typeof view[key] === 'string') && topic(view.baseTopic) && typeof view.canEdit === 'boolean'
        && Array.isArray(view.peers) && view.peers.length <= 8 && view.peers.every(topic) && new Set(view.peers).size === view.peers.length
        && Array.isArray(view.choices) && view.choices.length <= 15 && view.choices.every(row => row && typeof row === 'object')
        && new Set(view.choices.map(row => row.topic)).size === view.choices.length
        && view.choices.every(row => topic(row.topic) && typeof row.systemId === 'string' && typeof row.name === 'string' && typeof row.assigned === 'boolean'
            && typeof row.selected === 'boolean' && row.selected === view.peers.includes(row.topic) && Number.isSafeInteger(row.affectedCount) && row.affectedCount >= 0 && row.affectedCount <= 100
            && Array.isArray(row.affected) && row.affected.length === Math.min(20, row.affectedCount)
            && row.affected.every(rule => rule && typeof rule.id === 'string' && typeof rule.name === 'string' && typeof rule.enabled === 'boolean'))
        && view.peers.every(peer => view.choices.some(row => row.topic === peer));
}

export function permissionChanges(view, selected) {
    if (!Array.isArray(selected) || selected.length > 8 || new Set(selected).size !== selected.length || selected.some(peer => !view.choices.some(row => row.topic === peer))) {
        throw new MessageError("ui.select.at.most.eight.displayed.f5a13cb6");
    }
    return {added: view.choices.filter(row => selected.includes(row.topic) && !row.selected), removed: view.choices.filter(row => row.selected && !selected.includes(row.topic))};
}

export async function permissionsRequest(data, payload, {token, base = location.href, request = fetch} = {}) {
    const context = data?.workspaceContext;
    if (!context) throw new MessageError("ui.select.the.receiving.z2m.system.6bff0c29");
    const endpoint = new URL(payload ? 'permissions' : 'permissions-status', base); endpoint.hash = '';
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        let response; let result;
        try {
            response = await request(endpoint, {method: payload ? 'POST' : 'GET', headers: {'X-Z2MA-Read-Token': token, ...systemHeaders(data), ...(payload ? {'Content-Type': 'application/json'} : {})},
                ...(payload ? {body: JSON.stringify(payload)} : {}), credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal});
            const text = await response.text(); if (text.length > (payload ? 16384 : 262144)) throw Error('response_limit'); result = localizeResponse(JSON.parse(text));
        } catch { throw new MessageError("ui.no.clear.reply.was.received.d6dae662"); }
        if (!response.ok || !result?.ok) throw new ResponseError(result, () => t("ui.partner.permissions.could.not.be.2b201914"));
        if (payload ? result.permissionsSaved !== true || result.systemId !== context.systemId || result.generation !== context.generation || !digest(result.fingerprint)
            || typeof result.changed !== 'boolean' || !Number.isSafeInteger(result.peerCount) || result.peerCount < 0 || result.peerCount > 8 || typeof result.notice !== 'string'
            : !checkedPermissions(result.permissions, context)) throw new MessageError("ui.the.reply.does.not.match.9f9eb2a4");
        return payload ? result : result.permissions;
    } finally { clearTimeout(timeout); }
}

/** Receiver grants senders access; changing a grant never sends MQTT or alters a partner document. */
export function installPermissions({getData, reload, message, isLoading = () => false}) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'permissions-open'; bindText(button, () => t("ui.partner.permissions.38f831bd"));
    document.querySelector('.toolbar').append(button);
    const dialog = document.createElement('dialog'); dialog.id = 'permissions-dialog'; dialog.className = 'creation-dialog permissions-dialog';
    dialog.setAttribute('aria-labelledby', 'permissions-title');
    bindHTML(dialog, () => `<h2 id="permissions-title">${t("ui.partner.permissions.38f831bd")}</h2><p class="permissions-target"></p><p class="permissions-notice"></p>`
        + `<div class="permissions-edit"><p>${isDesktop() ? t('editor.deviceSystem.permissionsQuestion') : t("ui.which.systems.may.send.commands.d112b167")}</p><div class="permissions-choices"></div></div>`
        + `<section class="permissions-review" hidden><h3>${t("ui.apply.these.changes.b6d9f5cc")}</h3><div class="permissions-changes"></div></section>`
        + `<p class="permissions-feedback" role="status" aria-live="polite"></p><div class="dialog-actions"><button type="button" class="permissions-cancel">${t("ui.cancel.f7ff1178")}</button>`
        + `<button type="button" class="permissions-back" hidden>${t("ui.change.selection.14435c47")}</button><button type="button" class="permissions-check">${t("ui.review.changes.f539371f")}</button>`
        + `<button type="button" class="permissions-accept primary" hidden>${t("ui.apply.permissions.to.draft.988ac517")}</button></div>`);
    document.body.append(dialog);
    const $ = selector => dialog.querySelector(selector);
    let busy = false; let captured = null; let view = null; let pending = null;
    const current = data => data?.workspaceContext?.systemId === getData()?.workspaceContext?.systemId && data?.workspaceContext?.generation === getData()?.workspaceContext?.generation;
    const feedback = text => { bindText($('.permissions-feedback'), () => text); };
    function paint() {
        const data = getData(); button.hidden = !data?.workspace; button.disabled = busy || isLoading() || !data?.permissionsAllowed || !data?.workspaceContext;
        dialog.setAttribute('aria-busy', String(busy));
        for (const selector of ['.permissions-cancel', '.permissions-back', '.permissions-check', '.permissions-accept']) $(selector).disabled = busy;
        if (view && !view.canEdit) $('.permissions-check').disabled = true;
        dialog.querySelectorAll('input').forEach(input => { input.disabled = busy || !view?.canEdit; });
    }
    const paragraph = (parent, text) => { const item = document.createElement('p'); bindText(item, () => text); parent.append(item); };
    function stage(review) {
        $('.permissions-edit').hidden = review; $('.permissions-review').hidden = !review;
        $('.permissions-check').hidden = review; $('.permissions-back').hidden = !review; $('.permissions-accept').hidden = !review;
    }
    button.addEventListener('click', async () => {
        if (busy || isLoading() || !getData()?.permissionsAllowed || document.querySelector('dialog[open]')) return;
        captured = structuredClone(getData()); view = null; pending = null; busy = true; stage(false); feedback(() => (t("ui.reading.partner.permissions.1e7aa977")));
        bindText($('.permissions-target'), () => t("ui.receiving.system.3b367bca", {p1: captured.module?.name ?? '', p2: captured.module?.baseTopic ?? ''}));
        bindText($('.permissions-notice'), () => ''); $('.permissions-choices').replaceChildren(); dialog.showModal(); paint();
        try {
            const loaded = await permissionsRequest(captured, null, {token: location.hash.slice(1)});
            if (!current(captured)) { dialog.close(); return; }
            view = loaded; captured.workspaceContext.fingerprint = view.fingerprint;
            bindText($('.permissions-target'), () => t("ui.receiving.system.3b367bca", {p1: view.name, p2: view.baseTopic}));
            bindText($('.permissions-notice'), () => view.notice);
            for (const row of view.choices) {
                const label = document.createElement('label'); label.className = 'permissions-choice';
                const input = document.createElement('input'); input.type = 'checkbox'; input.value = row.topic; input.checked = row.selected;
                const caption = document.createElement('span'); bindText(caption, () => `${row.name} · ${row.topic} → ${view.name} · ${view.baseTopic}`);
                label.append(input, caption); $('.permissions-choices').append(label);
                if (!row.assigned) paragraph($('.permissions-choices'), () => (t("ui.this.previously.allowed.system.is.72f27cef")));
            }
            if (!view.choices.length) paragraph($('.permissions-choices'), () => (t("ui.no.other.system.assigned.yet.62aa9ee0")));
            feedback(() => (view.message));
        } catch (error) { feedback(() => (error.message)); } finally { busy = false; paint(); if (!view) $('.permissions-check').disabled = true; }
    });
    $('.permissions-check').addEventListener('click', () => {
        if (busy || !view?.canEdit || !current(captured)) return;
        try {
            const peers = [...dialog.querySelectorAll('input:checked')].map(input => input.value);
            const changes = permissionChanges(view, peers); const content = $('.permissions-changes'); content.replaceChildren();
            for (const row of changes.added) paragraph(content, () => (t("ui.new.permission.e8c09b47", {p1: row.name, p2: row.topic, p3: view.name, p4: view.baseTopic})));
            for (const row of changes.removed) {
                paragraph(content, () => (`Freigabe entziehen: ${row.name} · ${row.topic} → ${view.name} · ${view.baseTopic}`));
                paragraph(content, () => (row.assigned ? (row.affectedCount === 1 ? t("ui.1.local.automation.uses.this.52f68b96") : t("ui.local.automations.use.this.connection.812f035e", {p1: row.affectedCount}))
                    + t("ui.after.transferring.the.revocation.their.0b0d1318") : t("ui.unassigned.system.affected.automations.are.7d2b1ce3")));
                for (const rule of row.affected) paragraph(content, () => (t("ui.in.draft.3669fe1d", {p1: rule.name, p2: rule.enabled ? t("ui.enabled.aae668f6") : t("ui.disabled.1fa013fd")})));
                if (row.affectedCount > row.affected.length) {
                    const remaining = row.affectedCount - row.affected.length;
                    paragraph(content, () => (remaining === 1 ? t("ui.one.more.automation.is.affected.c86b9588") : t("ui.another.automations.are.affected.2f643224", {p1: remaining})));
                }
            }
            if (!changes.added.length && !changes.removed.length) paragraph(content, () => (t("ui.the.selection.is.unchanged.the.021fd1d2")));
            pending = {requestId: createUUID(), context: view.context, peers, confirmed: true}; stage(true); feedback(() => (t("ui.only.the.receiving.system.s.0f3bc990")));
        } catch (error) { feedback(() => (error.message)); }
    });
    $('.permissions-back').addEventListener('click', () => { if (!busy) { pending = null; stage(false); feedback(() => (view.message)); } });
    $('.permissions-cancel').addEventListener('click', () => { if (!busy) dialog.close(); });
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    $('.permissions-accept').addEventListener('click', async () => {
        if (busy || !pending || !current(captured)) return;
        busy = true; paint(); feedback(() => (t("ui.applying.partner.permissions.in.the.eded4f61")));
        try {
            const result = await permissionsRequest(captured, pending, {token: location.hash.slice(1)});
            if (!current(captured)) { dialog.close(); return; }
            pending = null; dialog.close(); message(() => (result.notice));
            if (!await reload()) message(() => (t("ui.choose.refresh.view.15583429", {p1: result.notice})));
            else message(() => (result.notice));
        } catch (error) { feedback(() => (error.message)); } finally { busy = false; paint(); }
    });
    return () => { if (dialog.open && captured && !current(captured)) dialog.close(); paint(); };
}
