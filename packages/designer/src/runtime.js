import {designerRequest as fetch} from './transport.js';
import {t, bindText, bindHTML, bindAttribute, localizedOption, localizeRecord, MessageError, ResponseError, locale, formatDate, formatNumber, onLanguageChange, installLanguagePicker, localizeResponse} from './localization.js';
import {createUUID} from './identity.js';
import {systemHeaders} from './workspace.js';

/* Polling is read-only. Every MQTT request, including a fresh status, needs a click. */
export async function runtimeRequest(data, action, {token, rule = '', run = '', resume = true,
    request = fetch, base = location.href, requestId = createUUID()} = {}) {
    const ctx = data?.workspaceContext;
    if (!ctx || !data.runtime || !['poll', 'status', 'activate', 'deactivate', 'run_once', 'stop_rule'].includes(action)) throw new MessageError("ui.please.select.a.z2m.system.ec4dffcc");
    const endpoint = new URL(action === 'poll' ? 'runtime-status' : 'runtime', base); endpoint.hash = '';
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        let response; let result;
        try {
            response = await request(endpoint, {method: action === 'poll' ? 'GET' : 'POST',
                headers: {'X-Z2MA-Read-Token': token, ...systemHeaders(data), ...(action === 'poll' ? {} : {'Content-Type': 'application/json'})},
                ...(action === 'poll' ? {} : {body: JSON.stringify({action, context: data.runtime.context, requestId, rule, run, resume})}),
                credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal});
            result = localizeResponse(await response.json());
        } catch (error) {
            if (error.name === 'AbortError') throw error;
            throw new MessageError("ui.no.readable.reply.nothing.will.1cec30cf");
        }
        if (!response.ok || !result.ok) throw new ResponseError(result, () => t("ui.operating.request.not.confirmed.refresh.5f6bc90b"));
        const view = result.runtime;
        if (view?.systemId !== ctx.systemId || view?.generation !== ctx.generation || typeof view.context !== 'string'
            || typeof view.fingerprint !== 'string' || typeof view.message !== 'string' || typeof view.pending !== 'boolean'
            || typeof view.canActivate !== 'boolean' || typeof view.canStop !== 'boolean' || typeof view.canRefresh !== 'boolean'
            || !view.rules || typeof view.rules !== 'object' || Object.values(view.rules).some(r => !r || typeof r.name !== 'string'
                || typeof r.run !== 'string' || typeof r.message !== 'string' || typeof r.canRun !== 'boolean' || typeof r.canStop !== 'boolean')) {
            throw new MessageError("ui.the.reply.does.not.belong.a2b7d3c8");
        }
        return view;
    } finally { clearTimeout(timeout); }
}

export function installRuntime({getData, reload, isLoading = () => false, message, onStatus = () => {}}) {
    const element = (type, text = '') => { const node = document.createElement(type); bindText(node, () => text); return node; };
    const panel = element('section'); panel.className = 'system-transfer system-runtime'; panel.hidden = true;
    const heading = element('strong');
    const status = element('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const notice = element('p'); notice.className = 'field-help';
    const resumeLabel = element('label'); const resume = element('input'); resume.type = 'checkbox';
    resumeLabel.append(resume, element('span', ' Automatikbetrieb nach einem Z2M-Neustart wieder aufnehmen'));
    const actions = element('div'); actions.className = 'transfer-actions';
    const buttons = {};
    for (const [action, text] of [['activate', t("ui.activate.saved.automations.89243fd1")], ['deactivate', t("ui.stop.all.automations.of.this.baed310b")], ['status', t("ui.refresh.z2m.operating.status.e313db3d")]]) {
        const button = element('button', text); button.type = 'button'; button.addEventListener('click', () => send(action)); buttons[action] = button; actions.append(button);
    }
    const selectionLabel = element('label', t("ui.select.a.saved.automation.b565d8b4")); const selection = element('select'); bindAttribute(selection, 'aria-label', () => t("ui.automation.for.single.run.or.e7f85af7"));
    selectionLabel.append(selection);
    const runStatus = element('p'); runStatus.setAttribute('role', 'status');
    const runActions = element('div'); runActions.className = 'transfer-actions';
    for (const [action, text] of [['run_once', t("ui.run.once.with.condition.checks.04b18ecd")], ['stop_rule', t("ui.stop.only.this.run.61c5770e")]]) {
        const button = element('button', text); button.type = 'button'; button.addEventListener('click', () => send(action)); buttons[action] = button; runActions.append(button);
    }
    const note = element('p', t("ui.single.run.checks.conditions.even.a8f08d10")); note.className = 'field-help';
    panel.append(heading, status, notice, resumeLabel, actions, selectionLabel, runStatus, runActions, note);
    document.querySelector('.system-selector').after(panel);
    const selections = new Map(); const preferences = new Map();
    let busy = false; let timer = null; let until = 0; let observed = '';
    const key = data => `${data?.workspaceContext?.systemId ?? ''}:${data?.workspaceContext?.generation ?? ''}`;
    const current = data => key(getData()) === key(data);
    selection.addEventListener('change', () => { selections.set(key(getData()), selection.value); paint(); });
    resume.addEventListener('change', () => preferences.set(key(getData()), resume.checked));
    function paint() {
        const data = getData(); const v = data?.runtime;
        panel.hidden = !data?.workspace || !v;
        if (panel.hidden) return;
        bindText(heading, () => t("ui.control.operation.1f1b8543", {p1: data.module.baseTopic}));
        const mode = !v.confirmed ? t("ui.operation.not.confirmed.yet.ad7a9926") : v.executing ? t("ui.automatic.operation.active.b3fb2e84") : t("ui.automatic.operation.stopped.c6ae748f");
        bindText(status, () => `${mode} ${v.message}`); bindText(notice, () => v.startNotice || '');
        resume.checked = preferences.get(key(data)) ?? v.resumeAfterRestart;
        resume.disabled = busy || isLoading();
        selection.replaceChildren();
        const placeholder = element('option', t("ui.select.automation.7886e3a5")); placeholder.value = ''; selection.append(placeholder);
        for (const [id, rule] of Object.entries(v.rules)) { const option = element('option', rule.name); option.value = id; selection.append(option); }
        const selected = selections.get(key(data)) ?? '';
        selection.value = Object.hasOwn(v.rules, selected) ? selected : '';
        const rule = v.rules[selection.value];
        selection.disabled = busy || isLoading();
        bindText(runStatus, () => rule?.message ?? t("ui.select.a.saved.automation.for.53527a68"));
        buttons.activate.disabled = busy || isLoading() || !v.canActivate;
        buttons.deactivate.disabled = busy || isLoading() || !v.canStop;
        buttons.status.disabled = busy || isLoading() || !v.canRefresh;
        buttons.run_once.disabled = busy || isLoading() || !rule?.canRun;
        buttons.stop_rule.disabled = busy || isLoading() || !rule?.canStop;
    }
    function schedule() {
        clearTimeout(timer); const v = getData()?.runtime;
        if (v && (v.pending || Object.values(v.rules).some(r => r.state === 'running')) && Date.now() < until) timer = setTimeout(() => send('poll', true), 1500);
    }
    async function send(action, automatic = false) {
        if (busy || isLoading()) { if (automatic) schedule(); return; }
        const data = getData(); const v = data?.runtime; if (!v) return;
        const ruleId = selections.get(key(data)) ?? ''; const rule = v.rules[ruleId];
        if (action !== 'poll' && document.querySelector('dialog[open]')) { message(() => (t("ui.apply.or.close.the.open.fc12a342"))); return; }
        if (action === 'activate' && !v.canActivate || action === 'deactivate' && !v.canStop || action === 'status' && !v.canRefresh
            || action === 'run_once' && !rule?.canRun || action === 'stop_rule' && !rule?.canStop) return;
        const target = `„${data.module.baseTopic}“`;
        const prompt = action === 'activate' ? t("ui.activate.saved.automations.in.this.d652dc69", {p1: target})
            : action === 'deactivate' ? t("ui.stop.all.automations.in.commands.da488c5b", {p1: target})
                : action === 'run_once' ? t("ui.run.in.once.with.condition.e5366532", {p1: rule.name, p2: target}) : '';
        if (prompt && !confirm(prompt)) return;
        const choice = preferences.get(key(data)) ?? v.resumeAfterRestart;
        busy = true; clearTimeout(timer); paint(); if (!automatic) until = Date.now() + 120000;
        try {
            const view = await runtimeRequest(data, action, {token: location.hash.slice(1),
                rule: ['run_once', 'stop_rule'].includes(action) ? ruleId : '', run: action === 'stop_rule' ? rule.run : '', resume: choice});
            if (!current(data)) return;
            if (getData() !== data || view.fingerprint !== data.workspaceContext.fingerprint) { await reload(); return; }
            data.runtime = view;
            data.status = {...data.status, confirmed: view.confirmed, executing: view.executing, activeRevision: view.activeRevision, storedRevision: view.storedRevision};
            onStatus(data.status);
        } catch (error) {
            if (current(data)) message(() => (error.name === 'AbortError' ? t("ui.still.awaiting.confirmation.nothing.will.0bd206ce") : error.message));
        } finally { busy = false; paint(); schedule(); }
    }
    return () => {
        const data = getData(); const next = `${key(data)}:${data?.runtime?.operation ?? ''}`;
        if (next !== observed) { observed = next; until = Date.now() + 120000; }
        paint(); schedule();
    };
}
