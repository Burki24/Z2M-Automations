import {t, bindText, bindHTML, bindAttribute, localizedOption, localizeRecord, MessageError, ResponseError, locale, formatDate, formatNumber, onLanguageChange, installLanguagePicker, localizeResponse} from './localization.js';
/* Refresh the same scoped capability; never reload editors or retry their writes. */
export function installAccessRenewal(environment = window) {
    const {document, location} = environment;
    const token = location.hash.slice(1);
    if (!/^[a-f0-9]{64}$/.test(token)) return;
    const endpoint = new URL('access-renew', location.href); endpoint.hash = '';
    const panel = document.createElement('aside'); panel.className = 'designer-access';
    const label = document.createElement('span'); label.setAttribute('role', 'status');
    bindText(label, () => t("ui.designer.access.is.renewed.automatically.4604c169"));
    const button = document.createElement('button'); button.type = 'button'; bindText(button, () => t("ui.extend.access.c4f1b9a7"));
    panel.append(label, button); document.body.append(panel);
    let busy = false; let stopped = false;
    async function renew() {
        if (stopped) return false;
        if (busy) return null;
        busy = true; button.disabled = true;
        try {
            const response = await environment.fetch(endpoint, {method: 'POST', cache: 'no-store', credentials: 'same-origin', redirect: 'error',
                headers: {'Content-Type': 'application/json', 'X-Z2MA-Read-Token': token}, body: '{}', signal: AbortSignal.timeout(10000)});
            if (!response.ok) {
                if (response.status === 403) stopped = true;
                throw new Error();
            }
            const result = localizeResponse(await response.json());
            if (result.ok !== true || !Number.isInteger(result.expires)) throw new Error();
            bindText(label, () => t("ui.designer.access.extended.until.f9c6fab5") + new Date(result.expires * 1000).toLocaleTimeString(locale()) + t("ui.unsaved.input.has.been.preserved.7eb1dc2b"));
            panel.dataset.tone = 'ok';
            return true;
        } catch {
            bindText(label, () => stopped ? t("ui.designer.access.has.expired.unsaved.4a300f04")
                : t("ui.access.could.not.be.extended.0c3615f3"));
            panel.dataset.tone = 'error';
            return false;
        } finally { busy = false; button.disabled = stopped; }
    }
    button.addEventListener('click', renew);
    const timer = environment.setInterval(() => { if (!document.hidden) void renew(); }, 240000);
    const visible = () => { if (!document.hidden) void renew(); };
    document.addEventListener('visibilitychange', visible);
    environment.addEventListener('pagehide', event => { if (event.persisted) return; stopped = true; environment.clearInterval(timer); document.removeEventListener('visibilitychange', visible); });
    return {renew};
}
