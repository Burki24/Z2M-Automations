import {designerRequest as fetch, isDesktop} from './transport.js';
import {t, bindText, bindHTML, bindAttribute, localizedOption, localizeRecord, MessageError, ResponseError, locale, formatDate, formatNumber, onLanguageChange, installLanguagePicker, localizeResponse, sortByName} from './localization.js';
/* Own scoped module view. Creation is a separate, local-draft-only POST. */
import {installEditing} from './editor.js';
import {installEventImport} from './imports.js';
import {installDiagnostics} from './diagnostics.js';
import {installPermissions} from './permissions.js';
import {installSystemSelection, loadSystemDevices} from './workspace.js';
import {installTransfers} from './transfer.js';
import {installRuntime} from './runtime.js';
import {installCatalogRefresh} from './catalog.js';
import {installManagement, matchesRuleState} from './management.js';
import {installLayout} from './layout.js';
import {installAccessRenewal} from './access.js';
import {installNativeEmbedding} from './embedding.js';
(() => {
    'use strict';
    const access = isDesktop() ? null : installAccessRenewal();
    const $ = selector => document.querySelector(selector);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
    const icon = name => `<svg aria-hidden="true"><use href="#icon-${name}"/></svg>`;
    const compare = localizeRecord(() => ({eq: t("ui.is.equal.to.456b1261"), ne: t("ui.is.not.equal.to.c72da4b0"), gt: t("ui.is.greater.than.c23edfd9"), gte: t("ui.is.at.least.8adebfa3"), lt: t("ui.is.less.than.f2641c8f"), lte: t("ui.is.at.most.53bbaac0")}));
    const areas = localizeRecord(() => ({device: [t("ui.device.triggered.082d7271"), 'device'], time: [t("ui.time.solar.63529d1e"), 'clock'], sequence: [t("ui.action.sequences.9d9eee7e"), 'flow'], catalog: [t("ui.devices.channels.8c7ad6a2"), 'search']}));
    const days = values => (values ?? []).map(day => [t("ui.mon.d23e867e"), t("ui.tue.16ab7287"), t("ui.wed.d8f33a13"), t("ui.thu.30094e0b"), t("ui.fri.eed8f901"), t("ui.sat.a951efc7"), t("ui.sun.fb1df1a2")][day - 1] ?? '?').join(', ');
    const values = localizeRecord(() => (new Map([['ON', t("ui.on.b9a637bc")], ['OFF', t("ui.off.f0ce9450")], ['TOGGLE', t("ui.toggle.77fec02e")]])));
    const valueText = value => typeof value === 'boolean' ? (value ? t("ui.yes.detected.f51e55b6") : t("ui.no.not.detected.2e04e05d")) : (values.get(value) ?? (typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')));
    let data = null;
    let category = 'device';
    let selected = null;
    let selectedPart = null;
    let busy = false;
    let projectReloadPending = false;
    let editing = null;
    let systemId = '';
    let stateFilter = 'all';
    let management = null;
    let eventImport = null;
    let updateLayout = () => {};
    const systemViews = new Map();
    const token = location.hash.slice(1);
    const embedding = installNativeEmbedding({renew: () => access?.renew()});
    const endpoint = new URL('data', location.href);
    endpoint.hash = '';

    document.body.classList.add('module-designer');
    installLanguagePicker({report: async event => {
        const endpoint = new URL('language', location.href); endpoint.hash = '';
        const response = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Z2MA-Read-Token': token},
            body: JSON.stringify(event), credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000)});
        if (!response.ok) throw new Error('Language audit unavailable.');
    }});
    bindAttribute($('.toolbar'), 'aria-label', () => t("ui.module.view.and.new.automation.318f4386"));
    bindText($('.preview-label'), () => t("ui.draft.90845583"));
    bindText($('.preview-notice strong'), () => t("ui.automations.in.local.draft.a90839b2"));
    bindText($('.preview-notice > span:last-child'), () => t("ui.edit.automations.and.action.sequences.54d7f355"));
    bindHTML($('#validate-button'), () => icon('check') + t("ui.refresh.view.6540358c"));
    $('#validate-button').removeAttribute('data-action');
    ['#save-button', '#activate-button', '#stop-button', '.toolbar-divider', '.navigation-footer', '.activity', '#new-dialog', '#confirm-dialog'].forEach(selector => $(selector).remove());
    document.querySelectorAll('.entry-tools [data-action]:not([data-action="select-rule"])').forEach(button => button.remove());
    const detailsButton = $('[data-action="select-rule"]');
    bindAttribute(detailsButton, 'aria-label', () => t("ui.show.details.of.the.selected.184b3936"));
    detailsButton.title = t("ui.rule.details.6fddd9e0");
    bindText($('#selection-hint'), () => t("ui.click.a.block.view.details.0734abf7"));
    bindText($('.canvas-footer > span:last-child'), () => t("ui.edit.automations.and.action.sequences.2b7902b6"));
    bindText($('#draft-status'), () => t("ui.loading.module.data.7d76c819"));
    bindText($('#runtime-status'), () => t("ui.operation.not.read.yet.8f184d91"));
    bindHTML($('#flow'), () => '');
    bindText($('#entry-title'), () => t("ui.automation.designer.c22fc391"));
    bindText($('#entry-subtitle'), () => t("ui.connection.to.the.selected.module.cf5e3972"));
    bindText($('#inspector-fields'), () => t("ui.details.of.the.selected.block.e9029868"));

    function entries() {
        const rules = (data?.configuration?.automations ?? []).map(rule => ({...rule, kind: rule.triggers?.some(trigger => trigger.type === 'device') ? 'device' : 'time'}));
        const sequences = (data?.configuration?.sequences ?? []).map(sequence => ({...sequence, kind: 'sequence'}));
        return [...rules, ...sequences];
    }

    const entryKey = entry => `${entry.kind === 'sequence' ? 'sequence' : 'rule'}:${entry.id}`;
    function sortedDevices() {
        return sortByName(data?.devices ?? []);
    }
    const current = () => category === 'catalog' ? data?.devices.find(device => device.key === selected) : entries().find(entry => entryKey(entry) === selected);
    const targetDevice = target => data?.devices.find(device => device.target.type === target?.type && device.target.id === target?.id
        && (device.target.system ?? '') === (target?.system ?? ''));
    const sourceDevice = id => data?.devices.find(device => device.target.type === 'device' && device.target.id === id && !device.target.system);
    const targetName = target => targetDevice(target)?.name ?? t("ui.device.data.missing.25af8c67", {p1: target?.system ? target.system + ' · ' : '', p2: target?.type === 'group' ? t("ui.group.375adc53") : t("ui.device.d97ee209"), p3: target?.id ?? t("ui.unknown.a418e69e")});
    const sourceName = id => sourceDevice(id)?.name ?? t("ui.device.data.missing.6c193ebe", {p1: id});
    const propertyName = (device, property) => device?.properties.find(meta => meta.id === property)?.label ?? property;
    const displayValue = (device, property, value) => {
        const meta = device?.properties.find(meta => meta.id === property);
        return (meta?.valueLabels?.find(entry => entry.value === value)?.label ?? valueText(value)) + (typeof value === 'number' && meta?.unit ? ' ' + meta.unit : '');
    };
    const field = (label, value) => `<div class="read-field"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
    const message = text => { bindText($('#feedback'), () => text); };
    const updateSystems = installSystemSelection({getData: () => data, message, isLoading: () => busy, select: async id => {
        const previous = systemId; systemId = id;
        if (!await load()) { systemId = previous; throw new MessageError("ui.the.new.system.view.could.a0f27b22"); }
    }});
    const updateDiagnostics = installDiagnostics({getData: () => data, isLoading: () => busy, chooseSystem: id => updateSystems.choose(id), message, reload: () => load()});
    const updatePermissions = installPermissions({getData: () => data, isLoading: () => busy, message, reload: () => load()});
    const updateTransfers = installTransfers({getData: () => data, reload: () => load(), isLoading: () => busy, message});
    const updateCatalog = installCatalogRefresh({getData: () => data, reload: () => load(), isLoading: () => busy, message});
    const updateRuntime = installRuntime({getData: () => data, reload: () => load(), isLoading: () => busy, message, onStatus: () => renderRuntimeStatus()});
    function renderRuntimeStatus() {
        bindText($('#runtime-status'), () => data?.status?.confirmed ? t("ui.last.confirmed.active.revision.26a50546", {p1: data.status.executing ? t("ui.automatic.operation.active.5be9b590") : t("ui.automatic.operation.stopped.46b63e37"), p2: data.status.activeRevision ?? '—'}) : t("ui.operation.not.confirmed.yet.162d963a"));
        $('#runtime-status').classList.toggle('running', !!data?.status?.confirmed && !!data.status.executing);
        updateLayout();
    }

    function triggerSummary(trigger) {
        if (trigger.type === 'device') return `${sourceName(trigger.device)} · ${propertyName(sourceDevice(trigger.device), trigger.property)} ${compare[trigger.operator] ?? trigger.operator} ${displayValue(sourceDevice(trigger.device), trigger.property, trigger.value)}`;
        if (trigger.type === 'time') return t("ui.text.db1b0c15", {p1: trigger.at, p2: trigger.timezone});
        if (trigger.type === 'sun') return t("ui.minutes.548e9541", {p1: trigger.event === 'sunrise' ? t("ui.sunrise.5788b301") : t("ui.sunset.5998441f"), p2: trigger.offset_minutes >= 0 ? '+' : '', p3: trigger.offset_minutes, p4: trigger.timezone});
        return t("ui.additional.trigger.7786f267", {p1: trigger.type});
    }

    function conditionSummary(condition) {
        if (condition.type === 'device_value') return `${sourceName(condition.device)} · ${propertyName(sourceDevice(condition.device), condition.property)} ${compare[condition.operator] ?? condition.operator} ${displayValue(sourceDevice(condition.device), condition.property, condition.value)}`;
        if (condition.type === 'time_window') return `${condition.after} bis ${condition.before} · ${condition.timezone}${condition.weekdays ? ' · ' + days(condition.weekdays) : ''}`;
        if (condition.type === 'weekday') return t("ui.text.db1b0c15", {p1: days(condition.weekdays), p2: condition.timezone});
        return t("ui.additional.condition.e6b03139", {p1: condition.type});
    }

    function actionSummary(action) {
        if (action.type === 'sequence') return t("ui.action.sequence.b63db3a8", {p1: entries().find(entry => entry.kind === 'sequence' && entry.id === action.sequence_id)?.name ?? action.sequence_id});
        if (action.type === 'scene') {
            const device = targetDevice(action.target);
            const scene = device?.properties.find(meta => meta.sceneEndpoint === (action.endpoint ?? 0))?.sceneNames?.[action.scene_id];
            return t("ui.scene.46b80b02", {p1: targetName(action.target), p2: scene ?? action.scene_id, p3: action.endpoint ? ' · Kanal ' + action.endpoint : ''});
        }
        if (action.type === 'toggle') return t("ui.toggle.796320a0", {p1: targetName(action.target), p2: propertyName(targetDevice(action.target), action.property)});
        if (action.type === 'set') return t("ui.text.db1b0c15", {p1: targetName(action.target), p2: Object.entries(action.values ?? {}).map(([key, value]) => `${propertyName(targetDevice(action.target), key)}: ${displayValue(targetDevice(action.target), key, value)}`).join(' · ')});
        return t("ui.additional.action.e2b7f366", {p1: action.type});
    }

    function renderNavigation() {
        const all = entries();
        bindText($('#entry-count'), () => all.filter(entry => entry.kind !== 'sequence').length);
        bindHTML($('#categories'), () => Object.entries(areas).map(([kind, [label, symbol]]) => `<button class="category ${category === kind ? 'active' : ''}" data-area="${kind}" aria-pressed="${category === kind}">${icon(symbol)}${label}<span class="category-count">${kind === 'catalog' ? data?.devices.length ?? 0 : all.filter(entry => entry.kind === kind).length}</span></button>`).join(''));
        bindText($('#list-label'), () => areas[category][0]);
        const search = $('#search').value.trim().toLocaleLowerCase(locale());
        const options = category === 'catalog' ? sortedDevices().map(device => ({key: device.key, title: device.name, subtitle: t("ui.text.db1b0c15", {p1: device.target.system ?? data.module.baseTopic, p2: device.target.id})}))
            : all.filter(entry => entry.kind === category).map(entry => ({key: entryKey(entry), title: entry.name,
                subtitle: entry.kind === 'sequence' ? t("ui.steps.af057682", {p1: entry.actions.length}) : (entry.triggers ?? []).map(triggerSummary).join(t("ui.or.5f15b341")), enabled: entry.enabled}));
        const visible = options.filter(entry => `${entry.title} ${entry.subtitle}`.toLocaleLowerCase(locale()).includes(search) && matchesRuleState(entry, stateFilter));
        bindText($('#list-count'), () => `${visible.length} / ${options.length}`);
        bindHTML($('#entry-list'), () => visible.map(entry => `<button class="entry ${selected === entry.key ? 'active' : ''}" data-entry="${esc(entry.key)}" aria-pressed="${selected === entry.key}"><span class="entry-title-row"><strong>${esc(entry.title)}</strong>${entry.enabled !== undefined ? `<span class="enabled-dot ${entry.enabled ? 'on' : ''}" title="${t("draft.in")} ${entry.enabled ? t("ui.enabled.aae668f6") : t("ui.disabled.1fa013fd")}"></span>` : ''}</span><small>${esc(entry.subtitle)}</small></button>`).join('')
            || `<p class="empty-list">${t("ui.no.matching.entries.this.view.ca6ab1c2")}</p>`);
    }

    function card(kind, index, title, summary, tag = '') {
        const key = `${kind}:${index}`;
        const type = current()?.[kind]?.[index]?.type;
        const symbol = kind === 'conditions' ? 'condition' : kind === 'actions' ? (type === 'sequence' ? 'flow' : type === 'scene' ? 'bolt' : 'lamp') : type === 'time' || type === 'sun' ? 'clock' : 'device';
        return `<button class="flow-card read-card ${selectedPart === key ? 'selected' : ''}" data-part="${key}" aria-pressed="${selectedPart === key}"><span class="card-mark">${icon(symbol)}</span><span class="card-content"><strong>${esc(title)}</strong><span class="read-summary">${esc(summary)}</span>${tag ? `<span class="card-tag">${icon('clock')}${esc(tag)}</span>` : ''}</span><span class="card-number">${index + 1}</span></button>`;
    }

    function section(title, type, content) {
        return `<section class="flow-section ${type}-section"><div class="section-title"><span class="section-symbol">${icon(type === 'condition' ? 'condition' : type === 'action' ? 'bolt' : category === 'device' ? 'device' : 'clock')}</span><h3>${esc(title)}</h3></div>${content}</section>`;
    }

    function renderFlow() {
        const entry = current();
        bindText($('#entry-type'), () => areas[category][0].toUpperCase());
        bindText($('#entry-title'), () => entry?.name ?? t("ui.no.selection.146bfc6e"));
        detailsButton.disabled = !entry;
        bindText($('#entry-subtitle'), () => entry ? category === 'catalog' ? t("ui.loaded.properties.channels.and.scenes.0c23a181") : entry.kind === 'sequence' ? t("ui.reusable.action.sequence.in.local.d55beb51")
            : t("rule.summary", {state: entry.enabled ? t("ui.enabled.aae668f6") : t("ui.disabled.1fa013fd"), count: entry.actions.length}) : t("ui.select.an.existing.entry.on.e1b9ca5a"));
        if (!entry) { bindHTML($('#flow'), () => `<p class="sequence-note">${t("ui.existing.rules.and.device.data.91262889")}</p>`); return; }
        if (category === 'catalog') {
            bindHTML($('#flow'), () => section(t("ui.properties.and.channels.51118126"), 'when', entry.properties.map((meta, index) => card('properties', index, meta.label, meta.id,
                meta.writable ? t("ui.controllable.in.symcon.87a0a2ce") : meta.readable ? t("ui.read.only.e7c58c99") : t("ui.unavailable.as.an.action.a3d93cf1"))).join('')));
            return;
        }
        let html = '';
        if (entry.kind !== 'sequence') {
            html += section(t("ui.1.when.91055bf0"), 'when', entry.triggers.map((trigger, index) => card('triggers', index, trigger.type === 'device' ? t("ui.device.event.704e02c3") : trigger.type === 'sun' ? t("ui.solar.event.63a4e157") : t("ui.time.317f0a69"), triggerSummary(trigger))).join(`<div class="or-label">${t("ui.or.43e40606")}</div>`));
            html += `<div class="flow-connector"></div>` + section(t("ui.2.only.if.d315c02f"), 'condition', entry.conditions.length ? entry.conditions.map((condition, index) => card('conditions', index, condition.type === 'device_value' ? t("ui.device.condition.b046563c") : condition.type === 'weekday' ? t("ui.weekdays.b73421c5") : t("ui.time.window.85f012d6"), conditionSummary(condition), condition.start_only ? t("ui.only.at.start.cc0a97a5") : '')).join('') : `<p class="field-help">${t("ui.no.additional.conditions.008dbb31")}</p>`) + `<div class="flow-connector"></div>`;
        }
        html += section(`${entry.kind === 'sequence' ? '' : '3 · '}DANN`, 'action', entry.actions.map((action, index) => card('actions', index, t("ui.step.b4fefd27", {p1: index + 1}), actionSummary(action), action.delay_seconds ? t("ui.wait.seconds.first.c3ce31af", {p1: action.delay_seconds}) : t("ui.run.immediately.81aa8578"))).join(''));
        bindHTML($('#flow'), () => html);
    }

    function renderInspector() {
        const entry = current();
        let html = '';
        let title = t("ui.details.45989de4");
        if (entry && category === 'catalog') {
            const property = selectedPart?.startsWith('properties:') ? entry.properties[Number(selectedPart.split(':')[1])] : null;
            title = property?.label ?? t("ui.device.group.fe09aa58");
            html = field(t("ui.name.dcd1d522"), entry.name) + field(t("ui.z2m.system.7a27be0b"), entry.target.system ?? data.module.baseTopic) + field(t("ui.identifier.f1f479e2"), entry.target.id);
            if (property) {
                html += field(t("ui.property.channel.b524f965"), property.id) + field(t("ui.readable.738bdf22"), property.readable ? t("ui.yes.cde9e58a") : t("ui.no.90ebc1bd")) + field(t("ui.controllable.in.symcon.edc60e84"), property.writable ? t("ui.yes.cde9e58a") : t("ui.no.90ebc1bd"));
                if (property.unit) html += field(t("ui.unit.d5ba1549"), property.unit);
                for (const [key, label] of [['minimum', t("ui.minimum.735beee2")], ['maximum', t("ui.maximum.66c9ab17")], ['step', t("ui.step.size.0d1486f0")]]) if (property[key] !== undefined) html += field(label, property[key]);
                if (property.values.length) html += field(property.sceneNames ? t("ui.existing.scenes.5fb74b19") : t("ui.available.values.4daebbce"), property.values.map(value => displayValue(entry, property.id, value)).join(', '));
            }
        } else if (entry) {
            const [kind, position] = selectedPart?.split(':') ?? [];
            const item = entry[kind]?.[Number(position)];
            title = item ? ({triggers: t("ui.trigger.9137c3bf"), conditions: t("ui.condition.c1d1da5a"), actions: t("ui.action.a4ad259e")}[kind]) + ' ' + (Number(position) + 1) : entry.kind === 'sequence' ? t("ui.action.sequence.35690788") : t("ui.automation.d909750b");
            html = field(t("ui.name.dcd1d522"), entry.name) + field(t("ui.rule.id.0dd56b69"), entry.id);
            if (!item && entry.kind !== 'sequence') html += field(t('restart.label'), t({abort: 'restart.abort', resume: 'restart.resume', resume_expired: 'restart.expired'}[entry.restart_policy ?? 'abort'])) ;
            if (!item && entry.kind !== 'sequence') html += field(t("ui.in.local.draft.706365af"), entry.enabled ? t("ui.enabled.58279f72") : t("ui.disabled.a21a5188")) + field(t("ui.on.retrigger.7588befa"), {ignore: t("ui.ignore.new.trigger.0724102c"), restart: t("ui.restart.from.the.beginning.f723ba35"), extend: t("ui.reset.current.delay.2561f6e5")}[entry.retrigger ?? 'ignore']);
            if (item) {
                html += field(t("ui.description.e9262f00"), kind === 'triggers' ? triggerSummary(item) : kind === 'conditions' ? conditionSummary(item) : actionSummary(item));
                if (item.device) html += field(t("ui.device.b32db786"), sourceName(item.device));
                if (item.target) html += field(t("ui.target.f487ce39"), targetName(item.target)) + field(t("ui.z2m.system.7a27be0b"), item.target.system ?? data.module.baseTopic);
                if (item.property) html += field(t("ui.property.channel.b524f965"), propertyName(item.target ? targetDevice(item.target) : sourceDevice(item.device), item.property));
                if (Object.hasOwn(item, 'value')) html += field(t("ui.comparison.value.b6e7150f"), displayValue(sourceDevice(item.device), item.property, item.value));
                if (item.values) for (const [key, value] of Object.entries(item.values)) html += field(propertyName(targetDevice(item.target), key), displayValue(targetDevice(item.target), key, value));
                if (item.for_seconds !== undefined) html += field(t("ui.minimum.duration.cfb985d9"), t("duration.seconds", {count: item.for_seconds}));
                if (kind === 'triggers' && item.type === 'device') html += field(t("ui.only.on.value.change.141310cb"), item.on_change ? t("ui.yes.cde9e58a") : t("ui.no.90ebc1bd"));
                if (kind === 'conditions' && item.type === 'device_value') html += field(t("ui.check.only.at.start.a6aa3b78"), item.start_only ? t("ui.yes.cde9e58a") : t("ui.no.90ebc1bd"));
                if (kind === 'actions') html += field(t("ui.delay.before.this.step.6b19a697"), t("duration.seconds", {count: item.delay_seconds ?? 0}));
                if (item.type === 'scene') html += field(t("ui.scene.number.1e84cb7e"), item.scene_id) + (item.endpoint ? field(t("ui.channel.fe59abe1"), item.endpoint) : '');
                if (item.type === 'sun') html += field(t("ui.latitude.c5049879"), item.latitude) + field(t("ui.longitude.4c9aacde"), item.longitude);
                if (item.type === 'sequence') html += `<button data-sequence="${esc(item.sequence_id)}">${t("ui.view.action.sequence.54ed1798")}</button>`;
            }
        }
        bindText($('#inspector-title'), () => title);
        bindText($('#inspector-subtitle'), () => category === 'catalog' ? t("ui.device.data.for.use.in.9b68fab3") : entry?.kind === 'sequence' ? t("ui.to.make.changes.choose.edit.0f85714b") : t("ui.view.block.details.to.make.59bc1283"));
        if (entry && category !== 'catalog') {
            const allowed = entry.kind === 'sequence' ? data?.sequenceAllowed : data?.editAllowed;
            html += `<button class="primary inspector-edit" data-edit-current="true" ${allowed ? '' : 'disabled'}>${icon('settings')}${entry.kind === 'sequence' ? t("ui.edit.action.sequence.2e8a0548") : t("ui.edit.automation.ac46d0d5")}</button>`;
        }
        bindHTML($('#inspector-fields'), () => html || `<p class="field-help">${t("ui.choose.an.entry.on.the.81b6eb13")}</p>`);
    }

    function render() { embedding.update(data); renderNavigation(); renderFlow(); renderInspector(); editing?.refresh(); management?.refresh(category, stateFilter); eventImport?.refresh(); }
    function selectEntry(key) { selected = key; selectedPart = null; render(); }
    function chooseArea(area) {
        category = area; selectedPart = null;
        selected = category === 'catalog' ? sortedDevices()[0]?.key : entryKeyOrNull(entries().find(entry => entry.kind === category));
        render();
    }
    const entryKeyOrNull = entry => entry ? entryKey(entry) : null;

    document.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button || button.disabled) return;
        if (button.dataset.area) chooseArea(button.dataset.area);
        if (button.dataset.entry) selectEntry(button.dataset.entry);
        if (button.dataset.part) { selectedPart = button.dataset.part; renderFlow(); renderInspector(); }
        if (button === detailsButton) { selectedPart = null; renderFlow(); renderInspector(); }
        if (button.dataset.sequence) { category = 'sequence'; $('#search').value = ''; selectEntry('sequence:' + button.dataset.sequence); }
        if (button.dataset.editCurrent && !$('#edit-automation-button').disabled) $('#edit-automation-button').click();
    });
    $('#search').addEventListener('input', renderNavigation);
    $('#validate-button').addEventListener('click', load);

    function paintStatus() {
        if (!data) return;
        if (isDesktop()) {
            document.title = 'Z2M-Automations';
            bindText($('.preview-label'), () => t(data.desktop?.project && data.desktop.source === 'draft' ? 'ui.draft.90845583' : 'desktop.readOnly'));
            if (data.desktop?.project) {
                bindText($('.preview-notice strong'), () => t('mqtt.title'));
                bindText($('.preview-notice > span:last-child'), () => t('mqtt.draftsSeparate'));
                bindText($('#draft-status'), () => Number.isInteger(data.desktop.draftRevision)
                    ? t('mqtt.localRevision', {revision: data.desktop.draftRevision}) : t('workflow.noSystem'));
                bindText($('#runtime-status'), () => t(!data.status.confirmed ? 'mqtt.operationUnknown' : data.status.executing ? 'mqtt.operationActive' : 'mqtt.operationStopped'));
                bindText($('.canvas-footer > span:last-child'), () => t('mqtt.draftsSeparate'));
                bindText($('#entry-subtitle'), () => data.module.name + ' · ' + data.desktop.systemName);
                $('#issues').hidden = true; message(() => t('mqtt.draftsSeparate')); return;
            }
            bindText($('.preview-notice strong'), () => t('desktop.offline'));
            bindText($('.preview-notice > span:last-child'), () => t('desktop.notice'));
            bindText($('#draft-status'), () => t('desktop.examples'));
            bindText($('#runtime-status'), () => t('desktop.noConnection'));
            bindText($('.canvas-footer > span:last-child'), () => t('desktop.notice'));
            bindText($('#entry-subtitle'), () => t('desktop.examples'));
            $('#issues').hidden = true;
            message(() => t('desktop.notice'));
            return;
        }
        if (data.workspace) bindText($('.preview-notice > span:last-child'), () => t("ui.edit.drafts.per.z2m.system.e393812e"));
        bindText($('.canvas-footer > span:last-child'), () => data.workspace ? t("ui.edit.local.drafts.transfer.only.004f4782") : t("ui.edit.automations.and.action.sequences.2b7902b6"));
        document.title = t("ui.automation.designer.draft.47bd558d", {p1: data.module.name});
        bindText($('#draft-status'), () => data.draftAvailable ? t("ui.local.draft.revision.b3e4c474", {p1: data.configuration.revision}) : t("ui.no.matching.editor.draft.loaded.8fabd4d0"));
        renderRuntimeStatus();
        $('#draft-status').className = 'status-chip';
        const notices = [t("ui.topic.module.data.no.live.baaf06b9", {p1: data.module.name, p2: data.module.baseTopic})];
        const catalogTime = Number.isSafeInteger(data.catalogLoadedAt) && data.catalogLoadedAt > 0
            ? new Date(data.catalogLoadedAt * 1000).toLocaleString(locale()) : null;
        const storedTime = Number.isSafeInteger(data.catalogRefresh?.storedAt) && data.catalogRefresh.storedAt > 0
            ? new Date(data.catalogRefresh.storedAt * 1000).toLocaleString(locale()) : null;
        notices[0] += catalogTime ? t("ui.device.data.last.refreshed.7a5587aa", {p1: catalogTime})
            : storedTime ? t("ui.device.data.previously.saved.20fb84c1", {p1: storedTime}) : t("ui.device.data.refresh.time.is.c4aac5f2");
        if (!data.catalogAvailable) notices.push(data.workspace
            ? (data.catalogRefresh?.storedAt ? t("ui.saved.device.data.is.not.ee025668")
                : t("ui.device.data.is.missing.for.db0f1bfb"))
            : t("ui.device.data.is.missing.for.23e595fa"));
        if (!data.draftAvailable && !data.draftMismatch) notices.push(data.workspace ? t("ui.this.system.has.no.local.5787ff4b") : t("ui.no.automation.draft.has.been.549085f2"));
        if (data.draftMismatch) notices.push(t("ui.the.yaml.draft.differs.from.417e170d"));
        if (data.openFormEdits) notices.push(t("ui.the.native.form.has.input.d0b78d48"));
        $('#issues').hidden = data.catalogAvailable && data.draftAvailable && !data.openFormEdits;
        bindText($('#issues'), () => notices.join(' '));
        $('#feedback').dataset.tone = '';
        message(() => (notices[0]));
    }
    async function load(preferredRule = '', preferredSequence = '') {
        if (busy) return false;
        busy = true; $('#validate-button').disabled = true;
        message(() => (t("ui.reading.existing.module.data.no.53b451b0")));
        try {
            if (!isDesktop() && !/^[a-f0-9]{64}$/.test(token)) throw new Error('access');
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            let response; let text;
            try {
                response = await fetch(endpoint, {method: 'GET', headers: {'X-Z2MA-Read-Token': token, ...(systemId ? {'X-Z2MA-System-ID': systemId} : {})}, cache: 'no-store', signal: controller.signal, redirect: 'error'});
                if (response.ok) text = await response.text();
            } finally { clearTimeout(timeout); }
            if (!response.ok) throw new Error(response.status === 403 ? 'access' : 'transport');
            // Desktop combines at most eight independently bounded peer catalogs.
            if (text.length > (isDesktop() ? 67108864 : 2097152)) throw new Error('invalid');
            const next = localizeResponse(JSON.parse(text));
            if (next.contractVersion !== 1 || next.mode !== 'read' || !Array.isArray(next.devices) || !next.module || !next.status) throw new Error('invalid');
            await loadSystemDevices(next, {token, signal: controller.signal, onProgress: (loaded, total) => message(() => (t("ui.reading.device.data.of.drafts.6ef5f0ac", {p1: loaded, p2: total})))});
            const previousSystem = data?.workspaceContext?.systemId ?? '';
            const nextSystem = next.workspaceContext?.systemId ?? '';
            if (previousSystem !== nextSystem) {
                if (previousSystem) systemViews.set(previousSystem, {category, selected, selectedPart, stateFilter, search: $('#search').value});
                const view = systemViews.get(nextSystem);
                stateFilter = view?.stateFilter ?? 'all';
                category = view?.category ?? 'device'; selected = view?.selected ?? null; selectedPart = view?.selectedPart ?? null;
                $('#search').value = view?.search ?? '';
            }
            data = next; systemId = nextSystem; updateSystems(data);
            if (isDesktop()) {
                document.body.classList.toggle('desktop-editable', !!data.desktop?.project && data.desktop.source === 'draft');
                document.body.classList.toggle('desktop-stored-view', data.desktop?.source === 'stored');
            }
            paintStatus();
            if (typeof preferredRule === 'string' && data.configuration?.automations.some(rule => rule.id === preferredRule)) {
                category = entries().find(entry => entry.id === preferredRule && entry.kind !== 'sequence').kind; selected = 'rule:' + preferredRule; selectedPart = null; $('#search').value = '';
            } else if (preferredSequence && data.configuration?.sequences?.some(sequence => sequence.id === preferredSequence)) {
                category = 'sequence'; selected = 'sequence:' + preferredSequence; selectedPart = null; $('#search').value = '';
            } else if (!current()) {
                const first = entries().find(entry => entry.kind === category) ?? entries()[0];
                if (category !== 'catalog' && first) category = first.kind;
                selected = category === 'catalog' ? sortedDevices()[0]?.key : entryKeyOrNull(first);
                selectedPart = null;
            }
            render();
            return true;
        } catch (error) {
            const text = error.message === 'access' ? t("ui.read.access.is.missing.or.e380a485") : t("ui.module.data.could.not.be.80c47bf5");
            message(text); $('#feedback').dataset.tone = 'error';
            $('#issues').hidden = false; bindText($('#issues'), () => text);
            return false;
        } finally {
            busy = false; $('#validate-button').disabled = false; updateTransfers(); updateRuntime(); updateCatalog(); updateDiagnostics(); updatePermissions(); management?.refresh(category, stateFilter); eventImport?.refresh(); updateLayout();
            if (projectReloadPending) { projectReloadPending = false; queueMicrotask(() => { void load(); }); }
        }
    }
    editing = installEditing({getData: () => data, getRule: current, reload: () => load(), switchToDraft: async () => {
        try {
            const response = await fetch('/draft-view', {method: 'POST', body: JSON.stringify({systemId: data.workspaceContext.systemId})});
            if (response.ok && await load() && data.desktop?.source === 'draft') {
                if (data.createAllowed) return true;
                message(() => data.createNotice || t('wizard.unavailable'));
                return false;
            }
        } catch { /* The current draft remains available after a failed switch. */ }
        message(() => t('wizard.unavailable'));
        return false;
    }, summaries: {triggers: triggerSummary, conditions: conditionSummary, actions: actionSummary}, onCreated: async ruleId => {
        const refreshed = await load(ruleId);
        message(() => (refreshed ? t(isDesktop() ? "wizard.created" : "wizard.createdSymcon")
            : t("ui.the.automation.was.added.to.9cc3bca1")));
    }, onEdited: async ruleId => {
        const refreshed = await load(ruleId);
        message(() => (refreshed ? t("ui.change.applied.to.the.local.9b87dbaf")
            : t("ui.the.change.was.applied.to.0df2d1eb")));
    }, onSequenceSaved: async sequenceId => {
        const refreshed = await load('', sequenceId);
        message(() => (refreshed ? t("ui.action.sequence.applied.to.the.37c830cc")
            : t("ui.the.action.sequence.was.applied.226c343e")));
    }});
    management = installManagement({getData: () => data, getEntry: current, isLoading: () => busy, reload: () => load(), copied: ruleId => load(ruleId), message,
        filterChanged: value => { stateFilter = value; renderNavigation(); }});
    eventImport = installEventImport({getData: () => data, isLoading: () => busy, reload: () => load(), message,
        onImported: async ruleId => { if (!await load(ruleId)) message(() => (t("ui.event.imported.disabled.refresh.the.338172e3"))); }});
    updateLayout = installLayout({getData: () => data});
    onLanguageChange(() => { paintStatus(); render(); updateTransfers(); updateRuntime(); updateCatalog(); updateLayout(); });
    render();
    if (isDesktop()) document.addEventListener('z2ma-project-changed', () => { if (busy) projectReloadPending = true; else void load(); });
    embedding.ready.then(load);
})();
