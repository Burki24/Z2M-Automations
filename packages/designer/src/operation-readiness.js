import {t, bindText, language} from './localization.js';

/* These are observations, never permission to activate a receiver or dispatch a command. */
export function operationState(data, system) {
    if ((system.systemId ?? system.binding?.systemId) === data?.workspaceContext?.systemId && data.runtime) {
        return data.runtime.confirmed === true && !data.runtime.pending && typeof data.runtime.executing === 'boolean'
            ? data.runtime.executing ? 'active' : 'stopped' : 'unknown';
    }
    return system.runtimeConfirmed === true && typeof system.executing === 'boolean'
        ? system.executing ? 'active' : 'stopped' : 'unknown';
}

export function operationTargets(data, entries, configuration = data?.configuration) {
    const topics = new Map();
    const own = data?.workspace?.systems?.find(s => (s.systemId ?? s.binding?.systemId) === data?.workspaceContext?.systemId);
    const local = own?.binding?.baseTopic ?? data?.module?.baseTopic;
    for (const entry of entries ?? []) {
        const add = topic => {
            if (typeof topic !== 'string' || !topic || topic === local) return;
            if (!topics.has(topic)) topics.set(topic, new Set());
            topics.get(topic).add(entry.name);
        };
        for (const condition of entry.conditions ?? []) if (condition.type === 'device_value') add(condition.system);
        const actions = (items, seen = new Set()) => {
            for (const action of items ?? []) {
                if (action.type !== 'sequence') add(action.target?.system);
                else if (!seen.has(action.sequence_id)) {
                    const sequence = configuration?.sequences?.find(item => item.id === action.sequence_id);
                    actions(sequence?.actions, new Set([...seen, action.sequence_id]));
                }
            }
        };
        actions(entry.actions);
    }
    return [...topics].map(([topic, rules]) => {
        const matches = (data?.workspace?.systems ?? []).filter(system => system.binding?.baseTopic === topic);
        const system = matches.length === 1 ? matches[0] : null;
        return {topic, systemId: system?.systemId ?? system?.binding?.systemId ?? '', name: system?.name ?? topic,
            state: system ? operationState(data, system) : 'unknown', rules: [...rules]};
    });
}

export function activationRuleNames(runtime) {
    return Array.isArray(runtime?.releasedRules) ? runtime.releasedRules.map(rule => rule.name)
        : Object.values(runtime?.rules ?? {}).filter(rule => rule.enabled === true).map(rule => rule.name);
}

export function installOperationReadiness({getData, getEntry, chooseSystem, showOperation, isLoading = () => false}) {
    const node = (tag, parent, key, params = {}) => {
        const result = document.createElement(tag);
        if (key) bindText(result, () => t(key, params));
        parent?.append(result); return result;
    };
    const flow = node('section', document.querySelector('#canvas-scroll')); flow.className = 'operation-readiness'; flow.hidden = true;
    document.querySelector('#canvas-scroll').prepend(flow);
    const operation = node('section'); operation.className = 'desktop-card operation-preparation'; operation.hidden = true;
    let origin = null; let navigating = false;
    async function open(systemId) {
        if (navigating || isLoading() || document.querySelector('dialog[open]')) return;
        const data = getData(); const previous = origin;
        const system = data.workspace.systems.find(s => (s.systemId ?? s.binding?.systemId) === data.workspaceContext.systemId);
        if (!origin && systemId !== data.workspaceContext.systemId) origin = {id: data.workspaceContext.systemId, name: system?.name ?? data.module.baseTopic};
        navigating = true;
        try {
            if (await chooseSystem(systemId)) {
                if (origin?.id === systemId) origin = null;
                showOperation();
            } else origin = previous;
        } finally { navigating = false; update(); }
    }
    function rows(parent, targets) {
        const list = node('ul', parent); list.className = 'operation-networks'; list.tabIndex = 0;
        for (const target of targets) {
            const row = node('li', list); row.dataset.state = target.state;
            const text = node('div', row);
            node('strong', text).textContent = target.name === target.topic ? target.name : target.name + ' · ' + target.topic;
            node('p', text, 'operation.network.' + target.state);
            if (target.rules.length) { const names = node('p', text, 'operation.network.rules', {names: target.rules.join(', ')}); names.className = 'field-help'; }
            if (target.systemId) {
                const button = node('button', row, 'operation.network.open', {name: target.name}); button.type = 'button';
                button.dataset.operationSystem = target.systemId;
                button.disabled = navigating || isLoading();
                if (target.state !== 'active') button.className = 'primary';
                button.addEventListener('click', () => open(target.systemId));
            } else {
                node('p', text, 'operation.network.missing');
                const button = node('button', row, 'operation.network.assign'); button.type = 'button';
                button.addEventListener('click', () => document.querySelector('#desktop-nav-system')?.click());
            }
        }
    }
    function update() {
        const data = getData(); const enabled = Boolean(data?.workspaceContext?.systemId && (data?.guidedUI || data?.desktop?.project));
        const entry = getEntry();
        const targets = enabled && entry && entry.kind !== 'catalog' ? operationTargets(data, [entry]) : [];
        flow.hidden = !targets.length;
        const flowSignature = JSON.stringify([language(), targets, navigating, isLoading()]);
        if (flow.dataset.view !== flowSignature) {
            flow.dataset.view = flowSignature; flow.replaceChildren();
            if (targets.length) { node('h3', flow, 'operation.network.title'); node('p', flow, 'operation.network.help'); rows(flow, targets); }
        }
        const area = document.querySelector('#desktop-view-operation .desktop-step-body');
        if (area && operation.parentElement !== area) area.prepend(operation);
        operation.hidden = !enabled;
        if (!enabled) return;
        const configuration = data.desktop?.project ? data.operationConfiguration : Number.isSafeInteger(data.runtime?.ruleCount) ? data.configuration : null;
        const selected = document.querySelector('#mqtt-rule, .system-runtime select')?.value;
        const required = operationTargets(data, configuration?.automations?.filter(rule => rule.enabled || rule.id === selected), configuration);
        const receiverOnly = configuration && !configuration.automations?.some(rule => rule.enabled) && configuration.mesh_peers?.length > 0;
        const signature = JSON.stringify([language(), data.workspaceContext.systemId, required, receiverOnly, origin, navigating, isLoading()]);
        if (operation.dataset.view === signature) return;
        operation.dataset.view = signature; operation.replaceChildren();
        node('h2', operation, 'operation.prepare.title');
        const steps = node('ol', operation); steps.className = 'operation-start-steps';
        for (const key of receiverOnly ? ['receiver'] : ['rules', 'networks', 'start']) node('li', steps, 'operation.prepare.' + key);
        if (required.length) rows(operation, required);
        else if (configuration) node('p', operation, 'operation.prepare.local');
        if (origin && origin.id !== data.workspaceContext.systemId) {
            node('p', operation, 'operation.prepare.returnHelp', {name: origin.name});
            const back = node('button', operation, 'operation.prepare.return', {name: origin.name}); back.type = 'button';
            back.dataset.operationReturn = origin.id; back.disabled = navigating || isLoading();
            back.addEventListener('click', () => open(origin.id));
        }
    }
    document.addEventListener('change', event => { if (event.target.matches('#mqtt-rule, .system-runtime select')) update(); });
    return update;
}
