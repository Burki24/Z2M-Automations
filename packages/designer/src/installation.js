import {designerRequest as fetch} from './transport.js';
import {t, bindText, bindHTML, bindAttribute, localizedOption, localizeRecord, MessageError, ResponseError, locale, formatDate, formatNumber, onLanguageChange, installLanguagePicker, localizeResponse} from './localization.js';
import {createUUID} from './identity.js';
import {systemHeaders} from './workspace.js';

const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const releaseVersion = value => typeof value === 'string' && /^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})(?![\s\S])/.test(value);
export function extensionReleaseText(version, build) {
    return version === null ? (build === null ? t("ui.not.confirmed.yet.3a06df81") : `Build ${build}`)
        : build === null ? version : `${version} (Build ${build})`;
}
export function checkedInstallation(v, ctx) {
    return v?.systemId === ctx?.systemId && v?.generation === ctx?.generation && digest(v.fingerprint) && digest(v.context)
        && ['idle', 'checking', 'prepared', 'pending', 'refreshing', 'installed', 'error', 'interrupted'].includes(v.status)
        && ['pending', 'canInstall', 'mayHaveUploaded'].every(key => typeof v[key] === 'boolean')
        && ['message', 'blocked', 'runtimeMessage', 'notice'].every(key => typeof v[key] === 'string')
        && [v.bundledBuild, v.installedBuild].every(value => value === null || digest(value))
        && [v.bundledVersion, v.installedVersion].every(value => value === null || releaseVersion(value))
        && (v.executing === null || typeof v.executing === 'boolean')
        && (['none', 'waiting', 'loading', 'loaded', 'error', 'interrupted'].includes(v.devices?.phase)
            && typeof v.devices.pending === 'boolean' && typeof v.devices.message === 'string'
            && v.devices.pending === ['waiting', 'loading'].includes(v.devices.phase) && (v.status === 'refreshing') === v.devices.pending
            && ['devices', 'groups', 'scenes'].every(key => Number.isSafeInteger(v.devices.counts?.[key]) && v.devices.counts[key] >= 0));
}

export async function installationRequest(data, payload, {token, base = location.href, request = fetch} = {}) {
    const ctx = data?.workspaceContext;
    if (!ctx) throw new MessageError("ui.please.select.a.z2m.system.ec4dffcc");
    const endpoint = new URL(payload ? 'installation' : 'installation-status', base); endpoint.hash = '';
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        let response; let result;
        try {
            response = await request(endpoint, {method: payload ? 'POST' : 'GET', headers: {'X-Z2MA-Read-Token': token, ...systemHeaders(data), ...(payload ? {'Content-Type': 'application/json'} : {})},
                ...(payload ? {body: JSON.stringify(payload)} : {}), credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal});
            const text = await response.text(); if (text.length > 16384) throw Error('response_limit'); result = localizeResponse(JSON.parse(text));
        } catch { throw new MessageError("ui.no.clear.installation.reply.was.810309d3"); }
        if (!response.ok || !result.ok) throw new ResponseError(result, () => t("ui.installation.is.unavailable.reload.diagnostics.4536e0ec"));
        if (!checkedInstallation(result.installation, ctx)) throw new MessageError("ui.the.installation.reply.does.not.a73447e4");
        return result;
    } finally { clearTimeout(timeout); }
}

/** A separate, explicit consent pins the displayed system and artifact context. */
export function installExtensionControl({container, getData, getResult, isBusy, onResult, onError, onBusy}) {
    const action = document.createElement('button'); action.type = 'button'; action.className = 'installation-start';
    bindText(action, () => t("ui.install.or.update.bundled.extension.fdd97909"));
    const status = document.createElement('p'); status.className = 'installation-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const runtime = document.createElement('p'); runtime.className = 'installation-runtime';
    const devices = document.createElement('p'); devices.className = 'installation-devices'; devices.setAttribute('role', 'status'); devices.setAttribute('aria-live', 'polite');
    container.append(status, devices, runtime, action);
    const dialog = document.createElement('dialog'); dialog.className = 'creation-dialog installation-confirm'; dialog.id = 'installation-confirm';
    dialog.setAttribute('aria-labelledby', 'installation-title');
    bindHTML(dialog, () => `<h2 id="installation-title">${t("ui.install.or.update.extension.6ab5d647")}</h2><p class="installation-target"></p><dl class="installation-builds"></dl><p class="installation-notice"></p>`
        + `<p>${t("ui.confirmation.applies.only.to.this.db923876")}</p><div class="dialog-actions"><button type="button" class="installation-cancel">${t("ui.cancel.f7ff1178")}</button><button type="button" class="installation-accept primary">${t("ui.confirm.installation.c5b14e6b")}</button></div>`);
    document.body.append(dialog);
    let captured = null; let submitting = false;
    const $ = selector => dialog.querySelector(selector);
    const current = snapshot => snapshot?.workspaceContext?.systemId === getData()?.workspaceContext?.systemId && snapshot?.workspaceContext?.generation === getData()?.workspaceContext?.generation;
    function paint() {
        const v = getResult()?.installation;
        action.hidden = !getData()?.installationAllowed;
        action.disabled = isBusy() || !v?.canInstall || !current(getData());
        bindText(status, () => v?.message ?? t("ui.installation.status.is.not.available.4c9733f1"));
        status.dataset.phase = v?.status ?? 'idle'; bindText(runtime, () => v?.runtimeMessage ?? '');
        bindText(devices, () => v?.devices?.message ?? ''); devices.dataset.phase = v?.devices?.phase ?? 'none';
        if (v?.devices?.phase === 'loaded') devices.textContent += t("ui.devices.groups.scenes.a9bda78c", {p1: v.devices.counts.devices, p2: v.devices.counts.groups, p3: v.devices.counts.scenes});
    }
    action.addEventListener('click', () => {
        const result = getResult(); const v = result?.installation; const data = getData();
        if (isBusy() || !data?.installationAllowed || !v?.canInstall || !checkedInstallation(v, data.workspaceContext)) return;
        captured = {data: {...data, workspaceContext: {...data.workspaceContext, fingerprint: v.fingerprint}}, context: v.context, requestId: createUUID()};
        const row = result.diagnostics;
        bindText($('.installation-target'), () => t("ui.base.topic.z2m.connection.mqtt.9e533542", {p1: row.name, p2: row.baseTopic, p3: row.connection, p4: row.mqttParent}));
        const builds = $('.installation-builds'); builds.replaceChildren();
        for (const [label, value] of [[t("ui.installed.build.8f543ac4"), extensionReleaseText(v.installedVersion, v.installedBuild)], [t("ui.bundled.build.74eb47b1"), extensionReleaseText(v.bundledVersion, v.bundledBuild)]]) {
            const term = document.createElement('dt'); bindText(term, () => label); const description = document.createElement('dd'); bindText(description, () => value ?? t("ui.not.confirmed.yet.3a06df81")); builds.append(term, description);
        }
        bindText($('.installation-notice'), () => v.notice);
        $('.installation-accept').disabled = false; dialog.showModal();
    });
    $('.installation-cancel').addEventListener('click', () => dialog.close());
    $('.installation-accept').addEventListener('click', async () => {
        const intent = captured;
        if (submitting || !intent || !current(intent.data)) return;
        submitting = true; $('.installation-accept').disabled = true; onBusy(true); dialog.close();
        try {
            const result = await installationRequest(intent.data, {requestId: intent.requestId, context: intent.context, confirmed: true}, {token: location.hash.slice(1)});
            if (current(intent.data)) onResult(result.installation);
        } catch (error) { if (current(intent.data)) onError(error.message); }
        finally {submitting = false; captured = null; onBusy(false); paint();}
    });
    dialog.addEventListener('close', () => {if (!submitting) captured = null;});
    return paint;
}
