import {designerRequest as fetch, isDesktop} from './transport.js';
import {t, bindText, bindHTML, bindAttribute, localizedOption, localizeRecord, MessageError, ResponseError, locale, formatDate, formatNumber, onLanguageChange, installLanguagePicker, localizeResponse, sortByName} from './localization.js';
/* Shared rule editor: complete creation and cloned, field-scoped editing stay local to the draft. */
import {creationDevices, creationProperties, creationValue, requestIdentity} from './creator.js';
import {selectedSystemName, systemHeaders} from './workspace.js';
import {moveAction, installActionSorting} from './action-order.js';

const copy = value => structuredClone(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const changedFields = (original, working, fields) => Object.fromEntries(fields.filter(key => !same(original[key], working[key])).map(key => [key, copy(working[key])]));
export const ruleChanges = (original, working) => changedFields(original, working, ['name', 'enabled', 'retrigger', 'restart_policy', 'triggers', 'conditions', 'actions']);
export const sequenceChanges = (original, working) => changedFields(original, working, ['name', 'actions']);
export const creationRule = working => Object.fromEntries(['name', 'retrigger', 'restart_policy', 'triggers', 'conditions', 'actions'].map(key => [key, copy(working[key])]));
export function targetDevice(data, target) {
    return data.devices.find(device => device.target.type === target?.type && device.target.id === target?.id && (device.target.system ?? '') === (target?.system ?? ''));
}
export function valueIndex(property, side, value) {
    return (side === 'target' ? property?.actionValues : property?.values)?.findIndex(entry => same(entry, value)) ?? -1;
}
const compare = localizeRecord(() => ({eq: t("ui.is.equal.to.456b1261"), ne: t("ui.is.not.equal.to.c72da4b0"), gt: t("ui.is.greater.than.c23edfd9"), gte: t("ui.is.at.least.8adebfa3"), lt: t("ui.is.less.than.f2641c8f"), lte: t("ui.is.at.most.53bbaac0")}));
const kinds = localizeRecord(() => ({triggers: {device: t("ui.device.event.704e02c3"), time: t("ui.time.317f0a69"), sun: t("ui.solar.event.63a4e157")}, conditions: {device_value: t("ui.device.value.e2721139"), weekday: t("ui.weekdays.b73421c5"), time_window: t("ui.time.window.85f012d6")},
    actions: {set: t("ui.set.values.b905b29c"), toggle: t("ui.toggle.77fec02e"), scene: t("ui.recall.scene.a6fb0e6f"), sequence: t("ui.call.action.sequence.f1795acb")}}));
const dayNames = localizeRecord(() => ([t("ui.mon.d23e867e"), t("ui.tue.16ab7287"), t("ui.wed.d8f33a13"), t("ui.thu.30094e0b"), t("ui.fri.eed8f901"), t("ui.sat.a951efc7"), t("ui.sun.fb1df1a2")]));
const valueLabel = value => typeof value === 'boolean' ? (value ? t("ui.yes.detected.f51e55b6") : t("ui.no.not.detected.2e04e05d")) : ({ON: t("ui.on.b9a637bc"), OFF: t("ui.off.f0ce9450"), TOGGLE: t("ui.toggle.77fec02e")}[value] ?? String(value ?? t("ui.no.value.36bac452")));

export function installEditing({getData, getRule, reload, switchToDraft, onCreated, onEdited, onSequenceSaved, summaries}) {
    const createButton = document.createElement('button');
    createButton.id = 'new-automation-button'; createButton.className = 'primary'; bindText(createButton, () => t("ui.new.automation.9643f89c"));
    document.querySelector('.toolbar').prepend(createButton);
    const sidebarCreate = createButton.cloneNode(false);
    sidebarCreate.id = 'draft-wizard-start';
    bindText(sidebarCreate, () => t('wizard.entry'));
    const entry = document.createElement('div'); entry.className = 'draft-wizard-entry';
    const entryNotice = document.createElement('p'); entryNotice.id = 'draft-wizard-notice'; entryNotice.className = 'field-help';
    sidebarCreate.setAttribute('aria-describedby', entryNotice.id);
    entry.append(sidebarCreate, entryNotice);
    document.querySelector('.navigation .panel-heading').after(entry);
    const editButton = document.createElement('button');
    editButton.id = 'edit-automation-button'; bindText(editButton, () => t("ui.edit.automation.ac46d0d5"));
    document.querySelector('.entry-tools').prepend(editButton);
    const sequenceButton = document.createElement('button'); sequenceButton.id = 'new-sequence-button'; bindText(sequenceButton, () => t("ui.new.action.sequence.7e14a407"));
    document.querySelector('.toolbar').prepend(sequenceButton);
    const dialog = document.createElement('dialog');
    dialog.id = 'edit-dialog'; dialog.className = 'creation-dialog rule-edit-dialog'; dialog.setAttribute('aria-labelledby', 'edit-title');
    bindHTML(dialog, () => `<form id="edit-form" novalidate>
        <span class="eyebrow"></span><h2 id="edit-title"></h2>
        <p id="edit-system" class="field-help"></p><p id="edit-usage" hidden></p>
        <div id="edit-fields"></div>
        <p id="edit-message" role="status" aria-live="polite" hidden></p>
        <p id="edit-export-help" class="field-help">${t('editor.exportHelp')}</p>
        <div class="dialog-actions">
            <button type="button" id="edit-reload">${t("ui.reload.and.discard.input.56f16c4b")}</button>
            <button type="button" id="edit-submit">${t("ui.apply.changes.to.draft.1e42a9b6")}</button>
            <button type="button" id="edit-cancel">${t("ui.cancel.f7ff1178")}</button>
            <button type="submit" id="edit-export" class="primary" aria-describedby="edit-export-help">${t('editor.export')}</button>
        </div>
    </form>`);
    document.body.append(dialog);
    const $ = name => dialog.querySelector('#edit-' + name);
    let original; let working; let context; let requestId; let busy = false; let serial = 0; let sequenceMode = false; let creatingSequence = false; let creatingRule = false; let boundHeaders = {}; let sorting;
    let boundTopic = '';
    let stale = false;
    let startingCreation = false;
    let pendingKey = ''; const recovered = new Set();
    const editorKey = () => getData()?.desktop?.project ? 'z2ma.desktop.editor.' + getData().desktop.projectId + '.' + getData().workspaceContext.systemId : '';
    function remember() {
        if (!pendingKey || !dialog.open) return;
        const value = JSON.stringify({epoch: getData().desktop.epoch, original, working, context, requestId, sequenceMode, creatingSequence, creatingRule, boundHeaders, boundTopic});
        if (value.length <= 131072) { try { sessionStorage.setItem(pendingKey, value); } catch {} }
    }
    for (const event of ['input', 'change', 'click']) $('form').addEventListener(event, () => queueMicrotask(remember));
    dialog.addEventListener('close', () => {
        if (!isDesktop()) return;
        try { if (pendingKey) sessionStorage.removeItem(pendingKey); } catch {}
        pendingKey = ''; document.dispatchEvent(new CustomEvent('z2ma-editor-pending', {detail: false}));
    });
    const hint = value => {
        $('message').hidden = !value;
        bindText($('message'), value ?? '');
    };
    const node = (tag, text, className) => { const element = document.createElement(tag); if (text !== undefined) bindText(element, () => text); if (className) element.className = className; return element; };
    function field(parent, label, value, set, options = {}) {
        const wrap = node('label', undefined, 'field'); wrap.append(node('span', label));
        const input = document.createElement(options.choices ? 'select' : 'input'); input.id = 'edit-field-' + (++serial);
        bindAttribute(input, 'aria-label', label);
        if (options.choices) {
            const choices = () => options.choices();
            choices().forEach(([key], index) => input.add(localizedOption(() => choices()[index][1], key)));
            if (![...input.options].some(option => option.value === String(value ?? ''))) {
                const unavailable = localizedOption(() => t("ui.previous.value.is.unavailable.308b3b49"), String(value ?? ''));
                unavailable.disabled = creatingRule || creatingSequence;
                input.add(unavailable);
            }
        } else {
            input.type = options.type ?? 'text';
            for (const key of ['min', 'max', 'step', 'maxLength']) if (options[key] !== undefined) input[key] = options[key];
        }
        if (input.type === 'checkbox') { input.checked = value === true; wrap.classList.add('edit-check'); }
        else input.value = value ?? '';
        input.disabled = options.disabled ?? false;
        if (options.required !== false && input.type !== 'checkbox') input.required = true;
        input.addEventListener(options.choices || input.type === 'checkbox' ? 'change' : 'input', () => {
            clearFieldError(input);
            set(input.type === 'checkbox' ? input.checked : input.value);
        });
        wrap.append(input); parent.append(wrap); return input;
    }
    const number = (parent, label, object, key, initial = 0, min = 0, max = 86400, step = 1) => field(parent, label, object[key] ?? initial, text => { object[key] = text === '' ? null : Number(text); }, {type: 'number', min, max, step});
    const time = (parent, label, object, key) => field(parent, label, object[key], text => { object[key] = text.length === 5 ? text + ':00' : text; }, {type: 'time', step: 1});
    const zone = (parent, object) => field(parent, () => (t("ui.time.zone.00507b23")), object.timezone, text => { object.timezone = text; });
    const check = (parent, label, object, key) => field(parent, label, object[key] ?? false, value => { object[key] = value; }, {type: 'checkbox'});
    function button(parent, text, action, disabled = false) {
        const result = node('button', text); result.type = 'button'; result.disabled = disabled; result.addEventListener('click', action); parent.append(result); return result;
    }
    function propertyValue(parent, property, side, value, set) {
        if (!property) { parent.append(node('p', () => (t("ui.select.a.device.and.property.a74928e2")), 'field-help')); return; }
        if (property.type === 'numeric') {
            field(parent, () => (t("ui.value.7e347daa") + (property.unit ? ' (' + property.unit + ')' : '')), value, text => set(text === '' ? null : Number(text)), {type: 'number', step: side === 'target' ? property.step ?? 'any' : 'any',
                ...(side === 'target' ? {min: property.minimum, max: property.maximum} : {})});
        } else if (property.type === 'color') {
            field(parent, () => (t("ui.colour.a952c8f7")), value?.hex ?? '#ffffff', text => set({hex: text}), {type: 'color'});
        } else {
            const values = side === 'target' ? property.actionValues : property.values;
            field(parent, () => (t("ui.value.7e347daa")), valueIndex(property, side, value) < 0 ? '' : String(valueIndex(property, side, value)), text => {
                if (text === '') { set(undefined); return; }
                set(creationValue(property, side, text));
            }, {choices: () => [['', t("ui.select.value.c40f9e84")], ...values.map((v, index) => [String(index), property.sceneNames?.[v] ?? property.valueLabels?.find(entry => same(entry.value, v))?.label ?? valueLabel(v)])]});
        }
    }
    function devicePicker(parent, side, current, set) {
        const box = node('div', undefined, 'edit-device-picker'); parent.append(box);
        const search = field(box, () => (t("ui.search.devices.e2326f44")), '', () => refreshOptions(), {type: 'search', required: false});
        const select = field(box, () => (t("ui.device.b32db786")), current?.key ?? '', key => { const device = getData().devices.find(entry => entry.key === key); set(device); renderFields(); }, {choices: () => [['', t("ui.select.device.c5925e7a")]]});
        search.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            select.focus();
        });
        function refreshOptions() {
            const found = creationDevices(getData(), side, search.value);
            if (current && !found.some(device => device.key === current.key)) found.unshift(current);
            select.replaceChildren(localizedOption(() => t("ui.select.device.c5925e7a"), ''));
            for (const device of sortByName(found)) select.add(localizedOption(() => t("ui.text.db1b0c15", {p1: device.name, p2: device.target.system ?? getData().module.baseTopic}), device.key));
            if (current) select.value = current.key;
        }
        refreshOptions();
    }
    function sourceFields(parent, item) {
        const device = getData().devices.find(entry => entry.key === item.device && !entry.target.system && entry.target.type === 'device');
        devicePicker(parent, 'source', device, selected => { item.device = selected?.key ?? ''; item.property = ''; delete item.value; });
        const properties = creationProperties(device, 'source');
        field(parent, () => (t("ui.property.channel.b524f965")), item.property, property => { item.property = property; delete item.value; renderFields(); }, {choices: () => [['', t("ui.select.property.channel.9718e7d6")], ...properties.map(meta => [meta.id, meta.label])]});
        const property = properties.find(meta => meta.id === item.property);
        field(parent, () => (t("ui.comparison.79a63c24")), item.operator, value => { item.operator = value; }, {choices: () => Object.entries(compare).filter(([key]) => property?.type === 'numeric' || ['eq', 'ne'].includes(key))});
        propertyValue(parent, property, 'source', item.value, value => { if (value === undefined) delete item.value; else item.value = value; });
        if (item.type === 'device') { number(parent, () => (t("ui.minimum.duration.seconds.17226a17")), item, 'for_seconds'); check(parent, () => (t("ui.trigger.only.when.the.value.ee394770")), item, 'on_change'); }
        else check(parent, () => (t("ui.check.only.at.start.a6aa3b78")), item, 'start_only');
    }
    function weekdays(parent, item, optional = false) {
        if (optional) {
            field(parent, () => (t("ui.restrict.time.window.to.weekdays.e94d1bd8")), Object.hasOwn(item, 'weekdays'), value => { if (value) item.weekdays = [1, 2, 3, 4, 5, 6, 7]; else delete item.weekdays; renderFields(); }, {type: 'checkbox'});
            if (!Object.hasOwn(item, 'weekdays')) return;
        }
        const row = node('div', undefined, 'edit-weekdays'); parent.append(row);
        for (let day = 1; day <= 7; day++) field(row, () => dayNames[day - 1], item.weekdays?.includes(day), checked => {
            item.weekdays = checked ? [...(item.weekdays ?? []), day].sort((a, b) => a - b) : item.weekdays.filter(value => value !== day);
        }, {type: 'checkbox'});
    }
    function actionFields(parent, item) {
        number(parent, () => (t("ui.delay.before.this.step.seconds.75c3c7fe")), item, 'delay_seconds');
        if (item.type === 'sequence') {
            field(parent, () => (t("ui.action.sequence.35690788")), item.sequence_id, value => { item.sequence_id = value; }, {choices: () => [['', t("ui.select.action.sequence.a680d796")], ...(getData().configuration.sequences ?? []).map(entry => [entry.id, entry.name])]});
            parent.append(node('p', () => (t("ui.the.saved.action.sequence.will.18123720")), 'field-help')); return;
        }
        const device = targetDevice(getData(), item.target);
        devicePicker(parent, 'target', device, selected => {
            item.target = selected ? copy(selected.target) : {type: 'device', id: ''};
            if (item.type === 'set') item.values = {'': undefined};
            else if (item.type === 'toggle') item.property = '';
            else { delete item.scene_id; delete item.endpoint; }
        });
        let properties = creationProperties(device, 'target');
        if (item.type === 'toggle') {
            properties = properties.filter(meta => /^state(?:_[A-Za-z0-9_]+)?$/.test(meta.id) && meta.actionValues.includes('TOGGLE'));
            field(parent, () => (t("ui.property.channel.b524f965")), item.property, value => { item.property = value; }, {choices: () => [['', t("ui.select.channel.38f2cf98")], ...properties.map(meta => [meta.id, meta.label])]}); return;
        }
        if (item.type === 'scene') {
            properties = properties.filter(meta => meta.sceneEndpoint !== undefined);
            let property = properties.find(meta => meta.sceneEndpoint === (item.endpoint ?? 0));
            field(parent, () => (t("ui.scene.channel.f77f53d9")), property?.id ?? '', value => {
                property = properties.find(meta => meta.id === value); delete item.scene_id;
                if (property?.sceneEndpoint > 0) item.endpoint = property.sceneEndpoint; else delete item.endpoint;
                renderFields();
            }, {choices: () => [['', t("ui.select.scene.channel.1eed8c4e")], ...properties.map(meta => [meta.id, meta.label])]});
            propertyValue(parent, property, 'target', item.scene_id, value => { if (value === undefined) delete item.scene_id; else item.scene_id = value; }); return;
        }
        properties = properties.filter(meta => meta.sceneEndpoint === undefined);
        const values = Object.entries(item.values);
        if (!values.length) values.push(['', undefined]);
        for (const [key, value] of values) {
            const command = node('fieldset', undefined, 'edit-command'); command.append(node('legend', () => (t("ui.value.to.set.7446af2f")))); parent.append(command);
            field(command, () => (t("ui.property.channel.b524f965")), key, property => {
                delete item.values[key];
                const selected = properties.find(meta => meta.id === property);
                item.values[property] = selected?.type === 'color' ? {hex: '#ffffff'} : undefined;
                renderFields();
            }, {choices: () => [['', t("ui.select.property.channel.9718e7d6")], ...properties.filter(meta => meta.id === key || !Object.hasOwn(item.values, meta.id)).map(meta => [meta.id, meta.label])]});
            const meta = properties.find(property => property.id === key);
            propertyValue(command, meta ? {...meta, actionValues: meta.actionValues.filter(v => v !== 'TOGGLE')} : null, 'target', value, next => { item.values[key] = next; });
            if (values.length > 1) button(command, () => (t("ui.remove.value.aba676af")), () => { delete item.values[key]; renderFields(); });
        }
        button(parent, () => (t("ui.add.another.value.d10e439d")), () => { item.values[''] = undefined; renderFields(); }, values.length >= 8 || values.some(([key]) => !key));
        parent.append(node('p', () => (t("ui.multiple.values.are.sent.as.43bb3602")), 'field-help'));
    }
    function newItem(section, type) {
        if (type === 'device' || type === 'device_value') return {type, device: '', property: '', operator: 'eq'};
        if (type === 'time') return {type, at: '18:00:00', timezone: 'Europe/Berlin'};
        if (type === 'sun') return {type, event: 'sunset', latitude: 0, longitude: 0, offset_minutes: 0, timezone: 'Europe/Berlin'};
        if (type === 'weekday') return {type, weekdays: [1, 2, 3, 4, 5], timezone: 'Europe/Berlin'};
        if (type === 'time_window') return {type, after: '18:00:00', before: '06:00:00', timezone: 'Europe/Berlin'};
        if (type === 'sequence') return {type, sequence_id: '', delay_seconds: 0};
        return {type, target: {type: 'device', id: ''}, delay_seconds: 0, ...(type === 'set' ? {values: {'': undefined}} : type === 'toggle' ? {property: ''} : {})};
    }
    function renderFields() {
        sorting?.dispose(); sorting = null;
        const scroll = dialog.scrollTop;
        const expanded = new Map([...dialog.querySelectorAll('details[data-section]')].map(element => [element.dataset.section, element.open]));
        serial = 0; const root = $('fields'); root.replaceChildren();
        $('reload').hidden = creatingRule && !stale;
        field(root, () => sequenceMode ? t("ui.action.sequence.name.8cc6bff8") : t("ui.automation.name.bf8d6866"), working.name, value => { working.name = value; }, {maxLength: 120});
        const sections = sequenceMode ? [['actions', 'ui.1.actions.in.this.order.91604b88', 'editor.addAction']] : [
            ['triggers', 'editor.when', 'editor.addTrigger'],
            ['conditions', 'editor.onlyIf', 'editor.addCondition'],
            ['actions', 'editor.then', 'editor.addAction']
        ];
        for (const [section, title, addLabel] of sections) {
            const itemKinds = localizeRecord(() => sequenceMode ? Object.fromEntries(Object.entries(kinds.actions).filter(([type]) => type !== 'sequence')) : kinds[section]);
            const details = node('details', undefined, 'edit-section');
            details.dataset.section = section;
            details.open = expanded.get(section) ?? (section !== 'conditions' || working.conditions.length > 0);
            details.append(node('summary', () => t(title)));
            root.append(details);
            const allowed = sequenceMode ? creatingSequence || getData().sequenceSections?.[original.id] === true : creatingRule || getData().editSections?.[original.id]?.[section] === true;
            if (!allowed) {
                details.append(node('p', () => (t("ui.this.section.will.be.preserved.c3e4d5cb")), 'edit-preserved'));
                for (const item of working[section]) details.append(node('p', () => (summaries[section](item)), 'field-help'));
                continue;
            }
            working[section].forEach((item, index) => {
                const row = node('fieldset', undefined, 'edit-row'); row.append(node('legend', () => `${index + 1}. ${kinds[section][item.type]}`)); details.append(row);
                if (section === 'actions') {
                    row.dataset.actionIndex = String(index);
                    if (working.actions.length > 1) {
                        const handle = button(row.querySelector('legend'), () => t("ui.move.c13bd4ff"), () => {});
                        handle.dataset.orderHandle = ''; handle.className = 'action-order-handle';
                        bindAttribute(handle, 'aria-label', () => t("ui.move.action.step.1efaa862", {p1: index + 1}));
                        bindAttribute(handle, 'title', () => t("ui.drag.with.the.mouse.or.7a4a36cb"));
                    }
                }
                const controls = node('div', undefined, 'edit-row-fields'); row.append(controls);
                field(controls, () => (t("ui.entry.type.176dd624")), item.type, type => {
                    const replacement = newItem(section, type);
                    if (section === 'actions') {
                        replacement.delay_seconds = item.delay_seconds ?? 0;
                        if (item.target && type !== 'sequence') replacement.target = copy(item.target);
                    }
                    if (item.timezone && replacement.timezone) replacement.timezone = item.timezone;
                    working[section][index] = replacement; renderFields();
                }, {choices: () => Object.entries(itemKinds)});
                if (item.type === 'device' || item.type === 'device_value') sourceFields(controls, item);
                else if (item.type === 'time') { time(controls, () => (t("ui.time.317f0a69")), item, 'at'); zone(controls, item); }
                else if (item.type === 'sun') {
                    field(controls, () => (t("ui.solar.event.fb338afc")), item.event, value => { item.event = value; }, {choices: () => [['sunrise', t("ui.sunrise.5788b301")], ['sunset', t("ui.sunset.5998441f")]]});
                    number(controls, () => (t("ui.latitude.c5049879")), item, 'latitude', 0, -90, 90, 'any'); number(controls, () => (t("ui.longitude.4c9aacde")), item, 'longitude', 0, -180, 180, 'any');
                    number(controls, () => (t("ui.offset.minutes.b529be97")), item, 'offset_minutes', 0, -720, 720); zone(controls, item);
                } else if (item.type === 'weekday') { weekdays(controls, item); zone(controls, item); }
                else if (item.type === 'time_window') { time(controls, () => (t("ui.from.640e86cb")), item, 'after'); time(controls, () => (t("ui.until.078a8153")), item, 'before'); weekdays(controls, item, true); zone(controls, item); }
                else actionFields(controls, item);
                if (section === 'conditions' || working[section].length > 1) {
                    const tools = node('div', undefined, 'edit-row-tools'); row.append(tools);
                    if (section === 'actions') for (const [delta, text] of [[-1, () => t("ui.move.up.ed16527a")], [1, () => t("ui.move.down.54245735")]]) {
                        button(tools, text, () => reorder(index, index + delta), index + delta < 0 || index + delta >= working[section].length);
                    }
                    button(tools, () => t("ui.remove.entry.706a152e"), () => { working[section].splice(index, 1); renderFields(); });
                }
            });
            const tools = node('div', undefined, 'edit-row-tools'); details.append(tools);
            button(tools, () => t(addLabel), () => {
                working[section].push(newItem(section, Object.keys(itemKinds)[0]));
                renderFields();
                root.querySelector(`details[data-section="${section}"] > fieldset:last-of-type select`)?.focus();
            }, working[section].length >= (section === 'triggers' ? 8 : 16));
            if (section === 'actions' && working.actions.length > 1) {
                details.append(node('p', () => (t("ui.drag.steps.by.the.move.6d048d37")), 'field-help'));
                sorting = installActionSorting(details, {getItems: () => working.actions, canMove: () => !busy && dialog.open, onMove: reorder});
            }
        }
        if (!sequenceMode) {
            const settings = node('details', undefined, 'edit-section');
            settings.dataset.section = 'settings'; settings.open = expanded.get('settings') ?? false;
            settings.append(node('summary', () => t('editor.settings')));
            if (!creatingRule) check(settings, () => t("ui.rule.enabled.in.draft.does.12ebbfe4"), working, 'enabled');
            field(settings, () => t("ui.on.retrigger.7588befa"), working.retrigger ?? 'ignore', value => { working.retrigger = value; }, {choices: () => Object.entries({ignore: t("ui.ignore.0e54a990"), restart: t("ui.restart.from.the.beginning.f723ba35"), extend: t("ui.reset.current.delay.2561f6e5")})});
            field(settings, () => t('restart.label'), working.restart_policy ?? 'abort', value => { working.restart_policy = value; }, {choices: () => [['abort', t('restart.abort')], ['resume', t('restart.resume')], ['resume_expired', t('restart.expired')]]});
            settings.append(node('p', () => t('restart.help'), 'field-help'));
            root.append(settings);
        }
        dialog.scrollTop = scroll;
    }
    function reorder(from, to) {
        const next = moveAction(working.actions, from, to);
        if (next === working.actions) return;
        working.actions = next; renderFields();
        remember();
        hint(() => (t("ui.action.step.moved.to.position.4a6180c0", {p1: from + 1, p2: to + 1})));
        dialog.querySelector(`[data-action-index="${to}"] [data-order-handle]`)?.focus({preventScroll: true});
    }
    const canSave = () => sequenceMode ? (creatingSequence ? getData()?.sequenceCreateAllowed : getData()?.sequenceAllowed) : creatingRule ? getData()?.createAllowed : getData()?.editAllowed;
    const changes = () => sequenceMode ? sequenceChanges(original, working) : ruleChanges(original, working);
    function paintSystem() {
        const name = selectedSystemName(getData());
        const count = getData().configuration?.automations?.length ?? 0;
        bindText($('system'), () => t('wizard.system', {name}) + ' · ' + t('editor.ruleCount', {count}));
    }
    const sameBinding = headers => (!isDesktop() || editorKey() === pendingKey)
        && headers['X-Z2MA-System-ID'] === boundHeaders['X-Z2MA-System-ID']
        && headers['X-Z2MA-Generation'] === boundHeaders['X-Z2MA-Generation']
        && (getData().module?.baseTopic ?? '') === boundTopic;
    function open(entry, sequence = entry.kind === 'sequence', creating = false) {
        sequenceMode = sequence; creatingSequence = creating && sequence; creatingRule = creating && !sequence;
        stale = false;
        bindText($('reload'), () => t("ui.reload.and.discard.input.56f16c4b"));
        original = copy(entry); delete original.kind; working = copy(original);
        if (creatingSequence) working.actions = [newItem('actions', 'set')];
        if (creatingRule) { working.triggers = [newItem('triggers', 'device')]; working.actions = [newItem('actions', 'set')]; }
        context = getData().createContext; requestId = requestIdentity();
        boundHeaders = systemHeaders(getData());
        boundTopic = getData()?.module?.baseTopic ?? '';
        bindText($('title'), () => sequenceMode ? (creatingSequence ? t("ui.new.action.sequence.cc6b663e") : t("ui.edit.action.sequence.2e8a0548")) : creatingRule ? t("ui.new.automation.40e06b5f") : t("ui.edit.automation.ac46d0d5"));
        const eyebrow = dialog.querySelector('.eyebrow');
        eyebrow.hidden = creatingRule;
        bindText(eyebrow, () => sequenceMode ? t('editor.sequenceEyebrow') : t("ui.existing.automation.3d70df71"));
        $('usage').hidden = !sequenceMode;
        paintSystem();
        const usage = (getData().configuration?.automations ?? []).filter(rule => rule.actions.some(action => action.type === 'sequence' && action.sequence_id === original.id)).length;
        bindText($('usage'), () => usage ? t("ui.this.sequence.after.transfer.changes.5c27add8", {p1: usage === 1 ? t("ui.one.automation.uses.ad76d112") : t("ui.automations.use.cd669568", {p1: usage}), p2: usage === 1 ? t("ui.this.rule.262ca3e4") : t("ui.all.these.rules.d3b36f4c")})
            : t("ui.no.automation.uses.this.sequence.2be0e305"));
        $('fields').replaceChildren();
        renderFields(); hint();
        $('export').hidden = $('export-help').hidden = sequenceMode;
        $('export').type = sequenceMode ? 'button' : 'submit';
        $('submit').type = sequenceMode ? 'submit' : 'button';
        $('submit').classList.toggle('primary', sequenceMode);
        bindText($('submit'), () => creatingRule ? t("ui.add.to.draft.disabled.aea3e1b7") : creatingSequence ? t("ui.apply.action.sequence.to.draft.e6ecbfcd") : t("ui.apply.changes.to.draft.1e42a9b6"));
        $('submit').disabled = $('export').disabled = !canSave();
        if (!dialog.open) dialog.showModal();
        $('fields').querySelector('input')?.focus();
        if (isDesktop()) { pendingKey = editorKey(); remember(); document.dispatchEvent(new CustomEvent('z2ma-editor-pending', {detail: true})); }
    }
    editButton.addEventListener('click', () => { const entry = getRule(); if (entry?.triggers || entry?.kind === 'sequence') open(entry); });
    const newRule = () => open({id: '', name: '', enabled: false, retrigger: 'ignore', restart_policy: 'abort', triggers: [], conditions: [], actions: []}, false, true);
    async function startCreation() {
        if (startingCreation || dialog.open) return;
        startingCreation = true;
        try {
            if (isDesktop() && getData()?.desktop?.source === 'stored' && !await switchToDraft()) return;
            if (getData()?.createAllowed && !dialog.open) newRule();
        } finally { startingCreation = false; }
    }
    createButton.addEventListener('click', startCreation);
    sidebarCreate.addEventListener('click', startCreation);
    sequenceButton.addEventListener('click', () => { if (getData()?.sequenceCreateAllowed) open({id: '', name: '', actions: []}, true, true); });
    $('cancel').addEventListener('click', () => { if (!busy) dialog.close(); });
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    $('reload').addEventListener('click', async () => {
        if (creatingRule) {
            if (busy || !stale) return;
            busy = true;
            $('reload').disabled = true;
            try {
                if (await reload() && getData()?.createAllowed) {
                    const headers = systemHeaders(getData());
                    if (sameBinding(headers)) {
                        context = getData().createContext; boundHeaders = headers;
                        stale = false; paintSystem(); renderFields(); remember();
                        hint(() => t('wizard.refreshed'));
                        return;
                    }
                }
                hint(() => t('wizard.refreshFailed'));
            } finally {
                busy = false;
                $('reload').disabled = false;
                $('submit').disabled = $('export').disabled = stale || !canSave();
                if (!stale) $('export').focus();
            }
            return;
        }
        if (busy || (Object.keys(changes()).length && !confirm(t("ui.discard.your.input.and.load.d4dbc666")))) return;
        if (await reload() && sameBinding(systemHeaders(getData()))) {
            if (creatingSequence) { open({id: '', name: '', actions: []}, true, true); return; }
            const entry = (sequenceMode ? getData().configuration?.sequences : getData().configuration?.automations)?.find(item => item.id === original.id);
            if (entry) open(entry, sequenceMode); else { hint(() => t("ui.this.entry.has.since.been.e34960cd")); $('submit').disabled = $('export').disabled = true; }
        }
        else hint(() => (t("ui.the.view.could.not.be.3bee7031")));
    });
    function clearFieldError(input) {
        if (!input.hasAttribute('aria-invalid')) return;
        input.parentElement.querySelector('.edit-field-error')?.remove();
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
    }
    function validFields() {
        let first;
        for (const input of $('fields').querySelectorAll('input, select')) {
            clearFieldError(input);
            const blank = input.validity.valueMissing || (input.type === 'text' && input.required && !input.value.trim());
            if (!input.willValidate || (!blank && input.validity.valid && !input.selectedOptions?.[0]?.disabled)) continue;
            const error = node('span', () => t(blank ? 'editor.fieldRequired' : 'editor.fieldInvalid'), 'edit-field-error');
            error.id = input.id + '-error';
            input.parentElement.append(error);
            input.setAttribute('aria-invalid', 'true');
            input.setAttribute('aria-describedby', error.id);
            const section = input.closest('details');
            if (section) section.open = true;
            first ??= input;
        }
        if (!first) return true;
        hint(() => t('editor.checkFields'));
        first.focus();
        return false;
    }
    function downloadYaml(yaml) {
        if (typeof yaml !== 'string' || !yaml || yaml.length > 131072) throw new Error('invalid export');
        const url = URL.createObjectURL(new Blob([yaml], {type: 'application/yaml;charset=utf-8'}));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'automations.yaml';
        dialog.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    async function apply(exporting) {
        if (busy || stale || !canSave() || !validFields()) return;
        const payload = {requestId: exporting ? requestIdentity() : requestId, context,
            ...(creatingRule ? {rule: creationRule(working)} : {[sequenceMode ? 'sequenceId' : 'ruleId']: original.id, changes: changes()})};
        const controls = [...dialog.querySelectorAll('button, input, select')].map(element => [element, element.disabled]);
        busy = true; for (const [element] of controls) element.disabled = true;
        hint(() => t(exporting ? 'editor.exporting' : 'ui.checking.changes.and.applying.them.1a7c8c07'));
        const controller = new AbortController();
        const timer = exporting && isDesktop() ? null : setTimeout(() => controller.abort(), 15000);
        try {
            const route = sequenceMode ? 'sequence' : creatingRule ? 'create' : 'edit';
            const endpoint = new URL(exporting ? route + '-yaml' : route, location.href); endpoint.hash = '';
            const response = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Z2MA-Read-Token': location.hash.slice(1), ...boundHeaders}, body: JSON.stringify(payload), credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal});
            const text = await response.text();
            if (text.length > (exporting && response.ok ? 1048576 : 4096)) throw new Error('transport');
            const result = localizeResponse(JSON.parse(text));
            if (!response.ok) {
                if (!sequenceMode && (isDesktop() ? result.error === 'draftStale' : response.status === 409)) {
                    stale = true;
                    if (creatingRule) bindText($('reload'), () => t('wizard.refresh'));
                    $('reload').hidden = false;
                    hint(() => !isDesktop() && result.message ? result.message : t(creatingRule ? 'wizard.stale' : 'editor.staleEdit'));
                } else hint(() => result.message || t(exporting ? 'editor.exportFailed' : 'ui.the.change.could.not.be.dbe4cffb'));
                return;
            }
            if (exporting) {
                if (!isDesktop()) downloadYaml(result.yaml);
                else if (result.ok !== true) throw new Error('invalid export');
                hint(() => t(result.canceled ? 'editor.exportCanceled' : isDesktop() ? 'editor.exported' : 'editor.downloadStarted'));
                return;
            }
            dialog.close(); if (sequenceMode) await onSequenceSaved(result.sequenceId); else if (creatingRule) await onCreated(result.ruleId); else await onEdited(result.ruleId);
        } catch { hint(() => t(exporting ? 'editor.exportFailed' : 'ui.no.confirmation.from.the.module.7daee70c')); }
        finally {
            clearTimeout(timer); busy = false;
            for (const [element, disabled] of controls) element.disabled = disabled;
            if (dialog.open && (exporting || stale)) {
                $('message').scrollIntoView({block: 'nearest'});
                if (stale) {
                    $('submit').disabled = $('export').disabled = true;
                    $('reload').focus({preventScroll: true});
                } else $('export').focus({preventScroll: true});
            }
        }
    }
    $('submit').addEventListener('click', () => { if (!sequenceMode) void apply(false); });
    $('form').addEventListener('submit', event => {
        event.preventDefault();
        void apply(!sequenceMode);
    });
    return {refresh() {
        if (isDesktop() && getData()?.desktop?.project) {
            const key = editorKey();
            if (!dialog.open && !recovered.has(key)) {
                recovered.add(key);
                try {
                    const raw = sessionStorage.getItem(key);
                    if (raw && raw.length <= 131072) {
                        const saved = JSON.parse(raw);
                        if (saved.epoch === getData().desktop.epoch && saved.original && saved.working && typeof saved.requestId === 'string') {
                            open(saved.original, saved.sequenceMode, saved.creatingSequence || saved.creatingRule);
                            original = saved.original; working = saved.working; context = saved.context; requestId = saved.requestId; boundHeaders = saved.boundHeaders;
                            boundTopic = saved.boundTopic ?? boundTopic;
                            renderFields(); remember();
                        } else sessionStorage.removeItem(key);
                    }
                } catch { /* Invalid temporary editor state is never applied to a project. */ }
            }
        }
        const data = getData();
        const fromStored = isDesktop() && data?.desktop?.project && data.workspaceContext?.systemId && data.desktop.source === 'stored';
        sidebarCreate.disabled = !data?.createAllowed && !fromStored;
        entryNotice.hidden = !data || !sidebarCreate.disabled;
        bindText(entryNotice, () => data?.createNotice || t(isDesktop() ? 'wizard.setupNeeded' : 'wizard.noDraft'));
        createButton.disabled = !getData()?.createAllowed;
        createButton.title = getData()?.createNotice || t("ui.create.a.complete.automation.as.dfe84ce2");
        const sequence = getRule()?.kind === 'sequence';
        bindText(editButton, () => sequence ? t("ui.edit.action.sequence.2e8a0548") : t("ui.edit.automation.ac46d0d5"));
        editButton.disabled = sequence ? !getData()?.sequenceAllowed : !getRule()?.triggers || !getData()?.editAllowed;
        editButton.title = (sequence ? getData()?.sequenceNotice : getData()?.editNotice) || t("ui.edit.the.selected.entry.in.d6589128");
        sequenceButton.disabled = !getData()?.sequenceCreateAllowed;
        sequenceButton.title = getData()?.sequenceNotice || (!getData()?.sequenceCreateAllowed ? t("ui.at.most.32.action.sequences.ffacfca9") : t("ui.create.a.new.action.sequence.26a16dfc"));
    }};
}
