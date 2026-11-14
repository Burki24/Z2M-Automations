import {installGuidedWorkspace} from './guided-workspace.js';
import {t, bindText, locale, localizeResponse, MessageError, ResponseError} from './localization.js';
import {designerRequest as request} from './transport.js';
import {createUUID} from './identity.js';
import {validationSummary} from './validation-feedback.js';
import {systemHeaders} from './workspace.js';

export async function setLocalRuleEnabled(data, ruleId, enabled, {token, request: send = request, base = location.href} = {}) {
    if (!data?.editAllowed || !data.configuration?.automations?.some(rule => rule.id === ruleId) || typeof enabled !== 'boolean') throw new MessageError('symcon.request.failed');
    const endpoint = new URL('edit', base); endpoint.hash = '';
    try {
        const response = await send(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Z2MA-Read-Token': token, ...systemHeaders(data)},
            body: JSON.stringify({requestId: createUUID(), context: data.createContext, ruleId, changes: {enabled}}),
            credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000)});
        const text = await response.text();
        if (text.length > 4096) throw new Error('response_limit');
        const value = localizeResponse(JSON.parse(text));
        if (!response.ok || value.ruleId !== ruleId) throw new MessageError('symcon.request.failed');
        return value;
    } catch { throw new MessageError('symcon.request.failed'); }
}

export async function workspaceSetupRequest(action, {token, body, request: send = request, base = location.href} = {}) {
    if (!['status', 'configure'].includes(action)) throw new MessageError('symcon.request.failed');
    const endpoint = new URL(action === 'status' ? 'workspace-status' : 'workspace-configure', base); endpoint.hash = '';
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        let response; let value;
        try {
            response = await send(endpoint, {method: action === 'status' ? 'GET' : 'POST',
                headers: {'X-Z2MA-Read-Token': token, ...(action === 'status' ? {} : {'Content-Type': 'application/json'})},
                ...(action === 'status' ? {} : {body: JSON.stringify(body)}), cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: controller.signal});
            const text = await response.text();
            if (text.length > 262144) throw new Error('response_limit');
            value = localizeResponse(JSON.parse(text));
        } catch { throw new MessageError('symcon.request.failed'); }
        if (!response.ok || !value.ok) throw new ResponseError(value, () => t('symcon.request.failed'));
        if (!/^[a-f0-9]{64}$/.test(value.fingerprint) || !/^[a-f0-9]{64}$/.test(value.candidates)
            || !Array.isArray(value.choices) || value.choices.length > 256
            || value.choices.some(row => !Number.isSafeInteger(row.Connection) || row.Connection <= 0
                || typeof row.Use !== 'boolean' || typeof row.editable !== 'boolean'
                || !['Name', 'MQTT', 'Topic', 'Status'].every(key => typeof row[key] === 'string'))) throw new MessageError('symcon.request.failed');
        return value;
    } finally { clearTimeout(timeout); }
}

/* Symcon supplies authority and persistence; the shared shell owns presentation. */
export function installSymconWorkspace({getData, reload = async () => false, onStepChange = () => {}}) {
    let shell = null;
    let nodes;
    let initial = true;
    let flagBusy = false;
    const node = (tag, parent, key) => {
        const element = document.createElement(tag);
        if (key) bindText(element, () => t(key));
        parent.append(element); return element;
    };
    const card = parent => { const element = node('section', parent); element.className = 'desktop-card'; return element; };
    function updateCatalogShortcut() {
        if (!nodes) return;
        const data = getData();
        nodes.catalogShortcut.hidden = data?.catalogAvailable !== false || !data.catalogRefresh || !data.workspaceContext?.systemId
            || document.querySelector('#desktop-view-connection')?.hidden === false;
    }
    function mount() {
        document.body.classList.add('symcon-foundation');
        shell = installGuidedWorkspace({prefix: 'symcon', partnerActions: '#symcon-partner-actions', onStepChange: () => {
            updateCatalogShortcut();
            onStepChange();
        }});
        const storedStatus = node('span', shell.context); storedStatus.className = 'status-chip'; storedStatus.id = 'symcon-stored-status';
        const runtimeStatus = node('span', shell.context); runtimeStatus.className = 'status-chip'; runtimeStatus.id = 'symcon-runtime-status';
        const centre = card(shell.pages.project);
        node('p', centre, 'symcon.centre.help');
        const centreName = node('strong', centre);
        shell.link(centre, 'broker');
        const brokers = card(shell.pages.broker);
        node('p', brokers, 'symcon.brokers.help');
        const brokerList = node('ul', brokers);
        shell.link(brokers, 'system');
        const systems = card(shell.pages.system);
        node('p', systems, 'symcon.systems.help');
        const systemList = node('ul', systems);
        const permissions = node('div', systems); permissions.id = 'symcon-partner-actions';
        shell.link(systems, 'connection');
        const catalogue = document.querySelector('.system-catalog');
        if (catalogue) {
            catalogue.querySelector('.catalog-actions > button')?.classList.add('primary');
            shell.pages.connection.append(catalogue);
        }
        const installation = document.querySelector('.system-installation');
        if (installation) shell.pages.connection.append(installation);
        const inventory = card(shell.pages.connection);
        const inventoryStatus = node('p', inventory);
        node('h2', inventory, 'symcon.catalog.devices');
        const devices = node('ul', inventory); devices.className = 'guided-inventory'; devices.tabIndex = 0;
        node('h2', inventory, 'symcon.catalog.groups');
        const groups = node('ul', inventory); groups.className = 'guided-inventory'; groups.tabIndex = 0;
        shell.link(inventory, 'draft');
        const draft = card(shell.pages.draft);
        node('p', draft, 'symcon.draft.help');
        const draftStatus = node('p', draft);
        shell.link(draft, 'automations');
        const download = node('button', draft, 'symcon.draft.export'); download.type = 'button'; download.id = 'symcon-export-draft';
        download.addEventListener('click', () => {
            const configuration = getData()?.configuration;
            if (!configuration) return;
            const url = URL.createObjectURL(new Blob([JSON.stringify(configuration, null, 2) + '\n'], {type: 'application/yaml'}));
            const link = document.createElement('a'); link.href = url; link.download = 'automations.yaml';
            draft.append(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
        const reviewStatus = node('p', shell.review); reviewStatus.setAttribute('role', 'status');
        const reviewDetails = node('p', shell.review); reviewDetails.className = 'transfer-details';
        const findings = node('ul', shell.review); findings.className = 'desktop-findings';
        const validate = document.querySelector('[data-transfer-action="validate"]');
        if (validate) { bindText(validate, () => t('symcon.review.check')); shell.review.append(validate); }
        shell.link(shell.review, 'automations'); shell.link(shell.review, 'transfer');
        const transfer = document.querySelector('.system-transfer:not(.system-runtime)');
        if (transfer) shell.pages.transfer.append(transfer);
        shell.link(shell.pages.transfer, 'operation');
        const runtime = document.querySelector('.system-runtime');
        if (runtime) shell.pages.operation.append(runtime);
        const releases = card(shell.pages.operation);
        node('h2', releases, 'symcon.releases.title');
        const releasedCount = node('p', releases); releasedCount.id = 'symcon-released-count';
        node('p', releases, 'symcon.releases.help');
        const ruleSwitches = node('div', releases); ruleSwitches.className = 'guided-inventory'; ruleSwitches.id = 'symcon-rule-switches';
        const releaseFeedback = node('p', releases); releaseFeedback.setAttribute('role', 'status');
        shell.link(releases, 'review'); shell.link(releases, 'transfer');
        for (const selector of ['.system-diagnostics', '.system-diagnostics-panel']) {
            const panel = document.querySelector(selector); if (panel) shell.pages.operation.append(panel);
        }
        nodes = {centreName, brokerList, systemList, inventoryStatus, devices, groups, draftStatus, download, reviewStatus, reviewDetails, findings, storedStatus, runtimeStatus, releasedCount, ruleSwitches, releaseFeedback};
        shell.mountDesigner();
        // Request failures must remain visible in setup, review and operation too.
        const statusFeedback = document.querySelector('.designer-feedback');
        shell.context.after(statusFeedback);
        const issues = document.querySelector('#issues');
        statusFeedback.after(issues);
        const catalogShortcut = shell.link(issues, 'connection', 'symcon.catalog.openRefresh');
        catalogShortcut.id = 'symcon-open-device-refresh'; catalogShortcut.className = 'primary'; catalogShortcut.hidden = true;
        catalogShortcut.setAttribute('aria-describedby', 'issues-message');
        nodes.catalogShortcut = catalogShortcut;
        document.querySelector('#validate-button')?.addEventListener('click', () => shell.show('connection'));
        document.addEventListener('z2ma-workflow-next', event => shell.show(event.detail?.next === 'store' ? 'transfer' : event.detail?.next === 'review' ? 'review' : 'connection'));
        document.querySelector('.system-selector')?.addEventListener('change', () => shell.show('automations', false));
        // Setup actions remain bound to the module's existing checked workflow.
        const setup = card(shell.pages.system);
        const choices = node('div', setup); choices.id = 'symcon-system-choices';
        const apply = node('button', setup, 'symcon.systems.apply'); apply.type = 'button';
        const refresh = node('button', setup, 'ui.refresh.view.6540358c'); refresh.type = 'button';
        const feedback = node('p', setup); feedback.setAttribute('role', 'status');
        let setupView = null;
        const load = async () => {
            refresh.disabled = apply.disabled = true;
            try {
                const value = await workspaceSetupRequest('status', {token: location.hash.slice(1)});
                setupView = value;
                choices.replaceChildren(...value.choices.map(choice => {
                    const label = document.createElement('label'); label.className = 'guided-choice';
                    const input = document.createElement('input'); input.type = 'checkbox'; input.value = String(choice.Connection); input.checked = choice.Use; input.disabled = !choice.editable;
                    const text = document.createElement('span');
                    bindText(text, () => choice.Name + ' · ' + choice.MQTT + ' · ' + choice.Topic + ' · '
                        + t(choice.Use ? 'symcon.systems.assigned' : choice.editable ? 'symcon.systems.available' : 'symcon.systems.unavailable'));
                    label.append(input, text); return label;
                }));
                apply.disabled = false;
            } catch (error) { feedback.textContent = error.message; }
            finally { refresh.disabled = false; }
        };
        refresh.addEventListener('click', () => { if (!document.querySelector('dialog[open]')) void load(); });
        apply.addEventListener('click', async () => {
            if (!setupView || document.querySelector('dialog[open]')) return;
            apply.disabled = true;
            try {
                await workspaceSetupRequest('configure', {token: location.hash.slice(1), body: {requestId: createUUID(), fingerprint: setupView.fingerprint, candidates: setupView.candidates,
                    connections: [...choices.querySelectorAll('input:checked')].map(input => Number(input.value))}});
                feedback.textContent = t('symcon.systems.saved');
                await load(); await reload();
            } catch (error) { feedback.textContent = error.message; }
            finally { apply.disabled = false; }
        });
        void load();
    }
    const rows = (parent, values, text) => {
        const signature = JSON.stringify(values);
        if (parent.dataset.rows === signature) return;
        parent.dataset.rows = signature;
        parent.replaceChildren(...values.map(value => { const row = document.createElement('li'); row.textContent = text(value); return row; }));
    };
    return function update() {
        const data = getData();
        if (!data?.workspace) return;
        data.guidedUI = true;
        if (!shell) mount();
        updateCatalogShortcut();
        const systems = [...data.workspace.systems].sort((a, b) => new Intl.Collator(locale(), {numeric: true, sensitivity: 'base'}).compare(a.name, b.name));
        const brokers = [...new Set(systems.map(system => system.binding?.mqttParent))];
        shell.updateProject({active: true, project: {name: data.module.name, brokers: brokers.length ? brokers : [{}], systems}}, initial);
        shell.update({desktop: {project: true, source: 'draft', draftRevision: data.configuration?.revision ?? 0}, workspaceContext: data.workspaceContext, status: data.status ?? {mqttConnected: false}});
        nodes.centreName.textContent = data.module.name;
        rows(nodes.brokerList, brokers, id => t('symcon.brokers.connection', {id}));
        rows(nodes.systemList, systems, system => system.name + ' · ' + system.binding.baseTopic);
        const devices = [...data.devices ?? []].filter(device => !device.target.system)
            .sort((a, b) => new Intl.Collator(locale(), {numeric: true, sensitivity: 'base'}).compare(a.name, b.name));
        rows(nodes.devices, devices.filter(device => device.target.type !== 'group'), device => device.name);
        rows(nodes.groups, devices.filter(device => device.target.type === 'group'), device => device.name);
        bindText(nodes.inventoryStatus, () => t(data.catalogAvailable ? 'symcon.catalog.loaded' : 'symcon.catalog.missing', {count: devices.length}));
        bindText(nodes.draftStatus, () => t('symcon.draft.summary', {count: data.configuration?.automations?.length ?? 0, revision: data.configuration?.revision ?? 0}));
        nodes.download.disabled = !data.configuration;
        nodes.reviewStatus.textContent = data.transfer?.message ?? t('symcon.review.unavailable');
        nodes.reviewStatus.dataset.tone = data.transfer?.pending ? 'warning' : data.transfer?.canStore ? 'success' : data.transfer?.findings?.length ? 'error' : '';
        nodes.reviewDetails.textContent = data.transfer?.details ?? '';
        bindText(nodes.storedStatus, () => t(data.transfer?.receiverConfirmed ? 'workflow.stored' : 'workflow.lastRead', {revision: data.transfer?.storedRevision ?? 0}));
        bindText(nodes.runtimeStatus, () => t(!data.runtime?.confirmed ? 'ui.not.confirmed.d70bfbb5' : data.runtime.executing
            ? 'ui.automatic.operation.active.5be9b590' : 'ui.automatic.operation.stopped.46b63e37'));
        bindText(nodes.releasedCount, () => Number.isSafeInteger(data.runtime?.releasedCount) && Number.isSafeInteger(data.runtime?.ruleCount)
            ? t('symcon.releases.count', {count: data.runtime.releasedCount, total: data.runtime.ruleCount}) : t('symcon.releases.unknown'));
        const switchSignature = JSON.stringify([data.workspaceContext, data.createContext, data.editAllowed, data.configuration?.automations, flagBusy]);
        if (nodes.ruleSwitches.dataset.rows !== switchSignature) {
            nodes.ruleSwitches.dataset.rows = switchSignature;
            const rules = [...data.configuration?.automations ?? []].sort((a, b) => new Intl.Collator(locale(), {numeric: true, sensitivity: 'base'}).compare(a.name, b.name));
            nodes.ruleSwitches.replaceChildren(...rules.map(rule => {
                const label = document.createElement('label'); label.className = 'guided-choice';
                const input = document.createElement('input'); input.type = 'checkbox'; input.checked = rule.enabled; input.disabled = flagBusy || !data.editAllowed;
                input.dataset.ruleId = rule.id;
                const name = document.createElement('span'); name.textContent = rule.name; label.append(input, name);
                input.addEventListener('change', async () => {
                    if (flagBusy || document.querySelector('dialog[open]')) { input.checked = rule.enabled; return; }
                    const approved = JSON.stringify([data.workspaceContext, data.createContext]);
                    if (JSON.stringify([getData()?.workspaceContext, getData()?.createContext]) !== approved) { input.checked = rule.enabled; return; }
                    flagBusy = true;
                    for (const checkbox of nodes.ruleSwitches.querySelectorAll('input')) checkbox.disabled = true;
                    bindText(nodes.releaseFeedback, () => t('symcon.releases.saving'));
                    try {
                        await setLocalRuleEnabled(data, rule.id, input.checked, {token: location.hash.slice(1)});
                        if (getData()?.workspaceContext?.systemId !== data.workspaceContext.systemId) return;
                        if (!await reload()) throw new MessageError('symcon.releases.refresh');
                        bindText(nodes.releaseFeedback, () => t('symcon.releases.saved'));
                    } catch (error) { input.checked = rule.enabled; bindText(nodes.releaseFeedback, () => error.message); }
                    finally { flagBusy = false; nodes.ruleSwitches.dataset.rows = ''; update(); }
                });
                return label;
            }));
        }
        const findings = data.transfer?.findings ?? [];
        const signature = JSON.stringify([data.workspaceContext, data.configuration?.revision, findings]);
        if (nodes.findings.dataset.rows !== signature) {
            nodes.findings.dataset.rows = signature;
            nodes.findings.replaceChildren(...findings.map(issue => {
                const row = document.createElement('li');
                const parts = issue.path.split('/').slice(1); const [kind, index, ...path] = parts;
                const entry = data.configuration?.[kind]?.[Number(index)];
                const text = document.createElement('span'); text.textContent = [entry?.name, validationSummary({issues: [issue]})].filter(Boolean).join(' · '); row.append(text);
                if (entry && ['automations', 'sequences'].includes(kind)) {
                    const button = document.createElement('button'); bindText(button, () => t('desktop.review.correct'));
                    const revision = data.configuration.revision; const binding = JSON.stringify(data.workspaceContext); const owner = data.workspaceContext.systemId;
                    button.addEventListener('click', () => {
                        const current = getData();
                        if (JSON.stringify(current.workspaceContext) !== binding || current.configuration?.revision !== revision || !shell.show('automations')) return;
                        document.dispatchEvent(new CustomEvent('z2ma-open-draft-issue', {cancelable: true,
                            detail: {systemId: owner, revision, kind, id: entry.id, path, property: issue.capability?.property ?? path[3], message: () => validationSummary({issues: [issue]})}}));
                    });
                    row.append(button);
                }
                return row;
            }));
        }
        document.body.classList.toggle('desktop-no-entry', !data.configuration?.automations?.length && !data.configuration?.sequences?.length);
        initial = false;
    };
}
