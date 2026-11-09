import {t, bindText, bindHTML, bindAttribute, localizedOption, localizeRecord, MessageError, ResponseError, locale, formatDate, formatNumber, onLanguageChange, installLanguagePicker, localizeResponse} from './localization.js';
/* Own, offline interaction prototype. No Symcon, MQTT or device access. */
(async () => {
    'use strict';
    installLanguagePicker();
    const {createUUID} = await import('./identity.js');
    const $ = selector => document.querySelector(selector);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
    const icon = name => `<svg aria-hidden="true"><use href="#icon-${name}"/></svg>`;
    const clone = value => structuredClone(value);
    const uid = () => createUUID();
    const property = (id, label, type, values, writable = false) => ({id, label, type, values, writable});
    const catalog = [
        {id: 'demo.motion', name: 'Demo-Bewegungsmelder', room: 'Eingangsbereich', properties: [property('occupancy', 'Bewegung', 'boolean', [true, false])]},
        {id: 'demo.brightness', name: 'Demo-Helligkeitssensor', room: 'Außenbereich', properties: [property('illuminance', 'Beleuchtungsstärke', 'number', [], false)]},
        {id: 'demo.temperature', name: 'Demo-Raumsensor', room: 'Wohnbereich', properties: [property('temperature', 'Temperatur', 'number', [], false)]},
        {id: 'demo.lamp', name: 'Demo-Leuchte', room: 'Eingangsbereich', properties: [property('state', 'Schaltzustand', 'enum', ['ON', 'OFF', 'TOGGLE'], true), property('brightness', 'Helligkeit', 'number', [], true)]},
        {id: 'demo.switch', name: 'Demo-Schaltaktor', room: 'Arbeitszimmer', properties: [property('state_l1', 'Kanal 1', 'enum', ['ON', 'OFF', 'TOGGLE'], true), property('state_l2', 'Kanal 2', 'enum', ['ON', 'OFF', 'TOGGLE'], true)]},
        {id: 'demo.group', name: 'Demo-Lichtgruppe', room: 'Wohnbereich', properties: [property('state', 'Schaltzustand', 'enum', ['ON', 'OFF', 'TOGGLE'], true)], scenes: [{id: '3', name: 'Gedimmtes Licht'}, {id: '7', name: 'Leselicht'}]}
    ];
    const initial = [
        {id: 'demo.motion-rule', kind: 'device', name: 'Licht bei Bewegung', enabled: true, retrigger: 'extend',
            triggers: [{id: 'demo.trigger', device: 'demo.motion', property: 'occupancy', compare: 'eq', value: true, hold: 0, changed: false}],
            conditions: [{id: 'demo.condition', device: 'demo.brightness', property: 'illuminance', compare: 'lt', value: 100, startOnly: true}],
            actions: [{id: 'demo.on', type: 'set', device: 'demo.lamp', property: 'state', value: 'ON', delay: 0}, {id: 'demo.off', type: 'set', device: 'demo.lamp', property: 'state', value: 'OFF', delay: 60}]},
        {id: 'demo.button-rule', kind: 'device', name: 'Zweiten Kanal schalten', enabled: false, retrigger: 'ignore',
            triggers: [{id: 'demo.other-trigger', device: 'demo.motion', property: 'occupancy', compare: 'eq', value: true, hold: 0, changed: true}], conditions: [],
            actions: [{id: 'demo.channel', type: 'set', device: 'demo.switch', property: 'state_l2', value: 'ON', delay: 0}]},
        {id: 'demo.clock-rule', kind: 'time', name: 'Abendstimmung', enabled: false, retrigger: 'ignore',
            schedule: {mode: 'clock', at: '18:00, 21:30', timezone: 'Europe/Berlin', offset: 0, weekdays: [1, 2, 3, 4, 5, 6, 7]}, conditions: [],
            actions: [{id: 'demo.scene', type: 'scene', device: 'demo.group', scene: '3', delay: 0}]},
        {id: 'demo.sequence', kind: 'sequence', name: 'Kurzes Lichtsignal', actions: [
            {id: 'demo.sequence-on', type: 'set', device: 'demo.lamp', property: 'state', value: 'ON', delay: 0},
            {id: 'demo.sequence-off', type: 'set', device: 'demo.lamp', property: 'state', value: 'OFF', delay: 5}]}
    ];
    let entries = clone(initial);
    let saved = clone(initial);
    let selected = {entry: initial[0].id, kind: 'condition', item: 'demo.condition'};
    let category = 'device';
    let verified = null;
    let running = false;
    let runningEntries = [];
    let dragged = null;
    let confirmation = null;
    let activity = [];
    const categoryNames = {device: t("ui.device.triggered.082d7271"), time: t("ui.time.solar.63529d1e"), sequence: t("ui.action.sequences.9d9eee7e")};
    const categoryIcons = {device: 'device', time: 'clock', sequence: 'flow'};
    const compareNames = {eq: t("ui.is.equal.to.456b1261"), ne: t("ui.is.not.equal.to.c72da4b0"), gt: t("ui.is.greater.than.c23edfd9"), gte: t("ui.is.at.least.8adebfa3"), lt: t("ui.is.less.than.f2641c8f"), lte: t("ui.is.at.most.53bbaac0")};
    const current = () => entries.find(entry => entry.id === selected.entry) ?? null;
    const deviceById = id => catalog.find(device => device.id === id);
    const metaFor = item => deviceById(item.device)?.properties.find(meta => meta.id === item.property);
    const serial = value => JSON.stringify(value);
    const valueText = value => ({ON: t("ui.on.b9a637bc"), OFF: t("ui.off.f0ce9450"), TOGGLE: t("ui.toggle.77fec02e"), true: t("ui.detected.652dc92d"), false: t("ui.not.detected.1fee3a21")}[String(value)] ?? String(value));
    const listFor = kind => ({trigger: 'triggers', condition: 'conditions', action: 'actions'}[kind]);
    const selectedItem = () => selected.kind === 'rule' ? current() : selected.kind === 'schedule' ? current()?.schedule : current()?.[listFor(selected.kind)]?.find(item => item.id === selected.item);

    function note(message, tone = 'info') {
        bindText($('#feedback'), () => message);
        $('#feedback').dataset.tone = tone;
        activity.unshift({time: new Date().toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'}), message});
        activity = activity.slice(0, 30);
        bindText($('#activity-count'), () => String(activity.length));
        bindHTML($('#activity-list'), () => activity.map(item => `<li><time>${esc(item.time)}</time> · ${esc(item.message)}</li>`).join(''));
    }

    function summary(entry) {
        if (entry.kind === 'sequence') return t("ui.actions.reusable.c73b4955", {p1: entry.actions.length});
        if (entry.kind === 'time') return entry.schedule.mode === 'clock' ? t("ui.time.4e1d0e40", {p1: entry.schedule.at || 'noch offen'}) : t("ui.minutes.ea0dcbba", {p1: entry.schedule.mode === 'sunrise' ? t("ui.sunrise.5788b301") : t("ui.sunset.5998441f"), p2: entry.schedule.offset >= 0 ? '+' : '', p3: entry.schedule.offset});
        const first = entry.triggers[0];
        return first ? `${deviceById(first.device)?.name ?? t("ui.choose.device.71684578")}${entry.triggers.length > 1 ? ` + ${entry.triggers.length - 1} weitere` : ''}` : t("ui.no.trigger.yet.a04f178c");
    }

    function renderNavigation() {
        bindText($('#entry-count'), () => String(entries.filter(entry => entry.kind !== 'sequence').length));
        bindHTML($('#categories'), () => Object.keys(categoryNames).map(kind => `<button class="category ${category === kind ? 'active' : ''}" data-action="category" data-kind="${kind}" aria-pressed="${category === kind}">${icon(categoryIcons[kind])}${categoryNames[kind]}<span class="category-count">${entries.filter(entry => entry.kind === kind).length}</span></button>`).join(''));
        const query = $('#search').value.trim().toLocaleLowerCase('de-DE');
        const matches = entries.filter(entry => entry.kind === category && `${entry.name} ${summary(entry)} ${entry.actions.map(action => deviceById(action.device)?.name ?? '').join(' ')}`.toLocaleLowerCase('de-DE').includes(query));
        bindText($('#list-label'), () => categoryNames[category]);
        bindText($('#list-count'), () => String(matches.length));
        bindHTML($('#entry-list'), () => matches.length ? matches.map(entry => `<button class="entry ${selected.entry === entry.id ? 'active' : ''}" data-action="entry" data-id="${esc(entry.id)}" aria-pressed="${selected.entry === entry.id}"><span class="entry-title-row"><strong>${esc(entry.name || t("ui.unnamed.72fd207a"))}</strong>${entry.kind !== 'sequence' ? `<span class="enabled-dot ${entry.enabled ? 'on' : ''}" aria-label="${t("draft.in")} ${entry.enabled ? t("ui.enabled.aae668f6") : t("ui.disabled.1fa013fd")}"></span>` : ''}</span><small>${esc(summary(entry))}</small></button>`).join('') : `<p class="empty-list">${t("ui.there.is.no.matching.entry.ea811c29")}</p>`);
    }

    function section(title, type, count, content, addKind) {
        return `<section class="flow-section ${type}-section"><div class="section-title"><span class="section-symbol">${icon({when: 'device', condition: 'condition', action: 'bolt'}[type])}</span><h3>${title}</h3><small>${count}</small></div>${content}${addKind ? `<button class="add-block" data-action="add" data-kind="${addKind}">${icon('plus')}${{trigger: t("ui.add.another.trigger.7d93e1db"), condition: t("ui.add.condition.dc4f4de5"), action: t("ui.add.action.5c9a7438")}[addKind]}</button>` : ''}</section>`;
    }

    function card(kind, item, title, detail, index, tag = '') {
        const active = selected.kind === kind && selected.item === item.id;
        const isAction = kind === 'action';
        return `<div class="flow-card ${active ? 'selected' : ''}" data-action="block" data-kind="${kind}" data-id="${esc(item.id)}" tabindex="0" role="button" aria-label="${esc(`${title}: ${detail}`)}" aria-pressed="${active}">
            ${isAction ? `<span class="grip" aria-hidden="true">${icon('grip')}</span>` : ''}<span class="card-mark">${icon({trigger: 'device', condition: 'condition', action: item.type === 'sequence' ? 'flow' : 'bolt'}[kind])}</span>
            <div class="card-content"><strong>${esc(title)}</strong><p>${esc(detail)}</p>${tag ? `<span class="card-tag">${esc(tag)}</span>` : ''}</div>
            ${isAction ? `<div class="order-buttons"><button class="icon-button up" data-action="move" data-id="${esc(item.id)}" data-direction="-1" aria-label="${t("ui.move.action.up.5c869e3d", {p1: index + 1})}" ${index === 0 ? 'disabled' : ''}>${icon('arrow')}</button><button class="icon-button" data-action="move" data-id="${esc(item.id)}" data-direction="1" aria-label="${t("ui.move.action.down.21e01dfe", {p1: index + 1})}" ${index === current().actions.length - 1 ? 'disabled' : ''}>${icon('arrow')}</button></div>` : `<span class="card-number">${index + 1}</span>`}
        </div>`;
    }

    function renderFlow() {
        const entry = current();
        if (!entry) {
            bindText($('#entry-title'), () => t("ui.your.next.automation.9c8a7e6e"));
            bindText($('#entry-subtitle'), () => t("ui.create.a.new.entry.on.47002f92"));
            bindText($('#entry-type'), () => categoryNames[category].toUpperCase());
            bindHTML($('#flow'), () => `<p class="sequence-note">${t("ui.no.entry.selected.yet.use.8944033c")}</p>`);
            document.querySelectorAll('.entry-tools button').forEach(button => { button.disabled = true; });
            return;
        }
        document.querySelectorAll('.entry-tools button').forEach(button => { button.disabled = false; });
        bindText($('#entry-type'), () => categoryNames[entry.kind].toUpperCase());
        bindText($('#entry-title'), () => entry.name || t("ui.unnamed.72fd207a"));
        bindText($('#entry-subtitle'), () => entry.kind === 'sequence' ? t("ui.define.once.and.reuse.in.c70176e8") : `${entry.enabled ? t("ui.enabled.in.draft.6ef5de7b") : t("ui.disabled.in.draft.9b6be97a")} · ${entry.actions.length} ${entry.actions.length === 1 ? t("ui.action.a4ad259e") : t("ui.actions.5656f92d")} · ${entry.conditions.length} ${entry.conditions.length === 1 ? t("ui.condition.c1d1da5a") : t("ui.conditions.8c667eee")}`);
        let content = '';
        if (entry.kind === 'device') {
            const triggers = entry.triggers.map((item, index) => card('trigger', item, deviceById(item.device)?.name ?? t("ui.choose.device.71684578"), `${metaFor(item)?.label ?? t("ui.choose.property.cb4be4ea")} ${compareNames[item.compare]} ${valueText(item.value)}${item.hold ? t("ui.for.seconds.3dab9d50", {p1: item.hold}) : ''}`, index)).join(`<div class="or-label">${t("ui.or.43e40606")}</div>`);
            content += section(t("ui.1.when.91055bf0"), 'when', t("ui.8.triggers.35573e29", {p1: entry.triggers.length}), triggers, 'trigger');
        } else if (entry.kind === 'time') {
            const active = selected.kind === 'schedule';
            content += section(t("ui.1.when.91055bf0"), 'when', t("ui.time.9d91e4d4"), `<div class="flow-card ${active ? 'selected' : ''}" data-action="schedule" role="button" tabindex="0" aria-pressed="${active}"><span class="card-mark">${icon('clock')}</span><div class="card-content"><strong>${entry.schedule.mode === 'clock' ? t("ui.when.the.time.is.reached.5701df86") : t("ui.when.the.solar.event.occurs.ae71a2b4")}</strong><p>${esc(summary(entry))} · ${esc(entry.schedule.timezone)}</p></div></div>`);
        } else content += `<p class="sequence-note">${t("ui.this.action.sequence.has.no.323ef506")}</p>`;
        if (entry.kind !== 'sequence') {
            content += `<div class="flow-connector" aria-hidden="true"></div>`;
            content += section(t("ui.2.only.if.d315c02f"), 'condition', 'optional · alle gemeinsam', entry.conditions.map((item, index) => card('condition', item, deviceById(item.device)?.name ?? t("ui.choose.device.71684578"), `${metaFor(item)?.label ?? t("ui.choose.property.cb4be4ea")} ${compareNames[item.compare]} ${valueText(item.value)}${item.property === 'illuminance' ? ' Lux' : ''}`, index, item.startOnly ? t("ui.only.at.start.cc0a97a5") : t("ui.also.applies.while.running.c03f17ee"))).join(''), 'condition');
        }
        if (entry.kind !== 'sequence') content += `<div class="flow-connector" aria-hidden="true"></div>`;
        content += section(`${entry.kind === 'sequence' ? '' : '3 · '}DANN`, 'action', t("ui.16.actions.ad1c90ae", {p1: entry.actions.length}), entry.actions.map((item, index) => {
            const title = item.type === 'sequence' ? entries.find(candidate => candidate.id === item.sequence)?.name ?? t("ui.choose.action.sequence.fbf23cb8") : deviceById(item.device)?.name ?? t("ui.choose.device.71684578");
            const action = item.type === 'scene' ? t("ui.scene.e20aaa89", {p1: deviceById(item.device)?.scenes?.find(scene => scene.id === item.scene)?.name ?? t("ui.choose.e11cb91a")}) : item.type === 'sequence' ? t("ui.run.action.sequence.5a5f7934") : `${metaFor(item)?.label ?? t("ui.choose.property.cb4be4ea")}: ${valueText(item.value)}`;
            return card('action', item, title, t("ui.text.db1b0c15", {p1: action, p2: item.delay ? t("ui.wait.seconds.first.3fe0785b", {p1: item.delay}) : t("ui.run.immediately.ce406486")}), index);
        }).join(''), 'action');
        bindHTML($('#flow'), () => content);
    }

    const options = (values, value) => values.map(option => `<option value="${esc(option.value)}" ${String(option.value) === String(value) ? 'selected' : ''}>${esc(option.label)}</option>`).join('');
    const selectField = (label, field, values, value) => `<label class="field">${label}<select data-field="${field}">${options(values, value)}</select></label>`;
    const inputField = (label, field, value, type = 'text', extra = '') => `<label class="field">${label}<input data-field="${field}" type="${type}" value="${esc(value)}" ${extra}></label>`;
    const checkField = (label, field, value) => `<label class="check-field"><input type="checkbox" data-field="${field}" ${value ? 'checked' : ''}><span>${label}</span></label>`;
    const deviceOptions = mode => catalog.filter(device => mode === 'scene' ? device.scenes?.length : mode !== 'action' || device.properties.some(meta => meta.writable)).map(device => ({value: device.id, label: t("ui.text.db1b0c15", {p1: device.name, p2: device.room})}));

    function deviceFields(item, kind) {
        const device = deviceById(item.device);
        const properties = device?.properties.filter(meta => kind !== 'action' || meta.writable) ?? [];
        const meta = metaFor(item);
        let html = selectField(t("ui.device.b32db786"), 'device', deviceOptions(kind), item.device);
        html += selectField(t("ui.property.channel.b524f965"), 'property', properties.map(p => ({value: p.id, label: p.label})), item.property);
        if (kind !== 'action') html += selectField(t("ui.comparison.79a63c24"), 'compare', Object.entries(compareNames).filter(([key]) => meta?.type === 'number' || ['eq', 'ne'].includes(key)).map(([value, label]) => ({value, label})), item.compare);
        if (meta?.type === 'number') html += inputField(t("ui.value.6227da8f", {p1: item.property === 'illuminance' ? ' in Lux' : item.property === 'temperature' ? ' in °C' : ''}), 'value', item.value, 'number', 'step="any"');
        else html += selectField(t("ui.value.7e347daa"), 'value', (meta?.values ?? []).filter(value => kind === 'action' || value !== 'TOGGLE').map(value => ({value, label: valueText(value)})), item.value);
        return html;
    }

    function renderInspector() {
        const entry = current();
        const item = selectedItem();
        let html = '';
        let title = t("ui.automation.d909750b");
        let subtitle = t("ui.choose.an.entry.on.the.bd05ff21");
        if (entry && selected.kind === 'rule') {
            title = entry.kind === 'sequence' ? t("ui.action.sequence.35690788") : t("ui.automation.d909750b");
            subtitle = t("ui.name.and.behaviour.of.the.c1dd0e9d");
            html = inputField(t("ui.name.dcd1d522"), 'name', entry.name, 'text', 'maxlength="120" autocomplete="off"');
            if (entry.kind !== 'sequence') {
                html += checkField(t("ui.rule.enabled.in.draft.380049b5"), 'enabled', entry.enabled);
                html += `<hr class="inspector-separator"><div class="field-group-title">${t("ui.on.retrigger.615e2e43")}</div>`;
                html += selectField(t("ui.if.the.sequence.is.already.98203a4a"), 'retrigger', [{value: 'ignore', label: t("ui.ignore.new.trigger.0724102c")}, {value: 'restart', label: t("ui.restart.from.the.beginning.f723ba35")}, {value: 'extend', label: t("ui.reset.current.delay.2561f6e5")}], entry.retrigger);
                html += `<p class="field-help">${t("ui.reset.restarts.only.the.current.71762019")}</p>`;
            }
            html += `<div class="inspector-note">${t("ui.changes.belong.to.the.draft.161c34d7")}</div>`;
        } else if (entry && selected.kind === 'schedule') {
            title = t("ui.edit.time.04a85400"); subtitle = t("ui.times.or.solar.events.for.6638b761");
            html = selectField(t("ui.trigger.at.83714ddd"), 'mode', [{value: 'clock', label: t("ui.fixed.times.f29a3de6")}, {value: 'sunrise', label: t("ui.sunrise.5788b301")}, {value: 'sunset', label: t("ui.sunset.5998441f")}], item.mode);
            html += item.mode === 'clock' ? inputField(t("ui.times.a8b73e7e"), 'at', item.at, 'text', 'placeholder="07:00, 18:30"') + `<p class="field-help">${t("ui.up.to.eight.times.separated.0bd5a41c")}</p>` : inputField(t("ui.offset.in.minutes.b41363aa"), 'offset', item.offset, 'number', 'min="-720" max="720" step="1"') + `<p class="field-help">${t("ui.negative.means.before.positive.means.0783a8bf")}</p>`;
            html += selectField(t("ui.time.zone.00507b23"), 'timezone', [{value: 'Europe/Berlin', label: 'Europe/Berlin'}, {value: 'UTC', label: 'UTC'}], item.timezone);
            html += `<div class="field-group-title">${t("ui.allowed.weekdays.fabc555f")}</div><div class="days">` + [t("ui.mon.d23e867e"), t("ui.tue.16ab7287"), t("ui.wed.d8f33a13"), t("ui.thu.30094e0b"), t("ui.fri.eed8f901"), t("ui.sat.a951efc7"), t("ui.sun.fb1df1a2")].map((day, i) => `<label class="day"><input type="checkbox" data-day="${i + 1}" ${item.weekdays.includes(i + 1) ? 'checked' : ''} aria-label="${[t("ui.monday.b703fc6a"), t("ui.tuesday.c2e102ca"), t("ui.wednesday.76c93ad1"), t("ui.thursday.b15c4daa"), t("ui.friday.5815ddf1"), t("ui.saturday.7c22aad8"), t("ui.sunday.a5984592")][i]}"><span>${day}</span></label>`).join('') + `</div>`;
        } else if (entry && item) {
            title = {trigger: t("ui.edit.trigger.0de2bc81"), condition: t("ui.edit.condition.8884e2a8"), action: t("ui.edit.action.3a0e9784", {p1: entry.actions.indexOf(item) + 1})}[selected.kind];
            subtitle = {trigger: t("ui.each.trigger.can.start.the.9e5996af"), condition: t("ui.this.requirement.restricts.execution.741ae9db"), action: t("ui.the.order.determines.execution.f1a021f4")}[selected.kind];
            if (selected.kind === 'action') {
                const kinds = localizeRecord(() => ([{value: 'set', label: t("ui.control.a.device.or.channel.4bc0fdfb")}, {value: 'scene', label: t("ui.recall.existing.scene.a1b5866e")}]));
                if (entry.kind !== 'sequence') kinds.push({value: 'sequence', label: t("ui.use.action.sequence.466ffa2c")});
                html += selectField(t("ui.action.type.3bfb90d7"), 'type', kinds, item.type);
                if (item.type === 'sequence') html += selectField(t("ui.action.sequence.35690788"), 'sequence', entries.filter(candidate => candidate.kind === 'sequence' && candidate.id !== entry.id).map(candidate => ({value: candidate.id, label: candidate.name})), item.sequence);
                else if (item.type === 'scene') {
                    html += selectField(t("ui.device.group.fe09aa58"), 'device', deviceOptions('scene'), item.device);
                    html += selectField(t("ui.scene.7e27863f"), 'scene', (deviceById(item.device)?.scenes ?? []).map(scene => ({value: scene.id, label: scene.name})), item.scene);
                } else html += deviceFields(item, 'action');
                html += `<hr class="inspector-separator">` + inputField(t("ui.delay.before.this.step.seconds.75c3c7fe"), 'delay', item.delay, 'number', 'min="0" max="86400" step="1"');
                html += `<p class="field-help">${t("ui.0.means.immediately.the.delay.a4fa5bb8")}</p>`;
            } else {
                html += deviceFields(item, selected.kind);
                if (selected.kind === 'trigger') {
                    html += inputField(t("ui.minimum.duration.seconds.17226a17"), 'hold', item.hold, 'number', 'min="0" max="86400" step="1"');
                    html += checkField(t("ui.trigger.only.on.a.value.4a9adf10"), 'changed', item.changed);
                } else {
                    html += `<hr class="inspector-separator">` + checkField(t("ui.check.only.at.start.a6aa3b78"), 'startOnly', item.startOnly);
                    html += `<p class="field-help">${t("ui.useful.for.brightness.it.restricts.1ff928b1")}</p>`;
                }
            }
            html += `<button class="delete-block" data-action="remove-block">${t("ui.remove.1b63b78b", {p1: icon('trash'), p2: {trigger: t("ui.trigger.9137c3bf"), condition: t("ui.condition.c1d1da5a"), action: t("ui.action.a4ad259e")}[selected.kind]})}</button>`;
        }
        bindText($('#inspector-title'), () => title);
        bindText($('#inspector-subtitle'), () => subtitle);
        bindHTML($('#inspector-fields'), () => html || `<p class="field-help">${t("ui.settings.for.the.selected.block.06909019")}</p>`);
    }

    function renderStatus() {
        const same = serial(entries) === serial(saved);
        const checked = verified === serial(entries);
        bindText($('#draft-status'), () => !same ? checked ? t("ui.changes.checked.not.saved.yet.8b8f827e") : t("ui.draft.changed.not.checked.yet.3781065e") : checked ? t("ui.preview.checked.and.saved.7c21b116") : t("ui.examples.loaded.7f04889d"));
        $('#draft-status').className = `status-chip ${!same ? 'dirty' : checked ? 'valid' : ''}`;
        $('#runtime-status').className = `runtime-chip ${running ? 'running' : ''}`;
        const enabledCount = runningEntries.filter(entry => entry.kind !== 'sequence' && entry.enabled).length;
        bindHTML($('#runtime-status'), () => `<i></i>${running ? t("ui.example.operation.running.a0282bd0", {p1: enabledCount, p2: enabledCount === 1 ? t("ui.rule.4b09cd01") : t("ui.rules.582936c9")}) : t("ui.example.operation.stopped.db6cb2d6")}`);
        $('#save-button').disabled = !checked;
        $('#activate-button').disabled = !checked || !same || running;
        $('#stop-button').disabled = !running;
    }

    function render(inspector = true) {
        renderNavigation(); renderFlow(); renderStatus();
        if (inspector) renderInspector();
    }

    function changed(rebuildInspector = false) {
        verified = null;
        $('#issues').hidden = true;
        render(rebuildInspector);
    }

    function choose(entryId, kind = 'rule', itemId = '') {
        const entry = entries.find(candidate => candidate.id === entryId);
        if (!entry) return;
        category = entry.kind;
        selected = {entry: entryId, kind, item: itemId};
        render();
    }

    function updateField(field, value, control) {
        const item = selectedItem();
        if (!item) return;
        let rebuild = false;
        if (field === 'type') {
            const replacement = value === 'scene' ? {type: 'scene', device: 'demo.group', scene: '3'} : value === 'sequence' ? {type: 'sequence', sequence: entries.find(entry => entry.kind === 'sequence')?.id ?? ''} : {type: 'set', device: 'demo.lamp', property: 'state', value: 'ON'};
            const previous = {id: item.id, delay: item.delay};
            Object.keys(item).forEach(key => { delete item[key]; });
            Object.assign(item, previous, replacement); rebuild = true;
        } else if (field === 'device' || field === 'property') {
            item[field] = value;
            const device = deviceById(item.device);
            if (item.type === 'scene') item.scene = device?.scenes?.[0]?.id ?? '';
            else {
                const meta = field === 'device' ? device?.properties.find(p => selected.kind !== 'action' || p.writable) : metaFor(item);
                item.property = meta?.id ?? '';
                item.value = meta?.type === 'number' ? 0 : meta?.values[0];
                if (selected.kind !== 'action') item.compare = 'eq';
            }
            rebuild = true;
        } else if (field === 'value') {
            const meta = metaFor(item);
            item.value = meta?.type === 'number' ? (value === '' ? null : Number(value)) : meta?.type === 'boolean' ? value === 'true' : value;
        } else if (control.type === 'checkbox') item[field] = control.checked;
        else if (control.type === 'number') item[field] = value === '' ? null : Number(value);
        else { item[field] = value; rebuild = field === 'mode'; }
        changed(rebuild);
    }

    function add(kind) {
        const entry = current(); if (!entry) return;
        const list = entry[listFor(kind)];
        if (!list || list.length >= (kind === 'trigger' ? 8 : 16)) { note(t("ui.the.maximum.number.has.been.229b60f7"), 'error'); return; }
        const item = kind === 'trigger' ? {id: uid(), device: 'demo.motion', property: 'occupancy', compare: 'eq', value: true, hold: 0, changed: false} : kind === 'condition' ? {id: uid(), device: 'demo.brightness', property: 'illuminance', compare: 'lt', value: 100, startOnly: false} : {id: uid(), type: 'set', device: 'demo.lamp', property: 'state', value: 'ON', delay: 0};
        list.push(item); selected = {entry: entry.id, kind, item: item.id}; changed(true);
        note(t("ui.block.added.its.settings.are.12857d5b"));
    }

    function move(id, destination) {
        const entry = current(); if (!entry) return;
        const from = entry.actions.findIndex(item => item.id === id);
        if (from < 0 || destination < 0 || destination >= entry.actions.length || from === destination) return;
        const [item] = entry.actions.splice(from, 1); entry.actions.splice(destination, 0, item);
        selected = {entry: entry.id, kind: 'action', item: id}; changed(true);
        note(t("ui.action.moved.its.delay.has.962975a1"));
    }

    function inspect() {
        const issues = [];
        const issue = (entry, message, kind = 'rule', item = '') => issues.push({entry: entry.id, message: `${entry.name || t("ui.unnamed.72fd207a")}: ${message}`, kind, item});
        const duration = value => Number.isInteger(value) && value >= 0 && value <= 86400;
        for (const entry of entries) {
            if (!entry.name.trim() || entry.name.length > 120) issue(entry, t("ui.enter.a.name.with.at.44181fa0"));
            if (entry.kind === 'device' && (entry.triggers.length < 1 || entry.triggers.length > 8)) issue(entry, t("ui.between.one.and.eight.triggers.991d2661"));
            if (entry.actions.length < 1 || entry.actions.length > 16) issue(entry, t("ui.add.at.least.one.and.555d28b6"));
            if (entry.kind !== 'sequence' && entry.conditions.length > 16) issue(entry, t("ui.at.most.16.conditions.are.a8c918be"));
            if (entry.kind === 'time') {
                const schedule = entry.schedule;
                if (schedule.mode === 'clock') {
                    const times = schedule.at.split(',').map(time => time.trim());
                    if (times.length > 8 || times.some(time => !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) || new Set(times.map(time => time.length === 5 ? time + ':00' : time)).size !== times.length) issue(entry, t("ui.enter.between.one.and.eight.d1db4f86"), 'schedule');
                } else if (!Number.isInteger(schedule.offset) || Math.abs(schedule.offset) > 720) issue(entry, t("ui.the.solar.offset.must.be.6c775caf"), 'schedule');
                if (!schedule.weekdays.length) issue(entry, t("ui.select.at.least.one.weekday.46028dad"), 'schedule');
            }
            for (const kind of ['trigger', 'condition', 'action']) for (const item of entry[listFor(kind)] ?? []) {
                if (kind === 'action' && !duration(item.delay)) issue(entry, t("ui.the.delay.must.be.a.052e12fd"), kind, item.id);
                if (kind === 'trigger' && !duration(item.hold)) issue(entry, t("ui.the.minimum.duration.must.be.d9ae462c"), kind, item.id);
                if (item.type === 'sequence') {
                    if (entry.kind === 'sequence' || !entries.some(candidate => candidate.kind === 'sequence' && candidate.id === item.sequence)) issue(entry, t("ui.select.an.existing.action.sequence.d628d17b"), kind, item.id);
                } else if (item.type === 'scene') {
                    if (!deviceById(item.device)?.scenes?.some(scene => scene.id === item.scene)) issue(entry, t("ui.select.an.existing.scene.f05f84da"), kind, item.id);
                } else {
                    const meta = metaFor(item);
                    if (!meta || (kind === 'action' && !meta.writable)) issue(entry, t("ui.select.a.device.and.an.5a5faf09"), kind, item.id);
                    else if (meta.type === 'number' && (typeof item.value !== 'number' || !Number.isFinite(item.value))) issue(entry, t("ui.enter.a.valid.numeric.value.4a86b6b2"), kind, item.id);
                    else if (meta.type !== 'number' && !meta.values.includes(item.value)) issue(entry, t("ui.select.an.available.value.e2fca078"), kind, item.id);
                    if (kind === 'action' && item.property === 'brightness' && !(item.value >= 0 && item.value <= 254)) issue(entry, t("ui.brightness.must.be.between.0.2fe17346"), kind, item.id);
                }
            }
        }
        return issues;
    }

    function validate() {
        const issues = inspect();
        $('#issues').hidden = issues.length === 0;
        bindHTML($('#issues'), () => issues.length ? `<strong>${t("ui.entries.need.checking.885953f9", {p1: issues.length})}</strong><ul>${issues.map(item => `<li><button data-action="issue" data-entry="${esc(item.entry)}" data-kind="${item.kind}" data-id="${esc(item.item)}">${esc(item.message)}</button></li>`).join('')}</ul>` : '');
        verified = issues.length ? null : serial(entries); renderStatus();
        note(issues.length ? t("ui.the.preview.is.not.valid.e512410c") : t("ui.preview.checked.actual.validation.by.e2871b94"), issues.length ? 'error' : 'success');
    }

    function confirm(title, message, accept, label = t("ui.confirm.15b63b4d")) {
        confirmation = accept; bindText($('#confirm-title'), () => title); bindText($('#confirm-message'), () => message); bindText($('#confirm-accept'), () => label); $('#confirm-dialog').showModal();
    }

    const actions = {
        category: button => { category = button.dataset.kind; renderNavigation(); },
        entry: button => choose(button.dataset.id),
        block: button => { selected.kind = button.dataset.kind; selected.item = button.dataset.id; renderFlow(); renderInspector(); },
        schedule: () => { selected.kind = 'schedule'; selected.item = ''; renderFlow(); renderInspector(); },
        'select-rule': () => { selected.kind = 'rule'; selected.item = ''; renderFlow(); renderInspector(); },
        add: button => add(button.dataset.kind),
        move: button => { const from = current().actions.findIndex(item => item.id === button.dataset.id); move(button.dataset.id, from + Number(button.dataset.direction)); },
        'remove-block': () => {
            const entry = current(); const list = listFor(selected.kind); if (!entry || !list) return;
            entry[list] = entry[list].filter(item => item.id !== selected.item); selected.kind = 'rule'; selected.item = ''; changed(true); note(t("ui.block.removed.from.the.draft.3e518f6b"));
        },
        validate,
        save: () => {
            if (verified !== serial(entries)) return;
            if (serial(saved) !== serial(entries)) { running = false; runningEntries = []; }
            saved = clone(entries); renderStatus(); note(t("ui.preview.saved.for.this.window.3320b415"), 'success');
        },
        activate: () => {
            if (verified !== serial(entries) || serial(saved) !== serial(entries)) return;
            if (!saved.some(entry => entry.kind !== 'sequence' && entry.enabled)) { note(t("ui.no.rule.is.enabled.select.41fa94a7"), 'error'); return; }
            running = true; runningEntries = clone(saved); renderStatus(); note(t("ui.example.operation.enabled.no.devices.9aa7815a"), 'success');
        },
        stop: () => { running = false; runningEntries = []; renderStatus(); note(t("ui.example.operation.stopped.the.saved.782ff6e7")); },
        new: () => { $('#new-kind').value = category; $('#new-name').value = ''; $('#new-dialog').showModal(); $('#new-name').focus(); },
        'close-new': () => $('#new-dialog').close(),
        'copy-entry': () => {
            const entry = current(); if (!entry) return;
            const copy = clone(entry); copy.id = uid(); copy.name = (entry.name.slice(0, 112) + ' – Kopie').slice(0, 120);
            if (copy.kind !== 'sequence') copy.enabled = false;
            for (const list of ['triggers', 'conditions', 'actions']) for (const item of copy[list] ?? []) item.id = uid();
            entries.push(copy); selected = {entry: copy.id, kind: 'rule', item: ''}; category = copy.kind; changed(true); note(t("ui.copy.created.a.copied.automation.ade4c914"));
        },
        'delete-entry': () => {
            const entry = current(); if (!entry) return;
            if (entry.kind === 'sequence' && entries.some(other => other.actions.some(action => action.type === 'sequence' && action.sequence === entry.id))) { note(t("ui.this.action.sequence.is.still.7153b430"), 'error'); return; }
            confirm(t("ui.delete.entry.from.preview.3f2d3890"), t("ui.will.be.removed.only.from.7019ae1f", {p1: entry.name}), () => { entries = entries.filter(candidate => candidate.id !== entry.id); selected = {entry: entries.find(candidate => candidate.kind === category)?.id ?? '', kind: 'rule', item: ''}; changed(true); note(t("ui.entry.removed.from.the.preview.dfcfb879")); }, t("ui.delete.6c2d3521"));
        },
        reset: () => confirm(t("ui.restore.examples.09ebae8e"), t("ui.changes.in.this.window.will.6c7ecad0"), () => { entries = clone(initial); saved = clone(initial); verified = null; running = false; runningEntries = []; selected = {entry: initial[0].id, kind: 'condition', item: 'demo.condition'}; category = 'device'; $('#search').value = ''; $('#issues').hidden = true; render(); note(t("ui.examples.restored.3318f2ab")); }, t("ui.reset.1ba0463c")),
        'cancel-confirm': () => { confirmation = null; $('#confirm-dialog').close(); },
        'accept-confirm': () => { const operation = confirmation; confirmation = null; $('#confirm-dialog').close(); operation?.(); },
        issue: button => choose(button.dataset.entry, button.dataset.kind, button.dataset.id)
    };

    document.addEventListener('click', event => {
        const target = event.target.closest('[data-action]');
        if (target && !target.disabled) actions[target.dataset.action]?.(target);
    });
    $('#flow').addEventListener('keydown', event => {
        if (event.target.matches('.flow-card') && ['Enter', ' '].includes(event.key)) { event.preventDefault(); event.target.click(); }
    });
    $('#inspector-fields').addEventListener('input', event => {
        if (event.target.matches('input[data-field]:not([type="checkbox"])')) updateField(event.target.dataset.field, event.target.value, event.target);
    });
    $('#inspector-fields').addEventListener('change', event => {
        const control = event.target;
        if (control.matches('select[data-field], input[type="checkbox"][data-field]')) updateField(control.dataset.field, control.value, control);
        if (control.dataset.day) {
            const day = Number(control.dataset.day); const schedule = current()?.schedule; if (!schedule) return;
            schedule.weekdays = control.checked ? [...schedule.weekdays, day].sort() : schedule.weekdays.filter(value => value !== day); changed(false);
        }
    });
    $('#search').addEventListener('input', renderNavigation);
    $('#new-form').addEventListener('submit', event => {
        event.preventDefault(); const name = $('#new-name').value.trim(); if (!name) { $('#new-name').focus(); return; }
        const type = $('#new-kind').value; const kind = type === 'sun' ? 'time' : type;
        const entry = {id: uid(), kind, name, actions: []};
        if (kind !== 'sequence') { entry.enabled = false; entry.retrigger = 'ignore'; entry.conditions = []; }
        if (kind === 'device') entry.triggers = [];
        if (kind === 'time') entry.schedule = {mode: type === 'sun' ? 'sunset' : 'clock', at: '18:00', offset: 0, timezone: 'Europe/Berlin', weekdays: [1, 2, 3, 4, 5, 6, 7]};
        entries.push(entry); selected = {entry: entry.id, kind: 'rule', item: ''}; category = kind; $('#search').value = ''; $('#new-dialog').close(); changed(true); note(t("ui.entry.created.add.blocks.in.625f8167"));
    });
    function clearDrop() { document.querySelectorAll('.drop-before, .drop-after').forEach(card => card.classList.remove('drop-before', 'drop-after')); }
    const dropCard = event => document.elementFromPoint(event.clientX, event.clientY)?.closest('.flow-card[data-kind="action"]');
    function endDrag() {
        dragged = null; clearDrop(); document.querySelectorAll('.dragging').forEach(card => card.classList.remove('dragging'));
    }
    $('#flow').addEventListener('pointerdown', event => {
        const handle = event.target.closest('.grip');
        if (!handle || event.button !== 0) return;
        const card = handle.closest('.flow-card');
        event.preventDefault(); handle.setPointerCapture(event.pointerId);
        dragged = {id: card.dataset.id, pointer: event.pointerId}; card.classList.add('dragging');
    });
    $('#flow').addEventListener('pointermove', event => {
        if (!dragged || event.pointerId !== dragged.pointer) return;
        clearDrop(); const card = dropCard(event);
        if (!card || card.dataset.id === dragged.id) return;
        const rect = card.getBoundingClientRect();
        card.classList.add(event.clientY < rect.top + rect.height / 2 ? 'drop-before' : 'drop-after');
    });
    $('#flow').addEventListener('pointerup', event => {
        if (!dragged || event.pointerId !== dragged.pointer) return;
        const id = dragged.id; const card = dropCard(event); endDrag();
        if (!card || card.dataset.id === id) return;
        const entry = current(); const from = entry.actions.findIndex(item => item.id === id); const to = entry.actions.findIndex(item => item.id === card.dataset.id);
        const rect = card.getBoundingClientRect(); const after = event.clientY >= rect.top + rect.height / 2;
        move(id, to + (after ? 1 : 0) - (from < to ? 1 : 0));
    });
    $('#flow').addEventListener('pointercancel', endDrag);
    $('#flow').addEventListener('lostpointercapture', endDrag);
    render();
})();
