// Generated from own extension, runtime, mesh, scenes, sequences, diagnostics, event catalog and schema sources. Do not edit.
export const EXTENSION_BUILD = 'c17ae7537a1e209649c73bef62df7d2d223978181db28865b4e9f1ca2bfde23d';
export const EXTENSION_VERSION = '0.2.2';
import {createHash, randomUUID} from 'node:crypto';
import * as fs from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TextDecoder} from 'node:util';
import Ajv from 'ajv';
import {parseEvents, constructFromEvents, JSON_SCHEMA, mapTag, EVENT_ID} from 'js-yaml';
const AUTOMATIONS_SCHEMA = {"$schema":"http://json-schema.org/draft-07/schema#","$id":"urn:burki24:z2m-automations:schema:1","title":"Z2MAutomations configuration v1","type":"object","additionalProperties":false,"properties":{"schema_version":{"const":1},"revision":{"type":"integer","minimum":1,"maximum":9007199254740991},"automations":{"type":"array","maxItems":100,"items":{"$ref":"#/definitions/automation"}},"mesh_peers":{"type":"array","maxItems":8,"uniqueItems":true,"items":{"$ref":"#/definitions/system"}},"sequences":{"type":"array","maxItems":32,"items":{"$ref":"#/definitions/sequence"}}},"required":["schema_version","revision","automations"],"definitions":{"device":{"type":"string","pattern":"^0x[0-9a-f]{16}$"},"jsonValue":{"anyOf":[{"type":["string","number","boolean","null"],"maxLength":256},{"type":"array","maxItems":32,"items":{"$ref":"#/definitions/jsonValue"}},{"type":"object","maxProperties":32,"propertyNames":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_]{0,63}$","not":{"enum":["__proto__","constructor","prototype"]}},"additionalProperties":{"$ref":"#/definitions/jsonValue"}}]},"deviceTrigger":{"type":"object","additionalProperties":false,"properties":{"type":{"const":"device"},"device":{"$ref":"#/definitions/device"},"property":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_]{0,63}$","not":{"enum":["__proto__","constructor","prototype"]}},"operator":{"enum":["eq","ne","gt","gte","lt","lte"]},"value":{"type":["string","number","boolean","null"],"maxLength":256},"for_seconds":{"type":"integer","minimum":0,"maximum":86400},"on_change":{"type":"boolean"}},"required":["type","device","property","operator","value"],"allOf":[{"if":{"properties":{"operator":{"enum":["gt","gte","lt","lte"]}}},"then":{"properties":{"value":{"type":"number"}}}}]},"timeTrigger":{"type":"object","additionalProperties":false,"properties":{"type":{"const":"time"},"at":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$"},"timezone":{"type":"string","minLength":1,"maxLength":64}},"required":["type","at","timezone"]},"deviceCondition":{"type":"object","additionalProperties":false,"properties":{"type":{"const":"device_value"},"system":{"$ref":"#/definitions/system"},"device":{"$ref":"#/definitions/device"},"property":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_]{0,63}$","not":{"enum":["__proto__","constructor","prototype"]}},"operator":{"enum":["eq","ne","gt","gte","lt","lte"]},"value":{"type":["string","number","boolean","null"],"maxLength":256},"start_only":{"type":"boolean"}},"required":["type","device","property","operator","value"],"allOf":[{"if":{"properties":{"operator":{"enum":["gt","gte","lt","lte"]}}},"then":{"properties":{"value":{"type":"number"}}}}]},"timeCondition":{"type":"object","additionalProperties":false,"properties":{"type":{"const":"time_window"},"after":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$"},"before":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$"},"timezone":{"type":"string","minLength":1,"maxLength":64},"weekdays":{"type":"array","minItems":1,"maxItems":7,"uniqueItems":true,"items":{"type":"integer","minimum":1,"maximum":7}}},"required":["type","after","before","timezone"]},"target":{"oneOf":[{"type":"object","additionalProperties":false,"properties":{"type":{"const":"device"},"id":{"$ref":"#/definitions/device"},"system":{"$ref":"#/definitions/system"}},"required":["type","id"]},{"type":"object","additionalProperties":false,"properties":{"type":{"const":"group"},"id":{"type":"integer","minimum":1,"maximum":65535},"system":{"$ref":"#/definitions/system"}},"required":["type","id"]}]},"action":{"oneOf":[{"$ref":"#/definitions/sceneAction"},{"type":"object","additionalProperties":false,"properties":{"type":{"const":"set"},"target":{"$ref":"#/definitions/target"},"values":{"type":"object","minProperties":1,"maxProperties":32,"propertyNames":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_]{0,63}$","not":{"enum":["__proto__","constructor","prototype"]}},"additionalProperties":{"$ref":"#/definitions/jsonValue"}},"delay_seconds":{"type":"integer","minimum":0,"maximum":86400}},"required":["type","target","values"]},{"type":"object","additionalProperties":false,"properties":{"type":{"const":"toggle"},"target":{"$ref":"#/definitions/target"},"property":{"type":"string","pattern":"^state(?:_[A-Za-z0-9_]+)?$","maxLength":64},"delay_seconds":{"type":"integer","minimum":0,"maximum":86400}},"required":["type","target","property"]},{"$ref":"#/definitions/sequenceCall"}]},"sceneAction":{"type":"object","additionalProperties":false,"properties":{"type":{"const":"scene"},"target":{"$ref":"#/definitions/target"},"scene_id":{"type":"integer","minimum":0,"maximum":255},"endpoint":{"type":"integer","minimum":1,"maximum":240},"delay_seconds":{"type":"integer","minimum":0,"maximum":86400}},"required":["type","target","scene_id"],"allOf":[{"if":{"properties":{"target":{"type":"object","properties":{"type":{"const":"group"}}}}},"then":{"properties":{"endpoint":false}},"else":{"properties":{"endpoint":{"type":"integer","minimum":1,"maximum":240}},"required":["endpoint"]}}]},"automation":{"type":"object","additionalProperties":false,"properties":{"id":{"type":"string","pattern":"^[a-z][a-z0-9_-]{0,63}$"},"name":{"type":"string","minLength":1,"maxLength":120},"enabled":{"type":"boolean"},"retrigger":{"enum":["ignore","restart","extend"]},"restart_policy":{"enum":["abort","resume","resume_expired"]},"triggers":{"type":"array","minItems":1,"maxItems":8,"items":{"oneOf":[{"$ref":"#/definitions/deviceTrigger"},{"$ref":"#/definitions/timeTrigger"},{"$ref":"#/definitions/sunTrigger"}]}},"conditions":{"type":"array","maxItems":16,"items":{"oneOf":[{"$ref":"#/definitions/deviceCondition"},{"$ref":"#/definitions/timeCondition"},{"$ref":"#/definitions/weekdayCondition"}]}},"actions":{"type":"array","minItems":1,"maxItems":16,"items":{"$ref":"#/definitions/action"}}},"required":["id","name","enabled","triggers","conditions","actions"]},"system":{"type":"string","minLength":1,"maxLength":128,"pattern":"^[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*$"},"sunTrigger":{"type":"object","additionalProperties":false,"properties":{"type":{"const":"sun"},"event":{"enum":["sunrise","sunset"]},"latitude":{"type":"number","minimum":-90,"maximum":90},"longitude":{"type":"number","minimum":-180,"maximum":180},"offset_minutes":{"type":"integer","minimum":-720,"maximum":720},"timezone":{"type":"string","minLength":1,"maxLength":64}},"required":["type","event","latitude","longitude","offset_minutes","timezone"]},"leafAction":{"oneOf":[{"$ref":"#/definitions/sceneAction"},{"type":"object","additionalProperties":false,"properties":{"type":{"const":"set"},"target":{"$ref":"#/definitions/target"},"values":{"type":"object","minProperties":1,"maxProperties":32,"propertyNames":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_]{0,63}$","not":{"enum":["__proto__","constructor","prototype"]}},"additionalProperties":{"$ref":"#/definitions/jsonValue"}},"delay_seconds":{"type":"integer","minimum":0,"maximum":86400}},"required":["type","target","values"]},{"type":"object","additionalProperties":false,"properties":{"type":{"const":"toggle"},"target":{"$ref":"#/definitions/target"},"property":{"type":"string","pattern":"^state(?:_[A-Za-z0-9_]+)?$","maxLength":64},"delay_seconds":{"type":"integer","minimum":0,"maximum":86400}},"required":["type","target","property"]}]},"sequenceCall":{"type":"object","additionalProperties":false,"properties":{"type":{"const":"sequence"},"sequence_id":{"type":"string","pattern":"^[a-z][a-z0-9_-]{0,63}$"},"delay_seconds":{"type":"integer","minimum":0,"maximum":86400}},"required":["type","sequence_id"]},"sequence":{"type":"object","additionalProperties":false,"properties":{"id":{"type":"string","pattern":"^[a-z][a-z0-9_-]{0,63}$"},"name":{"type":"string","minLength":1,"maxLength":120},"actions":{"type":"array","minItems":1,"maxItems":16,"items":{"$ref":"#/definitions/leafAction"}}},"required":["id","name","actions"]},"weekdayCondition":{"type":"object","additionalProperties":false,"properties":{"type":{"const":"weekday"},"weekdays":{"type":"array","minItems":1,"maxItems":7,"uniqueItems":true,"items":{"type":"integer","minimum":1,"maximum":7}},"timezone":{"type":"string","minLength":1,"maxLength":64}},"required":["type","weekdays","timezone"]}}};
// Own implementation of the published NOAA general solar equations (solareqns.PDF).
// Apparent horizon 90.833 degrees; a calculated time, not a weather observation.
const SOLAR_DAY = 86400000;
const solarRad = Math.PI / 180;

export function solarEventUTC(day, latitude, longitude, event) {
    const midnight = Date.parse(day + 'T00:00:00Z');
    if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== day
        || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180
        || !['sunrise', 'sunset'].includes(event)) return null;
    let instant = midnight + (720 - 4 * longitude) * 60000;
    for (let iteration = 0; iteration < 4; iteration++) {
        const date = new Date(instant), year = date.getUTCFullYear();
        const yearStart = Date.UTC(year, 0, 1), days = (Date.UTC(year + 1, 0, 1) - yearStart) / SOLAR_DAY;
        const angle = 2 * Math.PI / days * ((instant - yearStart) / SOLAR_DAY - 0.5);
        const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(angle) - 0.032077 * Math.sin(angle)
            - 0.014615 * Math.cos(2 * angle) - 0.040849 * Math.sin(2 * angle));
        const declination = 0.006918 - 0.399912 * Math.cos(angle) + 0.070257 * Math.sin(angle)
            - 0.006758 * Math.cos(2 * angle) + 0.000907 * Math.sin(2 * angle)
            - 0.002697 * Math.cos(3 * angle) + 0.00148 * Math.sin(3 * angle);
        const cosine = (Math.cos(90.833 * solarRad) - Math.sin(latitude * solarRad) * Math.sin(declination))
            / (Math.cos(latitude * solarRad) * Math.cos(declination));
        if (!Number.isFinite(cosine) || Math.abs(cosine) > 1) return null;
        const hourAngle = Math.acos(cosine) / solarRad * (event === 'sunrise' ? 1 : -1);
        instant = midnight + (720 - 4 * (longitude + hourAngle) - equation) * 60000;
    }
    return Math.round(instant);
}

export function solarForLocalDay(day, trigger) {
    const formatter = new Intl.DateTimeFormat('en-CA', {timeZone: trigger.timezone, year: 'numeric', month: '2-digit', day: '2-digit'});
    const anchor = Date.parse(day + 'T00:00:00Z');
    for (const shift of [-1, 0, 1]) {
        const utcDay = new Date(anchor + shift * SOLAR_DAY).toISOString().slice(0, 10);
        const instant = solarEventUTC(utcDay, trigger.latitude, trigger.longitude, trigger.event);
        if (instant === null) continue;
        const parts = Object.fromEntries(formatter.formatToParts(instant).map(p => [p.type, p.value]));
        if (`${parts.year}-${parts.month}-${parts.day}` === day) {
            return Math.round(instant / 60000) * 60000 + trigger.offset_minutes * 60000;
        }
    }
    return null;
}


// Library-local execution policy. No foreign automation implementation is bundled.
export const RUNTIME_LIMITS = Object.freeze({concurrentRules: 16, commandsPerSecond: 20, ruleCooldownMs: 1000, publishTimeoutMs: 5000});
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const scalar = value => value === null || ['string', 'boolean'].includes(typeof value) || (typeof value === 'number' && Number.isFinite(value));
const nativeClock = {now: () => performance.now(), wallNow: () => Date.now(), setTimeout, clearTimeout, setInterval, clearInterval};

export class RuntimeError extends Error {
    constructor(code) { super(code); this.code = code; }
}

function compare(actual, clause) {
    if (!scalar(actual)) return false;
    if (clause.operator === 'eq') return actual === clause.value;
    if (clause.operator === 'ne') return actual !== clause.value;
    if (typeof actual !== 'number' || typeof clause.value !== 'number') return false;
    return {gt: () => actual > clause.value, gte: () => actual >= clause.value,
        lt: () => actual < clause.value, lte: () => actual <= clause.value}[clause.operator]();
}

export class AutomationRuntime {
    constructor({zigbee, dispatch, logger, clock = nativeClock, available = true, readState, remoteDispatch, remoteCondition, onDeactivate, onCancelRun}) {
        this.zigbee = zigbee;
        this.dispatch = dispatch;
        this.readState = readState;
        this.remoteDispatch = remoteDispatch;
        this.remoteCondition = remoteCondition;
        this.onDeactivate = onDeactivate;
        this.onCancelRun = onCancelRun;
        this.logger = logger;
        this.clock = clock;
        this.available = available;
        this.generation = 0;
        this.active = null;
        this.rules = [];
        this.values = new Map();
        this.changes = new Map();
        this.references = new Map();
        this.holds = new Map();
        this.waits = new Map();
        this.running = new Map();
        this.tasks = new Set();
        this.cooldowns = new Map();
        this.formats = new Map();
        this.days = new Map();
        this.solar = new Map();
        this.sentAt = [];
        this.timer = null;
        this.lastError = '';
        this.executions = new Map();
        this.results = new Map();
        this.executionSequence = 0;
    }

    executionSnapshot() { return {sequence: this.executionSequence, runs: [...this.results.values()]}; }

    executionState(rule, context, state, error = '', step = 0) {
        const execution = this.executions.get(context.run);
        if (step === 0 && this.results.get(rule.id)?.run === context.run) step = this.results.get(rule.id).step;
        this.results.delete(rule.id);
        this.results.set(rule.id, {rule_id: rule.id, run: context.run, revision: context.revision,
            checksum: execution?.candidate.checksum ?? this.active?.checksum,
            state, error, step});
        while (this.results.size > 100) this.results.delete(this.results.keys().next().value);
        this.executionSequence++;
        try { this.onExecutionChange?.(); } catch { /* Reporting cannot alter execution. */ }
    }

    canContinue(generation, context = {}) {
        const execution = this.executions.get(context.run);
        return generation === this.generation && !execution?.cancelled && Boolean(this.active || execution?.once);
    }

    permittedPeer(system, context = {}) {
        const execution = this.executions.get(context.run);
        return this.canContinue(execution?.generation ?? this.generation, context)
            && (execution?.candidate ?? this.active)?.document.mesh_peers?.includes(system);
    }

    startOnce(candidate, ruleID) {
        if (!this.available || typeof this.dispatch !== 'function') throw new RuntimeError('runtime_unavailable');
        const rule = candidate.document.automations.find(item => item.id === ruleID);
        if (!rule) throw new RuntimeError('rule_missing');
        for (const clause of rule.conditions) if (clause.system !== undefined) {
            if (!candidate.document.mesh_peers?.includes(clause.system) || typeof this.remoteCondition !== 'function') throw new RuntimeError('mesh_not_allowed');
        } else if (clause.device && !this.device(clause.device)) throw new RuntimeError('unknown_entity');
        for (const {action} of expandActionPlan(candidate.document, rule.actions)) {
            if (action.target.system !== undefined) {
                if (!candidate.document.mesh_peers?.includes(action.target.system) || typeof this.remoteDispatch !== 'function') throw new RuntimeError('mesh_not_allowed');
            } else {
                const entity = this.target(action.target);
                if (action.type === 'scene' && !hasScene(entity, action.target.type, action)) throw new RuntimeError('scene_unavailable');
                if (action.type === 'toggle' && typeof this.readState !== 'function') throw new RuntimeError('runtime_unavailable');
            }
        }
        const context = {run: randomUUID(), rule: candidate.document.automations.indexOf(rule) + 1,
            revision: candidate.document.revision, origin: this.system};
        this.log('AKTION', 'Einmaliger Start angefordert; gespeicherte Auslöser bleiben unverändert.', {}, context);
        return this.launch(rule, context, candidate);
    }

    stopRule(ruleID, run) {
        const execution = this.executions.get(run);
        if (!execution || execution.rule.id !== ruleID || (execution.cancelled && !execution.restart)) throw new RuntimeError('run_conflict');
        execution.restart = null;
        execution.cancelled = true;
        this.journal?.remove(run).catch(() => {
            this.log('FEHLER', 'Gestoppter Lauf konnte im Fortsetzungsspeicher nicht bestätigt werden.', {}, execution.context);
        });
        for (const [timer, wait] of this.waits) if (wait.run === run) {
            this.clock.clearTimeout(timer); this.waits.delete(timer); wait.resolve(false);
        }
        this.onCancelRun?.(run);
        this.executionState(execution.rule, execution.context, 'stopped');
        this.log('AKTION', 'Ausgewählten Regellauf gestoppt; bereits übergebene Befehle bleiben wirksam.', {}, execution.context);
        return this.results.get(ruleID);
    }

    metadata() {
        return {runtime_version: 1, executing: this.active !== null, active_revision: this.active?.document.revision ?? null,
            active_checksum: this.active?.checksum ?? null, enabled_count: this.rules.length, runtime_error: this.lastError};
    }

    log(event, message, details = {}, context = {}) {
        try {
            const safeContext = {...context};
            if (typeof safeContext.origin === 'string') safeContext.origin = createHash('sha256').update(safeContext.origin).digest('hex');
            this.logger.debug?.('Z2MAutomations | ' + event + ' | ' + JSON.stringify({Meldung: message, Bezug: {...details, ...safeContext}}));
        } catch { /* A broken diagnostic sink cannot alter execution. */ }
        try { this.diagnostics?.emit(message, details, context); } catch { /* Independent from local logging. */ }
    }

    trace(rule, extra = {}) {
        return {run: randomUUID(), rule: (this.active?.document.automations.indexOf(rule) ?? -1) + 1,
            revision: this.active?.document.revision, origin: this.system, ...extra};
    }

    device(id) {
        const entity = this.zigbee?.resolveEntity?.(id);
        return entity?.isDevice?.() && entity.ieeeAddr === id && entity.zh?.type !== 'Coordinator' ? entity : null;
    }

    target(target) {
        const entity = target.type === 'device' ? this.device(target.id)
            : [...(this.zigbee?.groupsIterator?.() ?? [])].find(group => group.ID === target.id);
        if (!entity || typeof entity.name !== 'string' || entity.name === '' || entity.name.length > 1024
            || /[\u0000-\u001f\u007f+#]/.test(entity.name) || /^bridge(?:\/|$)/.test(entity.name)) throw new RuntimeError('unknown_entity');
        return entity;
    }

    activate(candidate) {
        if (!this.available || !this.zigbee?.resolveEntity || typeof this.dispatch !== 'function') throw new RuntimeError('runtime_unavailable');
        const rules = candidate.document.automations.filter(rule => rule.enabled);
        const references = new Map();
        const changes = new Map();
        for (const rule of rules) {
            for (const clause of [...rule.triggers, ...rule.conditions]) {
                if (!clause.device) continue;
                if (clause.system !== undefined) {
                    if (!candidate.document.mesh_peers?.includes(clause.system) || typeof this.remoteCondition !== 'function') throw new RuntimeError('mesh_not_allowed');
                    continue;
                }
                if (!this.device(clause.device)) throw new RuntimeError('unknown_entity');
                if (!references.has(clause.device)) references.set(clause.device, new Set());
                references.get(clause.device).add(clause.property);
                if (clause.on_change) {
                    if (typeof this.readState !== 'function') throw new RuntimeError('runtime_unavailable');
                    const cached = this.readState(this.device(clause.device));
                    if (!changes.has(clause.device)) changes.set(clause.device, Object.create(null));
                    if (object(cached) && Object.hasOwn(cached, clause.property) && scalar(cached[clause.property])) {
                        changes.get(clause.device)[clause.property] = cached[clause.property];
                    }
                }
            }
            for (const {action} of expandActionPlan(candidate.document, rule.actions)) {
                if (action.target.system !== undefined) {
                    if (!candidate.document.mesh_peers?.includes(action.target.system) || typeof this.remoteDispatch !== 'function') throw new RuntimeError('mesh_not_allowed');
                    continue;
                }
                const entity = this.target(action.target);
                if (action.type === 'scene' && !hasScene(entity, action.target.type, action)) throw new RuntimeError('scene_unavailable');
                if (action.type === 'toggle' && typeof this.readState !== 'function') throw new RuntimeError('runtime_unavailable');
            }
        }
        if (this.active?.checksum === candidate.checksum) return;
        this.deactivate();
        this.active = candidate;
        this.rules = rules;
        this.references = references;
        this.changes = changes;
        this.lastError = '';
        if (rules.some(rule => rule.triggers.some(trigger => ['time', 'sun'].includes(trigger.type)))) {
            this.timer = this.clock.setInterval(() => this.tick(), 1000);
            this.timer?.unref?.();
        }
        this.log('AKTION', 'Gespeicherte Revision für neue Auslöser aktiviert.', {Revision: candidate.document.revision, Regeln: rules.length});
    }

    deactivate() {
        for (const [run, execution] of this.executions) if (!execution.cancelled || execution.restart) this.stopRule(execution.rule.id, run);
        this.generation++;
        this.onDeactivate?.();
        this.active = null;
        this.rules = [];
        if (this.timer !== null) this.clock.clearInterval(this.timer);
        this.timer = null;
        for (const [timer, wait] of this.waits) { this.clock.clearTimeout(timer); wait.resolve(false); }
        this.waits.clear();
        for (const hold of this.holds.values()) {
            if (hold.timer !== null) this.clock.clearTimeout(hold.timer);
            this.log('AKTION', 'Mindestdauer abgebrochen.', {}, hold.context);
        }
        this.holds.clear();
        this.values.clear();
        this.changes.clear();
        this.references.clear(); this.cooldowns.clear(); this.days.clear(); this.formats.clear(); this.solar.clear();
        this.running.clear();
        this.log('AKTION', 'Ausführung gestoppt; ausstehende Verzögerungen verworfen.');
    }

    async stop() { this.deactivate(); await Promise.allSettled([...this.tasks]); }

    local(timezone) {
        if (!this.formats.has(timezone)) this.formats.set(timezone, new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
        }));
        const p = Object.fromEntries(this.formats.get(timezone).formatToParts(this.clock.wallNow()).map(part => [part.type, part.value]));
        return {day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}:${p.second}`};
    }

    conditions(rule, context = {}, starting = true) {
        return rule.conditions.every((clause, index) => {
            // Remote clauses are evaluated by checkedConditions, never against a local IEEE match.
            if (clause.system !== undefined) return true;
            if (clause.start_only && !starting) {
                this.log('AKTION', 'Nur beim Start gültige Bedingung im laufenden Ablauf nicht erneut geprüft.', {}, {...context, condition: index + 1});
                return true;
            }
            let passed;
            if (clause.type === 'device_value') passed = Boolean(this.device(clause.device)
                && compare((this.executions.get(context.run)?.values ?? this.values).get(clause.device)?.[clause.property], clause));
            else if (clause.type === 'weekday') {
                const local = this.local(clause.timezone);
                passed = clause.weekdays.includes(new Date(local.day + 'T00:00:00Z').getUTCDay() || 7);
                this.log('AKTION', 'Kalendertag gegen erlaubte Wochentage geprüft.', {Erfüllt: passed}, {...context, condition: index + 1});
                return passed;
            }
            else {
                const local = this.local(clause.timezone);
                const overnight = clause.after > clause.before;
                const anchor = new Date(local.day + 'T00:00:00Z');
                if (overnight && local.time < clause.before) anchor.setUTCDate(anchor.getUTCDate() - 1);
                passed = (overnight ? local.time >= clause.after || local.time < clause.before : local.time >= clause.after && local.time < clause.before)
                    && (!clause.weekdays || clause.weekdays.includes(anchor.getUTCDay() || 7));
            }
            this.log('AKTION', 'Bedingung geprüft.', {Erfüllt: passed}, {...context, condition: index + 1});
            return passed;
        });
    }

    readCondition(clause) {
        const device = this.device(clause.device);
        if (!device || typeof this.readState !== 'function') return false;
        let state;
        try { state = this.readState(device); } catch { return false; }
        return object(state) && Object.hasOwn(state, clause.property) && compare(state[clause.property], clause);
    }

    async checkedConditions(rule, context, starting = true) {
        if (!this.conditions(rule, context, starting)) return false;
        for (const [index, clause] of rule.conditions.entries()) {
            if (clause.system === undefined || clause.start_only && !starting) continue;
            if (typeof this.remoteCondition !== 'function') throw new RuntimeError('mesh_unavailable');
            const passed = await this.remoteCondition(clause, {...context, condition: index + 1});
            this.log('AKTION', 'Bedingung geprüft.', {Erfüllt: passed}, {...context, condition: index + 1});
            if (!passed) return false;
        }
        // Local values may have changed while a remote answer was in flight.
        return this.conditions(rule, context, starting);
    }

    receive(event) {
        if ((!this.active && this.executions.size === 0) || !event?.entity?.isDevice?.() || !object(event.payload)
            || ['publishCached', 'lastSeenChanged'].includes(event.stateChangeReason)) return;
        const id = event.entity.ieeeAddr;
        for (const execution of this.executions.values()) if (execution.once && !execution.cancelled) {
            for (const clause of execution.rule.conditions) if (clause.system === undefined && clause.device === id && Object.hasOwn(event.payload, clause.property)) {
                const values = execution.values.get(id) ?? Object.create(null);
                values[clause.property] = scalar(event.payload[clause.property]) ? event.payload[clause.property] : undefined;
                execution.values.set(id, values);
            }
        }
        if (!this.active) return;
        const properties = this.references.get(id);
        if (!properties || !this.device(id)) return;
        const values = this.values.get(id) ?? Object.create(null);
        const previous = {...(this.changes.get(id) ?? {})};
        for (const property of properties) {
            if (Object.hasOwn(event.payload, property)) values[property] = scalar(event.payload[property]) ? event.payload[property] : undefined;
        }
        this.values.set(id, values);
        this.changes.set(id, {...previous, ...values});
        this.log('EMPFANG', 'Neue Eigenschaften einer konfigurierten Quelle ausgewertet.', {Eigenschaften: [...properties].filter(property => Object.hasOwn(event.payload, property)).length});
        for (const rule of this.rules) {
            rule.triggers.forEach((trigger, index) => {
                if (trigger.type !== 'device' || trigger.device !== id || !Object.hasOwn(event.payload, trigger.property)) return;
                const key = rule.id + ':' + index;
                const matches = compare(values[trigger.property], trigger);
                const priorContext = this.holds.get(key)?.context;
                const context = priorContext ?? this.trace(rule, {trigger: index + 1});
                this.log('AKTION', 'Auslöser geprüft.', {Erfüllt: matches}, context);
                const changed = !Object.hasOwn(previous, trigger.property) || previous[trigger.property] !== values[trigger.property];
                if (matches && trigger.on_change && !changed) this.log('AKTION', 'Wert unverändert; Auslöser verlangt eine Wertänderung.', {Regel: rule.id, Auslöser: index + 1}, context);
                if (!trigger.for_seconds) { if (matches && (!trigger.on_change || changed)) this.launch(rule, context); return; }
                const prior = this.holds.get(key);
                if (!matches) {
                    if (prior?.timer !== null && prior?.timer !== undefined) this.clock.clearTimeout(prior.timer);
                    if (prior) this.log('AKTION', 'Mindestdauer abgebrochen.', {}, context);
                    this.holds.delete(key);
                } else if (!prior && (!trigger.on_change || changed)) {
                    const generation = this.generation;
                    this.log('AKTION', 'Mindestdauer begonnen.', {}, {...context, delay: trigger.for_seconds});
                    const hold = {context, timer: this.clock.setTimeout(() => {
                        hold.timer = null;
                        if (generation === this.generation && this.active && compare(this.values.get(id)?.[trigger.property], trigger)
                            && this.device(id)) {
                            this.log('AKTION', 'Mindestdauer erreicht.', {}, context);
                            this.launch(rule, context);
                        }
                    }, trigger.for_seconds * 1000)};
                    hold.timer?.unref?.();
                    this.holds.set(key, hold);
                }
            });
        }
    }

    tick() {
        if (!this.active) return;
        for (const rule of this.rules) rule.triggers.forEach((trigger, index) => {
            if (trigger.type === 'sun') { this.tickSolar(rule, trigger, index); return; }
            if (trigger.type !== 'time') return;
            const local = this.local(trigger.timezone);
            const key = rule.id + ':' + index;
            if (local.time === trigger.at && (!this.days.has(key) || local.day > this.days.get(key))) {
                this.days.set(key, local.day);
                const context = this.trace(rule, {trigger: index + 1});
                this.log('AKTION', 'Zeitpunkt erreicht.', {}, context);
                this.launch(rule, context);
            }
        });
    }

    tickSolar(rule, trigger, index) {
        const now = this.clock.wallNow(), day = this.local(trigger.timezone).day, key = rule.id + ':' + index;
        if (this.solar.get(key)?.day !== day) {
            const anchor = Date.parse(day + 'T00:00:00Z'), targets = [];
            for (const offset of [-1, 0, 1]) {
                const date = new Date(anchor + offset * 86400000).toISOString().slice(0, 10);
                targets.push({day: date, at: solarForLocalDay(date, trigger)});
            }
            this.solar.set(key, {day, targets});
            const context = {rule: this.active.document.automations.indexOf(rule) + 1, trigger: index + 1,
                revision: this.active.document.revision, origin: this.system};
            this.log('AKTION', 'Astro-Auslöser für den heutigen Tag geprüft; Zeitversatz berücksichtigt.', {}, context);
            if (targets[1].at === null) this.log('AKTION', 'Heute gibt es für dieses Sonnenereignis keinen Zeitpunkt; Auslöser wird übersprungen.', {}, context);
        }
        for (const target of this.solar.get(key).targets) {
            if (target.at === null || Math.floor(now / 1000) !== Math.floor(target.at / 1000)
                || (this.days.has(key) && target.day <= this.days.get(key))) continue;
            this.days.set(key, target.day);
            const context = this.trace(rule, {trigger: index + 1});
            this.log('AKTION', 'Astro-Zeitpunkt einschließlich Zeitversatz erreicht.', {}, context);
            this.launch(rule, context);
        }
    }

    wait(milliseconds, generation, context = {}, fullDuration = milliseconds) {
        if (!this.canContinue(generation, context)) return Promise.resolve(false);
        if (!milliseconds) return Promise.resolve(true);
        return new Promise(resolve => {
            const wait = {resolve, run: context.run, context, milliseconds: fullDuration, timer: null};
            let initial = true;
            wait.arm = () => {
                const duration = initial ? milliseconds : fullDuration;
                const renewed = !initial; initial = false;
                if (wait.timer !== null) { this.clock.clearTimeout(wait.timer); this.waits.delete(wait.timer); }
                if (renewed) {
                    const execution = this.executions.get(context.run);
                    if (execution) this.checkpoint(execution.rule, context, this.clock.wallNow() + duration, fullDuration).catch(() => {
                        if (!this.canContinue(generation, context)) return;
                        this.lastError = 'storage_error';
                        this.stopRule(execution.rule.id, context.run);
                        this.log('FEHLER', 'Verlängerte Wartezeit konnte nicht gespeichert werden; Lauf beendet.', {}, context);
                    });
                }
                wait.timer = this.clock.setTimeout(() => {
                    this.waits.delete(wait.timer);
                    resolve(this.canContinue(generation, context));
                }, duration);
                wait.timer?.unref?.();
                this.waits.set(wait.timer, wait);
            };
            wait.arm();
        });
    }

    retrigger(rule, context, checked = false) {
        const execution = [...this.executions.values()].find(item => item.rule.id === rule.id);
        const policy = rule.retrigger ?? 'ignore';
        const now = this.clock.now();
        if (!execution || execution.once || execution.cancelled || execution.restart || policy === 'ignore') {
            this.log('AKTION', 'Erneute Auslösung ignoriert; vorhandener Regellauf bleibt unverändert.', {}, context);
            return;
        }
        if (now - (this.cooldowns.get(rule.id) ?? -Infinity) < RUNTIME_LIMITS.ruleCooldownMs) {
            this.log('AKTION', 'Regellauf nicht gestartet.', {Grund: 'cooldown'}, context);
            return;
        }
        if (!checked && rule.conditions.some(clause => clause.system !== undefined)) {
            if (execution.retriggerPending) return;
            execution.retriggerPending = true;
            void this.checkedConditions(rule, {...context, run: execution.context.run}, policy !== 'extend').then(passed => {
                execution.retriggerPending = false;
                if (this.executions.get(execution.context.run) !== execution || !this.canContinue(execution.generation, execution.context)) return;
                if (passed) this.retrigger(rule, context, true);
                else this.log('AKTION', 'Erneute Auslösung wegen nicht erfüllter Bedingungen verworfen; vorhandener Lauf bleibt unverändert.', {}, context);
            }).catch(error => {
                execution.retriggerPending = false;
                this.log('FEHLER', 'Aktionsfolge abgebrochen; keine automatische Wiederholung.', {Grund: error instanceof RuntimeError ? error.code : 'mesh_unavailable'}, context);
            });
            return;
        }
        if (!this.conditions(rule, context, policy !== 'extend')) {
            this.log('AKTION', 'Erneute Auslösung wegen nicht erfüllter Bedingungen verworfen; vorhandener Lauf bleibt unverändert.', {}, context);
            return;
        }
        if (policy === 'extend') {
            const wait = [...this.waits.values()].find(item => item.run === execution.context.run);
            if (!wait) {
                this.log('AKTION', 'Keine laufende Wartezeit; erneute Auslösung verändert den Ablauf nicht.', {}, execution.context);
                return;
            }
            this.cooldowns.set(rule.id, now);
            wait.arm();
            this.executionState(rule, execution.context, 'running');
            this.log('AKTION', 'Wartezeit wegen erneuter Auslösung auf volle Dauer zurückgesetzt.', {}, {...wait.context, trigger: context.trigger, delay: wait.milliseconds / 1000});
            return;
        }
        this.cooldowns.set(rule.id, now);
        execution.restart = {context, generation: this.generation, candidate: this.active};
        // Let an already handed-off action settle. Cancelling its acknowledgement could hide an uncertain result.
        if (!execution.dispatching) {
            execution.cancelled = true;
            for (const [timer, wait] of this.waits) if (wait.run === execution.context.run) {
                this.clock.clearTimeout(timer); this.waits.delete(timer); wait.resolve(false);
            }
            this.executionState(rule, execution.context, 'stopped');
        }
        this.log('AKTION', 'Neustart wegen erneuter Auslösung vorgemerkt; laufende Befehlsübergabe wird abgewartet.', {}, {...execution.context, trigger: context.trigger});
    }

    launch(rule, context = this.trace(rule), once = null, replacement = false, resumed = null) {
        const now = this.clock.now();
        if (!once && this.active && this.running.has(rule.id)) { this.retrigger(rule, context); return; }
        const reason = !this.active && !once ? 'inactive' : this.running.has(rule.id) ? 'already_running'
            : this.tasks.size >= RUNTIME_LIMITS.concurrentRules ? 'concurrency_limit'
                : !replacement && now - (this.cooldowns.get(rule.id) ?? -Infinity) < RUNTIME_LIMITS.ruleCooldownMs ? 'cooldown' : '';
        if (reason) {
            this.log('AKTION', 'Regellauf nicht gestartet.', {Regel: rule.id, Grund: reason}, context);
            if (once) throw new RuntimeError(reason === 'already_running' ? 'rule_busy' : 'busy');
            return;
        }
        const generation = this.generation;
        const execution = {rule, context, generation, candidate: once ?? this.active, once: Boolean(once), cancelled: false};
        if (once) {
            execution.values = new Map();
            for (const clause of rule.conditions) if (clause.device && clause.system === undefined) {
                let cached;
                try { cached = this.readState?.(this.device(clause.device)); } catch { /* Unknown conditions cannot authorize a command. */ }
                const values = execution.values.get(clause.device) ?? Object.create(null);
                if (object(cached) && Object.hasOwn(cached, clause.property) && scalar(cached[clause.property])) values[clause.property] = cached[clause.property];
                execution.values.set(clause.device, values);
            }
        }
        this.executions.set(context.run, execution);
        if (!resumed && !this.conditions(rule, context)) {
            this.executionState(rule, context, 'skipped', 'conditions_not_met');
            this.executions.delete(context.run);
            this.log('AKTION', 'Regellauf nicht gestartet.', {Grund: 'conditions_not_met'}, context);
            return this.results.get(rule.id);
        }
        this.cooldowns.set(rule.id, now);
        this.executionState(rule, context, 'running');
        if (!rule.conditions.some(clause => clause.system !== undefined)) {
            execution.started = true;
            this.log('START', once ? 'Einmaliger Regellauf mit erfüllten Bedingungen begonnen.' : 'Auslöser und Bedingungen erfüllt; Aktionsfolge begonnen.', {Regel: rule.id}, context);
        }
        // Schedule the task after registering it so synchronous feedback cannot re-enter this rule.
        const task = Promise.resolve().then(() => this.run(rule, generation, context, resumed)).catch(error => {
            if (execution.restart) {
                execution.restart = null;
                this.log('FEHLER', 'Vorgemerkter Neustart wegen fehlgeschlagener oder unbestätigter Befehlsübergabe verworfen.', {}, context);
            }
            if (execution.cancelled) return;
            const code = error instanceof RuntimeError ? error.code : 'action_failed';
            if (!once) this.lastError = code;
            this.executionState(rule, context, 'failed', code);
            this.log('FEHLER', 'Aktionsfolge abgebrochen; keine automatische Wiederholung.', {Regel: rule.id, Grund: code}, context);
        }).finally(async () => {
            try { await this.journal?.remove(context.run); }
            catch { this.log('FEHLER', 'Fortsetzungspunkt konnte nicht gelöscht werden; keine automatische Wiederholung erlaubt.', {}, context); }
            const restart = execution.restart;
            if (restart) this.executionState(rule, context, 'stopped');
            if (this.results.get(rule.id)?.run === context.run && this.results.get(rule.id)?.state === 'running') this.executionState(rule, context, 'completed');
            this.executions.delete(context.run);
            if (this.running.get(rule.id) === task) this.running.delete(rule.id);
            this.tasks.delete(task);
            if (execution.started) this.log('ENDE', 'Aktionsfolge beendet; Übergaben sind keine Gerätebestätigung.', {Regel: rule.id}, context);
            if (restart && restart.generation === this.generation && this.active === restart.candidate) {
                this.onCancelRun?.(context.run);
                this.log('AKTION', 'Vorheriger Lauf beendet; erneute Auslösung wird für Neustart geprüft.', {}, restart.context);
                this.launch(rule, restart.context, null, true);
            }
        });
        this.running.set(rule.id, task);
        this.tasks.add(task);
        return this.results.get(rule.id);
    }

    restoreRuns(records) {
        const scheduled = new Set();
        for (const saved of records) {
            const rule = this.rules.find(item => item.id === saved.rule_id);
            const context = rule ? {...this.trace(rule), run: saved.run, step: saved.step} : {};
            const action = rule ? expandActionPlan(this.active.document, rule.actions)[saved.step - 1]?.action : null;
            const now = this.clock.wallNow();
            if (!rule || !['resume', 'resume_expired'].includes(rule.restart_policy) || !action
                || (action.delay_seconds ?? 0) * 1000 !== saved.delay || now < saved.saved_at
                || (now >= saved.deadline && rule.restart_policy !== 'resume_expired')) {
                this.log('AKTION', 'Unterbrochener Lauf nicht fortgesetzt: Freigabe fehlt, Wartezeit abgelaufen oder Uhrzeit unplausibel.', {}, context);
                if (rule) this.executionState(rule, context, 'stopped');
                continue;
            }
            this.log('AKTION', now >= saved.deadline ? 'Wartezeit während Neustart abgelaufen; ausstehenden Schritt mit erneuter Bedingungsprüfung nachholen.'
                : 'Unterbrochenen Lauf am gespeicherten Aktionsschritt mit verbleibender Wartezeit fortsetzen.', {}, context);
            this.launch(rule, context, null, true, saved);
            scheduled.add(saved.run);
        }
        return scheduled;
    }

    async checkpoint(rule, context, deadline, delay) {
        const execution = this.executions.get(context.run);
        if (!this.journal || execution?.once || !['resume', 'resume_expired'].includes(rule.restart_policy) || !this.journal.enabled()) return;
        try {
            await this.journal.put({rule_id: rule.id, run: context.run, step: context.step,
                saved_at: this.clock.wallNow(), deadline, delay});
            this.log('AKTION', 'Wartepunkt für Fortsetzung nach Z2M-Neustart dauerhaft gespeichert.', {}, context);
        } catch { throw new RuntimeError('storage_error'); }
    }

    async run(rule, generation, context, resumed = null) {
        const document = this.executions.get(context.run)?.candidate.document ?? this.active?.document;
        if (!resumed && rule.conditions.some(clause => clause.system !== undefined)) {
            const passed = await this.checkedConditions(rule, context);
            if (!this.canContinue(generation, context)) return;
            if (!passed) {
                this.executionState(rule, context, 'skipped', 'conditions_not_met');
                this.log('AKTION', 'Regellauf nicht gestartet.', {Grund: 'conditions_not_met'}, context); return;
            }
            this.executions.get(context.run).started = true;
            this.log('START', this.executions.get(context.run)?.once ? 'Einmaliger Regellauf mit erfüllten Bedingungen begonnen.' : 'Auslöser und Bedingungen erfüllt; Aktionsfolge begonnen.', {Regel: rule.id}, context);
        }
        for (const [index, entry] of expandActionPlan(document, rule.actions).entries()) {
            if (resumed && index < resumed.step - 1) continue;
            const {action} = entry;
            if (!this.canContinue(generation, context) || this.executions.get(context.run)?.restart) return;
            const step = {...context, step: index + 1, delay: action.delay_seconds ?? 0,
                ...(entry.sequence ? {sequence: entry.sequence, sequence_step: entry.sequence_step} : {})};
            if (entry.sequence_step === 1) this.log('AKTION', 'Wiederverwendbare Aktionsfolge im Regellauf begonnen.', {}, step);
            this.executionState(rule, context, 'running', '', index + 1);
            const deadline = resumed ? resumed.deadline : this.clock.wallNow() + step.delay * 1000;
            const remaining = resumed ? Math.max(0, deadline - this.clock.wallNow()) : step.delay * 1000;
            if (remaining > 0) await this.checkpoint(rule, step, deadline, step.delay * 1000);
            if (!this.canContinue(generation, context)) return;
            if (step.delay) this.log('AKTION', 'Wartezeit vor Aktionsschritt begonnen.', {}, step);
            if (!await this.wait(Math.max(0, deadline - this.clock.wallNow()), generation, step, step.delay * 1000)) {
                this.log('AKTION', 'Aktionsschritt wegen Stopp abgebrochen.', {}, step);
                return;
            }
            if (step.delay) this.log('AKTION', 'Wartezeit vor Aktionsschritt beendet.', {}, step);
            if (!this.canContinue(generation, context)) return;
            try {
                if (this.journal?.runs.has(context.run)) { await this.journal.flush(); await this.journal.remove(context.run); }
            }
            catch { throw new RuntimeError('storage_error'); }
            if (!this.canContinue(generation, context)) return;
            resumed = null;
            const passed = await this.checkedConditions(rule, step, false);
            if (!this.canContinue(generation, context) || this.executions.get(context.run)?.restart) return;
            if (!passed) {
                this.executionState(rule, context, 'skipped', 'conditions_not_met', index + 1);
                this.log('AKTION', 'Bedingung vor Aktion nicht mehr erfüllt.', {Regel: rule.id}, step); return;
            }
            try {
                this.executions.get(context.run).dispatching = true;
                if (action.target.system !== undefined) {
                    await this.remoteDispatch(action, step);
                } else {
                    await this.executeLocal(action, generation, step);
                }
            } catch (error) {
                this.log('FEHLER', 'Aktionsschritt fehlgeschlagen; die restliche Folge wird abgebrochen.', {Grund: error instanceof RuntimeError ? error.code : 'action_failed'}, step);
                throw error;
            } finally { const execution = this.executions.get(context.run); if (execution) execution.dispatching = false; }
        }
    }

    async executeLocal(action, generation = this.generation, context = {}) {
        if (!this.canContinue(generation, context)) throw new RuntimeError('mesh_stopped');
        const entity = this.target(action.target);
        let values = action.values;
        if (action.type === 'scene') {
            if (!hasScene(entity, action.target.type, action)) throw new RuntimeError('scene_unavailable');
            values = {scene_recall: action.scene_id};
            this.log('AKTION', 'Vorhandene Szene für den Aufruf erneut geprüft.', {Zielart: action.target.type, Gerätekanal: action.endpoint !== undefined}, context);
        }
        if (action.type === 'toggle') {
            const current = this.readState(entity)?.[action.property];
            if (current !== 'ON' && current !== 'OFF') throw new RuntimeError('state_unavailable');
            values = {[action.property]: current === 'ON' ? 'OFF' : 'ON'};
            this.log('AKTION', 'Umschaltziel aus dem aktuellen Z2M-Zustand ermittelt.', {Zielart: action.target.type}, context);
        }
        const now = this.clock.now();
        this.sentAt = this.sentAt.filter(time => now - time < 1000);
        if (this.sentAt.length >= RUNTIME_LIMITS.commandsPerSecond) throw new RuntimeError('rate_limited');
        this.sentAt.push(now);
        this.log('SENDEN', action.type === 'scene' ? 'Szenenaufruf an native Z2M-Befehlsverarbeitung übergeben; Gerätewirkung nicht bestätigt.'
            : 'Set-Aktion an native Z2M-Befehlsverarbeitung übergeben; Gerätewirkung nicht bestätigt.', {Zielart: action.target.type, Eigenschaften: Object.keys(values).length}, context);
        let timeout;
        try {
            await Promise.race([
                Promise.resolve().then(() => {
                    if (!this.canContinue(generation, context)) throw new RuntimeError('mesh_stopped');
                    return this.dispatch(entity.name + (action.type === 'scene' && action.endpoint !== undefined ? '/' + action.endpoint : '') + '/set', JSON.stringify(values));
                }),
                new Promise((_, reject) => { timeout = this.clock.setTimeout(() => reject(new RuntimeError('action_timeout')), RUNTIME_LIMITS.publishTimeoutMs); })
            ]);
            this.log('EMPFANG', 'Native Befehlsverarbeitung hat die Übergabe angenommen; Gerätewirkung nicht bestätigt.', {}, context);
        } finally { this.clock.clearTimeout(timeout); }
    }
}


// Library-local bridge protocol. Credentials and broker configuration stay outside Z2M.
const MESH_ROOT = 'z2ma/mesh/';
const MESH_TIMEOUT = 4000;
const meshObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const meshSystemValid = value => typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(value);
export const meshSystemKey = value => createHash('sha256').update(value).digest('hex');

export class MeshTransport {
    constructor({mqtt, system, runtime, validateAction, validateCondition, clock, uuid = randomUUID}) {
        this.mqtt = mqtt;
        this.system = system;
        this.runtime = runtime;
        this.validateAction = validateAction;
        this.validateCondition = validateCondition;
        this.clock = clock ?? {now: () => performance.now(), setTimeout, clearTimeout};
        this.uuid = uuid;
        this.waiters = new Map();
        this.challenges = new Map();
        this.subscribed = false;
        this.closed = false;
    }

    async start() {
        if (!meshSystemValid(this.system) || typeof this.mqtt.subscribe !== 'function'
            || typeof this.mqtt.isConnected !== 'function' || !this.mqtt.isConnected() || this.closed) throw new RuntimeError('mesh_unavailable');
        if (!this.subscribed) {
            let timer;
            try {
                await Promise.race([this.mqtt.subscribe(MESH_ROOT + meshSystemKey(this.system) + '/#'),
                    new Promise((_, reject) => { timer = this.clock.setTimeout(() => reject(new RuntimeError('mesh_unavailable')), MESH_TIMEOUT); })]);
                if (this.closed) {
                    await this.mqtt.unsubscribe?.(MESH_ROOT + meshSystemKey(this.system) + '/#');
                    throw new RuntimeError('mesh_unavailable');
                }
                this.subscribed = true;
            } catch { throw new RuntimeError('mesh_unavailable'); }
            finally { this.clock.clearTimeout(timer); }
        }
    }

    allowed(system) {
        return this.subscribed && this.runtime.active !== null && system !== this.system
            && this.runtime.active.document.mesh_peers?.includes(system);
    }

    cancel() {
        this.challenges.clear();
        for (const waiter of this.waiters.values()) {
            this.clock.clearTimeout(waiter.timer);
            waiter.reject(new RuntimeError('mesh_stopped'));
        }
        this.waiters.clear();
    }

    cancelRun(run) {
        for (const [transaction, waiter] of this.waiters) if (waiter.run === run) {
            this.clock.clearTimeout(waiter.timer); this.waiters.delete(transaction);
            waiter.reject(new RuntimeError('mesh_stopped'));
        }
    }

    async stop() {
        this.closed = true;
        this.cancel();
        if (this.subscribed) {
            this.subscribed = false;
            try { await this.mqtt.unsubscribe?.(MESH_ROOT + meshSystemKey(this.system) + '/#'); }
            catch { this.runtime.log('FEHLER', 'Bridge-Abonnement konnte beim Stopp nicht entfernt werden.'); }
        }
    }

    async publish(destination, phase, message) {
        if (!this.mqtt.isConnected()) throw new RuntimeError('mesh_unavailable');
        await this.mqtt.publish('mesh/' + meshSystemKey(destination) + '/' + phase,
            JSON.stringify({mesh_version: 1, source: this.system, ...message}),
            {baseTopic: 'z2ma', skipReceive: false, skipLog: true, clientOptions: {qos: 0, retain: false}});
    }

    exchange(destination, phase, message, responsePhase, context = {}) {
        if (this.waiters.size >= 16) return Promise.reject(new RuntimeError('mesh_busy'));
        return new Promise((resolve, reject) => {
            const timer = this.clock.setTimeout(() => {
                this.waiters.delete(message.transaction);
                reject(new RuntimeError('mesh_timeout'));
            }, MESH_TIMEOUT);
            timer?.unref?.();
            this.waiters.set(message.transaction, {destination, phase: responsePhase, resolve, reject, timer, run: context.run});
            this.publish(destination, phase, message).catch(() => {
                const waiter = this.waiters.get(message.transaction);
                if (!waiter) return;
                this.waiters.delete(message.transaction);
                this.clock.clearTimeout(timer);
                reject(new RuntimeError('mesh_unavailable'));
            });
        });
    }

    async dispatch(action, context = {}) {
        const destination = action.target.system;
        const allowed = () => this.subscribed && this.runtime.permittedPeer(destination, context);
        if (!allowed()) throw new RuntimeError('mesh_not_allowed');
        const generation = this.runtime.generation;
        const local = {...action, target: {...action.target}};
        delete local.target.system;
        delete local.delay_seconds;
        const digest = createHash('sha256').update(JSON.stringify(local)).digest('hex');
        const transaction = this.uuid();
        this.runtime.log('SENDEN', 'Freigabe für eine Aktion im zweiten Z2M-System angefordert.', {}, context);
        const trace = debugTrace(context);
        const challenge = await this.exchange(destination, 'prepare', {transaction, digest, ...(trace ? {trace} : {})}, 'challenge', context);
        if (generation !== this.runtime.generation || !allowed()) throw new RuntimeError('mesh_stopped');
        if (challenge.status !== 'ok' || typeof challenge.token !== 'string' || !/^[a-f0-9-]{36}$/.test(challenge.token)) throw new RuntimeError('mesh_rejected');
        const result = await this.exchange(destination, 'execute', {transaction, token: challenge.token, action: local}, 'result', context);
        if (result.status !== 'ok') throw new RuntimeError(result.error === 'scene_unavailable' ? 'scene_unavailable' : 'mesh_rejected');
        this.runtime.log('EMPFANG', 'Zielsystem hat die native Befehlsübergabe bestätigt; Gerätewirkung nicht bestätigt.', {}, context);
    }

    async condition(clause, context = {}) {
        const destination = clause.system;
        const allowed = () => this.subscribed && destination !== this.system && this.runtime.permittedPeer(destination, context);
        if (!allowed()) throw new RuntimeError('mesh_not_allowed');
        const generation = this.runtime.generation;
        const {system, ...condition} = clause;
        const transaction = this.uuid();
        const trace = debugTrace(context);
        const result = await this.exchange(destination, 'condition', {transaction, condition, ...(trace ? {trace} : {})}, 'condition_result', context);
        if (generation !== this.runtime.generation || !allowed()) throw new RuntimeError('mesh_stopped');
        if (result.status !== 'ok' || typeof result.passed !== 'boolean') throw new RuntimeError('mesh_rejected');
        return result.passed;
    }

    async receive(event) {
        const prefix = MESH_ROOT + meshSystemKey(this.system) + '/';
        if (typeof event?.topic !== 'string' || !event.topic.startsWith(prefix)) return false;
        try {
            if (event.retain === true || typeof event.message !== 'string' || Buffer.byteLength(event.message) > 16384) throw new RuntimeError('mesh_invalid');
            const message = JSON.parse(event.message);
            const phase = event.topic.slice(prefix.length);
            if (!meshObject(message) || message.mesh_version !== 1 || !meshSystemValid(message.source)
                || typeof message.transaction !== 'string' || !/^[a-f0-9-]{36}$/.test(message.transaction)
                || message.source === this.system) throw new RuntimeError('mesh_not_allowed');
            if (['challenge', 'result', 'condition_result'].includes(phase)) {
                const waiter = this.waiters.get(message.transaction);
                if (!waiter || waiter.destination !== message.source || waiter.phase !== phase) return true;
                this.waiters.delete(message.transaction);
                this.clock.clearTimeout(waiter.timer);
                waiter.resolve(message);
                return true;
            }
            if (!this.allowed(message.source)) throw new RuntimeError('mesh_not_allowed');
            const key = message.source + ':' + message.transaction;
            if (phase === 'condition') {
                if (Object.keys(message).filter(key => key !== 'trace').sort().join(',') !== 'condition,mesh_version,source,transaction'
                    || !this.validateCondition?.(message.condition) || message.condition.system !== undefined) throw new RuntimeError('mesh_invalid');
                const passed = this.runtime.readCondition(message.condition);
                this.runtime.log('AKTION', 'Bedingung geprüft.', {Erfüllt: passed}, {...debugTrace(message.trace), origin: message.source});
                await this.publish(message.source, 'condition_result', {transaction: message.transaction, status: 'ok', passed});
            } else if (phase === 'prepare') {
                if (Object.keys(message).filter(key => key !== 'trace').sort().join(',') !== 'digest,mesh_version,source,transaction'
                    || typeof message.digest !== 'string' || !/^[a-f0-9]{64}$/.test(message.digest)) throw new RuntimeError('mesh_invalid');
                for (const [id, entry] of this.challenges) if (entry.expires <= this.clock.now()) this.challenges.delete(id);
                if (this.challenges.has(key) || this.challenges.size >= 64) throw new RuntimeError('mesh_busy');
                const token = this.uuid();
                this.challenges.set(key, {token, digest: message.digest, generation: this.runtime.generation, expires: this.clock.now() + MESH_TIMEOUT,
                    trace: {...debugTrace(message.trace), origin: message.source}});
                await this.publish(message.source, 'challenge', {transaction: message.transaction, status: 'ok', token});
            } else if (phase === 'execute') {
                const challenge = this.challenges.get(key);
                // Consume before any dispatch, including malformed, duplicate or failing commands.
                this.challenges.delete(key);
                if (Object.keys(message).sort().join(',') !== 'action,mesh_version,source,token,transaction'
                    || !challenge || challenge.token !== message.token || challenge.expires <= this.clock.now()
                    || challenge.generation !== this.runtime.generation || !this.validateAction(message.action)
                    || message.action.target.system !== undefined || message.action.delay_seconds !== undefined
                    || createHash('sha256').update(JSON.stringify(message.action)).digest('hex') !== challenge.digest) throw new RuntimeError('mesh_rejected');
                const context = challenge.trace;
                this.runtime.log('EMPFANG', 'Einmalig freigegebene Aktion vom zweiten Z2M-System empfangen.', {}, context);
                let status = 'ok';
                try { await this.runtime.executeLocal(message.action, this.runtime.generation, context); }
                catch (error) {
                    status = 'error';
                    this.runtime.lastError = error instanceof RuntimeError ? error.code : 'action_failed';
                    this.runtime.log('FEHLER', 'Empfangene Aktion nicht ausgeführt; keine automatische Wiederholung.', {Grund: this.runtime.lastError}, context);
                }
                await this.publish(message.source, 'result', {transaction: message.transaction, status,
                    ...(status === 'error' && this.runtime.lastError === 'scene_unavailable' ? {error: 'scene_unavailable'} : {})});
            }
        } catch (error) {
            this.runtime.log('FEHLER', 'Bridge-Nachricht verworfen; keine zusätzliche Geräteaktion.', {Grund: error instanceof RuntimeError ? error.code : 'mesh_invalid'});
        }
        return true;
    }
}

// Read only Z2M's persisted scene metadata; discovery never sends Zigbee commands.
const sceneObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sceneEndpoint = value => Number.isInteger(value) && value >= 1 && value <= 240;

export function entityScenes(entity, type) {
    const result = [];
    const endpoints = type === 'group' ? entity?.zh?.members : entity?.zh?.endpoints;
    if (!Array.isArray(endpoints)) return result;
    const seen = new Set();
    for (const endpoint of endpoints.slice(0, 256)) {
        if (type === 'device' && !sceneEndpoint(endpoint?.ID)) continue;
        const metadata = endpoint?.meta?.scenes;
        if (!sceneObject(metadata)) continue;
        for (const key of Object.keys(metadata).slice(0, 512)) {
            const match = /^(0|[1-9][0-9]{0,2})_(0|[1-9][0-9]{0,4})$/.exec(key);
            if (!match || Number(match[1]) > 255 || Number(match[2]) !== (type === 'group' ? entity.ID : 0)) continue;
            const id = Number(match[1]);
            const channel = type === 'device' ? endpoint.ID : 0;
            const identity = channel + '.' + id;
            if (seen.has(identity) || result.length >= 64 || !sceneObject(metadata[key])) continue;
            seen.add(identity);
            const raw = metadata[key].name;
            const name = typeof raw === 'string' && !/[\u0000-\u001f\u007f]/.test(raw) ? [...raw].slice(0, 120).join('') : '';
            result.push({id, name, ...(channel ? {endpoint: channel} : {})});
        }
    }
    return result.sort((a, b) => (a.endpoint ?? 0) - (b.endpoint ?? 0) || a.id - b.id);
}

export function hasScene(entity, type, action) {
    return entityScenes(entity, type).some(scene => scene.id === action.scene_id && scene.endpoint === action.endpoint);
}

export function buildEditorScenes(zigbee, devices, groups) {
    const result = [];
    for (const entry of [...devices.map(device => ({type: 'device', id: device.id, entry: device})),
        ...groups.map(group => ({type: 'group', id: group.id, entry: group}))]) {
        const entity = entry.type === 'device' ? zigbee.resolveEntity?.(entry.id)
            : [...(zigbee.groupsIterator?.() ?? [])].find(group => group.ID === entry.id);
        for (const scene of entityScenes(entity, entry.type)) {
            if (result.length >= 512) return result;
            let control = 'state';
            if (entry.type === 'device') {
                control = entry.entry.properties.find(property => {
                    if (!(property.access & 2) || !/^state(?:_[A-Za-z0-9_]+)?$/.test(property.property)) return false;
                    try { return entity.endpoint?.(property.endpoint || 'default')?.ID === scene.endpoint; }
                    catch { return false; }
                })?.property;
                if (!control) continue;
            }
            result.push({...scene, target: {type: entry.type, id: entry.id}, control_property: control});
        }
    }
    return result;
}

const DEBUG_EVENTS = {"event_01":{"event":"AKTION","message":"Gespeicherte Revision für neue Auslöser aktiviert."},"event_02":{"event":"AKTION","message":"Ausführung gestoppt; ausstehende Verzögerungen verworfen."},"event_03":{"event":"EMPFANG","message":"Neue Eigenschaften einer konfigurierten Quelle ausgewertet."},"event_04":{"event":"AKTION","message":"Wert unverändert; Auslöser verlangt eine Wertänderung."},"event_05":{"event":"AKTION","message":"Regellauf nicht gestartet."},"event_06":{"event":"START","message":"Auslöser und Bedingungen erfüllt; Aktionsfolge begonnen."},"event_07":{"event":"FEHLER","message":"Aktionsfolge abgebrochen; keine automatische Wiederholung."},"event_08":{"event":"ENDE","message":"Aktionsfolge beendet; Übergaben sind keine Gerätebestätigung."},"event_09":{"event":"AKTION","message":"Bedingung vor Aktion nicht mehr erfüllt."},"event_10":{"event":"AKTION","message":"Vorhandene Szene für den Aufruf erneut geprüft."},"event_11":{"event":"AKTION","message":"Umschaltziel aus dem aktuellen Z2M-Zustand ermittelt."},"event_12":{"event":"FEHLER","message":"Bridge-Abonnement konnte beim Stopp nicht entfernt werden."},"event_13":{"event":"SENDEN","message":"Freigabe für eine Aktion im zweiten Z2M-System angefordert."},"event_14":{"event":"EMPFANG","message":"Zielsystem hat die native Befehlsübergabe bestätigt; Gerätewirkung nicht bestätigt."},"event_15":{"event":"EMPFANG","message":"Einmalig freigegebene Aktion vom zweiten Z2M-System empfangen."},"event_16":{"event":"FEHLER","message":"Empfangene Aktion nicht ausgeführt; keine automatische Wiederholung."},"event_17":{"event":"FEHLER","message":"Bridge-Nachricht verworfen; keine zusätzliche Geräteaktion."},"event_18":{"event":"FEHLER","message":"MQTT-Antwort konnte nicht veröffentlicht werden."},"event_19":{"event":"START","message":"Erweiterung starten."},"event_20":{"event":"FEHLER","message":"Geräteereignis verworfen; interne Verarbeitung fehlgeschlagen."},"event_21":{"event":"ENDE","message":"Startaufruf beendet."},"event_22":{"event":"START","message":"Erweiterung stoppen."},"event_23":{"event":"ENDE","message":"Stoppaufruf beendet."},"event_24":{"event":"AKTION","message":"Kein gespeicherter Betriebszustand; Automationen bleiben gestoppt."},"event_25":{"event":"AKTION","message":"Kein automatischer Wiederanlauf: bewusst gestoppt oder Wiederanlauf ausgeschaltet."},"event_26":{"event":"AKTION","message":"Automationen nach Neustart automatisch aktiviert; neue Auslöser und ausdrücklich freigegebene Fortsetzungen werden verarbeitet."},"event_27":{"event":"FEHLER","message":"Automatischer Wiederanlauf abgebrochen; Automationen bleiben gestoppt."},"event_28":{"event":"START","message":"Erweiterungsauftrag empfangen."},"event_29":{"event":"ENDE","message":"Erweiterungsauftrag beendet; Ergebnis siehe Antwort."},"event_30":{"event":"FEHLER","message":"Ungültigen Erweiterungsauftrag abgewiesen."},"event_31":{"event":"AKTION","message":"Vorhandene Szenen für den Klick-Editor gelesen; keine Geräte geschaltet."},"event_32":{"event":"FEHLER","message":"Erweiterungsauftrag abgewiesen."},"event_33":{"event":"FEHLER","message":"Entwurf an dieser Stelle korrigieren."},"event_34":{"event":"AKTION","message":"Bedingung geprüft."},"event_35":{"event":"AKTION","message":"Auslöser geprüft."},"event_36":{"event":"AKTION","message":"Mindestdauer begonnen."},"event_37":{"event":"AKTION","message":"Mindestdauer abgebrochen."},"event_38":{"event":"AKTION","message":"Mindestdauer erreicht."},"event_39":{"event":"AKTION","message":"Zeitpunkt erreicht."},"event_40":{"event":"AKTION","message":"Wartezeit vor Aktionsschritt begonnen."},"event_41":{"event":"AKTION","message":"Wartezeit vor Aktionsschritt beendet."},"event_42":{"event":"AKTION","message":"Aktionsschritt wegen Stopp abgebrochen."},"event_43":{"event":"EMPFANG","message":"Native Befehlsverarbeitung hat die Übergabe angenommen; Gerätewirkung nicht bestätigt."},"event_44":{"event":"SENDEN","message":"Set-Aktion an native Z2M-Befehlsverarbeitung übergeben; Gerätewirkung nicht bestätigt."},"scene_send":{"event":"SENDEN","message":"Szenenaufruf an native Z2M-Befehlsverarbeitung übergeben; Gerätewirkung nicht bestätigt."},"step_failed":{"event":"FEHLER","message":"Aktionsschritt fehlgeschlagen; die restliche Folge wird abgebrochen."},"astro_plan":{"event":"AKTION","message":"Astro-Auslöser für den heutigen Tag geprüft; Zeitversatz berücksichtigt."},"astro_missing":{"event":"AKTION","message":"Heute gibt es für dieses Sonnenereignis keinen Zeitpunkt; Auslöser wird übersprungen."},"astro_due":{"event":"AKTION","message":"Astro-Zeitpunkt einschließlich Zeitversatz erreicht."},"once_request":{"event":"AKTION","message":"Einmaliger Start angefordert; gespeicherte Auslöser bleiben unverändert."},"once_start":{"event":"START","message":"Einmaliger Regellauf mit erfüllten Bedingungen begonnen."},"run_stop":{"event":"AKTION","message":"Ausgewählten Regellauf gestoppt; bereits übergebene Befehle bleiben wirksam."},"sequence_start":{"event":"AKTION","message":"Wiederverwendbare Aktionsfolge im Regellauf begonnen."},"event_45":{"event":"AKTION","message":"Kalendertag gegen erlaubte Wochentage geprüft."},"event_46":{"event":"AKTION","message":"Erneute Auslösung ignoriert; vorhandener Regellauf bleibt unverändert."},"event_47":{"event":"AKTION","message":"Erneute Auslösung wegen nicht erfüllter Bedingungen verworfen; vorhandener Lauf bleibt unverändert."},"event_48":{"event":"AKTION","message":"Keine laufende Wartezeit; erneute Auslösung verändert den Ablauf nicht."},"event_49":{"event":"AKTION","message":"Wartezeit wegen erneuter Auslösung auf volle Dauer zurückgesetzt."},"event_50":{"event":"AKTION","message":"Neustart wegen erneuter Auslösung vorgemerkt; laufende Befehlsübergabe wird abgewartet."},"event_51":{"event":"FEHLER","message":"Vorgemerkter Neustart wegen fehlgeschlagener oder unbestätigter Befehlsübergabe verworfen."},"event_52":{"event":"AKTION","message":"Vorheriger Lauf beendet; erneute Auslösung wird für Neustart geprüft."},"condition_start_only":{"event":"AKTION","message":"Nur beim Start gültige Bedingung im laufenden Ablauf nicht erneut geprüft."},"event_53":{"event":"FEHLER","message":"Fortsetzungspunkt konnte nicht gelöscht werden; keine automatische Wiederholung erlaubt."},"event_54":{"event":"FEHLER","message":"Gestoppter Lauf konnte im Fortsetzungsspeicher nicht bestätigt werden."},"event_55":{"event":"AKTION","message":"Unterbrochener Lauf nicht fortgesetzt: Freigabe fehlt, Wartezeit abgelaufen oder Uhrzeit unplausibel."},"event_56":{"event":"AKTION","message":"Wartezeit während Neustart abgelaufen; ausstehenden Schritt mit erneuter Bedingungsprüfung nachholen."},"event_57":{"event":"AKTION","message":"Unterbrochenen Lauf am gespeicherten Aktionsschritt mit verbleibender Wartezeit fortsetzen."},"event_58":{"event":"AKTION","message":"Wartepunkt für Fortsetzung nach Z2M-Neustart dauerhaft gespeichert."},"event_59":{"event":"FEHLER","message":"Verlängerte Wartezeit konnte nicht gespeichert werden; Lauf beendet."},"event_60":{"event":"FEHLER","message":"Fortsetzungsspeicher konnte beim Beenden nicht bestätigt werden."},"event_61":{"event":"FEHLER","message":"Fortsetzungsspeicher unlesbar oder unpassend; kein gespeicherter Lauf wird fortgesetzt."}};

export {DEBUG_EVENTS};
const debugCodes = new Map(Object.entries(DEBUG_EVENTS).map(([code, entry]) => [entry.message, code]));
const debugUUID = value => typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
export const debugTrace = value => value && debugUUID(value.run) && Number.isInteger(value.rule) && value.rule >= 1 && value.rule <= 100
    && (Number.isInteger(value.step) && value.step >= 1 && value.step <= 16 || Number.isInteger(value.condition) && value.condition >= 1 && value.condition <= 16)
    && Number.isSafeInteger(value.revision) && value.revision >= 1
    ? {run: value.run, rule: value.rule, revision: value.revision,
        ...(Number.isInteger(value.step) && value.step >= 1 && value.step <= 16 ? {step: value.step} : {}),
        ...(Number.isInteger(value.condition) && value.condition >= 1 && value.condition <= 16 ? {condition: value.condition} : {}),
        ...(Number.isInteger(value.sequence) && value.sequence >= 1 && value.sequence <= 32
            && Number.isInteger(value.sequence_step) && value.sequence_step >= 1 && value.sequence_step <= 16
            ? {sequence: value.sequence, sequence_step: value.sequence_step} : {})} : undefined;

// Live diagnostics only: no disk, retries, MQTT retain or awaited device-side work.
export class RuntimeDiagnostics {
    constructor(mqtt, clock = {}) {
        this.mqtt = mqtt;
        this.now = clock.now ?? (() => performance.now());
        this.wall = clock.wallNow ?? (() => Date.now());
        this.clients = new Map();
        this.queue = [];
        this.sending = false;
        this.setTimeout = clock.setTimeout ?? setTimeout;
        this.clearTimeout = clock.clearTimeout ?? clearTimeout;
        this.sentAt = [];
        this.dropped = 0;
        this.closed = false;
    }

    configure(client, seconds) {
        this.prune();
        if (this.closed || !debugUUID(client) || !Number.isInteger(seconds) || seconds < 0 || seconds > 900) return null;
        if (seconds > 0 && !this.clients.has(client) && this.clients.size >= 8) return null;
        if (seconds === 0) this.clients.delete(client);
        else this.clients.set(client, this.now() + seconds * 1000);
        return {debug_version: 1, client, seconds, active: seconds > 0};
    }

    prune() {
        for (const [client, until] of this.clients) if (until <= this.now()) this.clients.delete(client);
    }

    emit(message, details = {}, context = {}) {
        try {
            this.prune();
            const code = debugCodes.get(message);
            if (this.closed || !code || this.clients.size === 0 || this.mqtt.isConnected?.() === false) return;
            this.sentAt = this.sentAt.filter(time => this.now() - time < 1000);
            if (this.queue.length >= 128 || this.sentAt.length >= 80) { this.dropped = Math.min(1000000, this.dropped + 1); return; }
            const record = {id: randomUUID(), at: Math.trunc(this.wall()), event: code};
            if (debugUUID(context.run)) record.run = context.run;
            for (const [key, max] of Object.entries({sequence: 32, sequence_step: 16, rule: 100, trigger: 8, condition: 16, step: 16, revision: Number.MAX_SAFE_INTEGER, delay: 86400})) {
                if (Number.isSafeInteger(context[key]) && context[key] >= (key === 'delay' ? 0 : 1) && context[key] <= max) record[key] = context[key];
            }
            if (typeof context.origin === 'string' && context.origin.length <= 1024) record.origin = createHash('sha256').update(context.origin).digest('hex');
            if (typeof details.Erfüllt === 'boolean') record.passed = details.Erfüllt;
            const reason = details.Grund;
            if (['storage_error', 'inactive', 'already_running', 'concurrency_limit', 'cooldown', 'conditions_not_met', 'action_failed', 'action_timeout', 'unknown_entity', 'state_unavailable', 'rate_limited', 'scene_unavailable', 'mesh_timeout', 'mesh_unavailable', 'mesh_not_allowed', 'mesh_stopped', 'mesh_rejected', 'mesh_invalid', 'mesh_busy'].includes(reason)) record.reason = reason;
            this.sentAt.push(this.now());
            this.queue.push({clients: [...this.clients.keys()], record});
            if (!this.sending) void this.drain().catch(() => { this.dropped = Math.min(1000000, this.dropped + 1); });
        } catch { /* Diagnostics must not affect automation behavior. */ }
    }

    async drain() {
        this.sending = true;
        try {
            while (this.queue.length && !this.closed) {
                this.prune();
                const item = this.queue.shift();
                const clients = item.clients.filter(client => this.clients.has(client));
                if (!clients.length || this.mqtt.isConnected?.() === false) continue;
                const dropped = this.dropped;
                this.dropped = 0;
                let timer;
                try {
                    await Promise.race([
                        Promise.resolve().then(() => {
                            this.prune();
                            const recipients = clients.filter(client => this.clients.has(client));
                            if (this.closed || !recipients.length) return;
                            return this.mqtt.publish('symcon/automations/debug', JSON.stringify({protocol_version: 1,
                                debug_version: 1, session: this.session, clients: recipients, dropped, record: item.record}),
                            {skipLog: true, skipReceive: true, clientOptions: {qos: 0, retain: false}});
                        }),
                        new Promise((_, reject) => { timer = this.setTimeout(() => reject(new Error()), 2000); timer?.unref?.(); })
                    ]);
                } catch {
                    this.dropped = Math.min(1000000, this.dropped + dropped + 1 + this.queue.length);
                    this.queue.length = 0;
                }
                finally { this.clearTimeout(timer); }
            }
        } finally { this.sending = false; }
    }

    stop() { this.closed = true; this.clients.clear(); this.queue.length = 0; }
}

// Own bounded execution plan. Definitions contain leaf actions only, never calls.
export class SequenceError extends Error {
    constructor(reason, step) { super(reason); this.reason = reason; this.step = step; }
}

export function expandActionPlan(document, actions) {
    const plan = [];
    for (const [source_index, action] of actions.entries()) {
        if (action.type !== 'sequence') plan.push({action, source_index});
        else {
            const index = (document.sequences ?? []).findIndex(item => item.id === action.sequence_id);
            if (index < 0) throw new SequenceError('sequence_missing', source_index);
            for (const [inner, leaf] of document.sequences[index].actions.entries()) {
                if (leaf.type === 'sequence') throw new SequenceError('sequence_nested', source_index);
                const delay = (leaf.delay_seconds ?? 0) + (inner === 0 ? (action.delay_seconds ?? 0) : 0);
                if (delay > 86400) throw new SequenceError('sequence_delay', source_index);
                plan.push({action: {...leaf, delay_seconds: delay}, source_index, sequence: index + 1, sequence_step: inner + 1});
            }
        }
        if (plan.length > 16) throw new SequenceError('sequence_limit', source_index);
    }
    return plan;
}


// Only waiting automatic runs are recoverable. Commands are consumed before handoff.
export class RunJournal {
    constructor(store, binding, enabled) {
        this.store = store;
        this.binding = binding;
        this.enabled = enabled;
        this.runs = new Map();
        this.queue = Promise.resolve();
        this.frozen = false;
        this.failed = false;
        this.pending = 0;
    }

    save() {
        if (this.pending >= 64) { this.failed = true; return Promise.reject(new Error('storage_error')); }
        const payload = JSON.stringify({version: 1, ...this.binding(), runs: [...this.runs.values()]});
        const text = JSON.stringify({payload, checksum: createHash('sha256').update(payload).digest('hex')});
        if (Buffer.byteLength(text) > 32768) return Promise.reject(new Error('storage_error'));
        this.pending++;
        const task = this.queue.then(() => this.store.atomicWrite('running-automations.json', text)).finally(() => { this.pending--; });
        this.queue = task.catch(() => { this.failed = true; });
        return task;
    }

    put(record) {
        if (this.frozen) return Promise.resolve();
        if (this.failed || !this.enabled() || (!this.runs.has(record.run) && this.runs.size >= 16)) return Promise.reject(new Error('storage_error'));
        this.runs.set(record.run, record);
        return this.save();
    }

    remove(run) {
        if (this.frozen || !this.runs.delete(run)) return Promise.resolve();
        return this.save();
    }

    async reset(force = false) {
        const hadRuns = this.runs.size > 0;
        this.runs.clear();
        if (this.frozen) return;
        this.failed = false;
        if (hadRuns || force) await this.save();
    }

    async flush() {
        await this.queue;
        if (this.failed) throw new Error('storage_error');
    }

    async load() {
        this.frozen = false;
        this.failed = false;
        this.runs.clear();
        const path = join(this.store.directory, 'running-automations.json');
        let text;
        try {
            const stat = await this.store.io.lstat(path);
            if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32768) throw new Error('storage_error');
            const bytes = await this.store.io.readFile(path);
            if (bytes.length > 32768) throw new Error('storage_error');
            text = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
        } catch (error) {
            if (error.code === 'ENOENT') return [];
            throw error;
        }
        const envelope = JSON.parse(text);
        if (!envelope || Object.keys(envelope).length !== 2 || typeof envelope.payload !== 'string'
            || envelope.checksum !== createHash('sha256').update(envelope.payload).digest('hex')) throw new Error('storage_error');
        const saved = JSON.parse(envelope.payload), binding = this.binding();
        if (!saved || Object.keys(saved).length !== 5 || saved.version !== 1 || saved.system !== binding.system
            || saved.revision !== binding.revision || saved.checksum !== binding.checksum
            || !Array.isArray(saved.runs) || saved.runs.length > 16) throw new Error('storage_error');
        const rules = new Set(), runs = new Set();
        for (const item of saved.runs) {
            if (!item || Object.keys(item).length !== 6 || typeof item.rule_id !== 'string'
                || typeof item.run !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(item.run)
                || !Number.isInteger(item.step) || item.step < 1 || item.step > 16
                || !Number.isSafeInteger(item.saved_at) || item.saved_at < 0
                || !Number.isSafeInteger(item.deadline) || item.deadline <= item.saved_at
                || !Number.isInteger(item.delay) || item.delay < 1 || item.delay > 86400000
                || item.deadline - item.saved_at > item.delay || rules.has(item.rule_id) || runs.has(item.run)) throw new Error('storage_error');
            rules.add(item.rule_id); runs.add(item.run);
            this.runs.set(item.run, item);
        }
        return [...this.runs.values()];
    }
}


export const LIMITS = Object.freeze({yamlBytes: 131072, requestBytes: 1048576, queuedRequests: 16});
const PREFIX = 'symcon/automations';
const VALID_TRANSACTION = /^[A-Za-z0-9_-]{1,64}$/;
const ERRORS = Object.freeze({
    invalid_request: 'Invalid request envelope.',
    invalid_yaml: 'YAML must contain one bounded JSON-compatible document without anchors, aliases or tags.',
    invalid_schema: 'Automation configuration does not conform to schema version 1.',
    invalid_semantics: 'Duplicate automation ID, invalid timezone, empty time window or unapproved remote action.',
    session_mismatch: 'Request does not belong to the current extension session.',
    revision_conflict: 'Expected revision does not match the stored configuration.',
    revision_reused: 'New revision must be exactly the stored revision plus one.',
    storage_unavailable: 'Storage requires attention before configurations can be saved.',
    storage_error: 'Configuration could not be persisted.',
    busy: 'Too many requests are pending.',
    not_ready: 'Extension is not accepting requests.',
    runtime_unavailable: 'Required Z2M runtime interfaces are unavailable.',
    unknown_entity: 'A configured device or group is unavailable.',
    scene_unavailable: 'The selected scene is no longer available on the target.',
    checksum_mismatch: 'Activation checksum does not match the stored configuration.',
    activation_expired: 'Request a fresh activation token before activating the stored revision.',
    mesh_unavailable: 'The bridge transport is unavailable.',
    mesh_not_allowed: 'The second Z2M system is not permitted.',
    rule_missing: 'The selected automation is not stored.',
    rule_busy: 'This automation is already running.',
    run_conflict: 'The selected run has ended or changed.'
});

class ConfigurationError extends Error {
    constructor(code, details = null) {
        super(ERRORS[code]);
        this.code = code;
        this.details = details;
    }
}

const fail = (code, details = null) => { throw new ConfigurationError(code, details); };
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isRevision = value => Number.isSafeInteger(value) && value >= 0;
const hash = text => createHash('sha256').update(text, 'utf8').digest('hex');
const validateSchema = new Ajv({strict: true, allowUnionTypes: true, allErrors: false}).compile(AUTOMATIONS_SCHEMA);
// Diagnostics select the declared branch, avoiding errors about other trigger/action types.
// Acceptance is still decided exclusively by the unchanged public schema above.
const diagnosticSchema = structuredClone(AUTOMATIONS_SCHEMA);
function selectDiagnosticBranches(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.oneOf) && node.oneOf.every(branch =>
        (branch.$ref ? AUTOMATIONS_SCHEMA.definitions[branch.$ref.split('/').at(-1)] : branch)?.properties?.type?.const)) {
        node.type = 'object';
        node.discriminator = {propertyName: 'type'};
    }
    for (const child of Object.values(node)) selectDiagnosticBranches(child);
}
selectDiagnosticBranches(diagnosticSchema);
const diagnoseSchema = new Ajv({strict: true, allowUnionTypes: true, allErrors: true, discriminator: true}).compile(diagnosticSchema);
const DETAIL_FIELDS = new Set(['schema_version', 'revision', 'automations', 'sequences', 'sequence_id', 'mesh_peers', 'restart_policy', 'id', 'name', 'enabled', 'triggers', 'conditions', 'actions',
    'type', 'device', 'property', 'operator', 'value', 'for_seconds', 'on_change', 'at', 'timezone', 'event', 'latitude', 'longitude', 'offset_minutes', 'after', 'before', 'weekdays', 'target', 'system', 'values', 'delay_seconds', 'scene_id', 'endpoint']);
const DETAIL_REASONS = new Set(['required', 'type', 'enum', 'const', 'pattern', 'minimum', 'maximum', 'minItems', 'maxItems', 'minLength', 'maxLength',
    'minProperties', 'maxProperties', 'additionalProperties', 'uniqueItems', 'not', 'discriminator']);
function schemaDetails(document) {
    diagnoseSchema(document);
    const issues = [];
    const seen = new Set();
    for (const error of diagnoseSchema.errors ?? []) {
        if (!DETAIL_REASONS.has(error.keyword)) continue;
        const parts = error.instancePath.split('/').slice(1);
        if (error.keyword === 'required') parts.push(error.params.missingProperty);
        const safe = [];
        for (const part of parts) {
            if (!DETAIL_FIELDS.has(part) && !/^(?:0|[1-9][0-9]{0,2})$/.test(part)) break;
            safe.push(part);
            if (part === 'values' || part === 'value') break; // Never include user-authored object keys or values.
        }
        const issue = {path: safe.length ? '/' + safe.join('/') : '', reason: error.keyword};
        if (error.keyword === 'type' && ['number', 'integer', 'boolean', 'string', 'array', 'object'].includes(error.params.type)) issue.reason = error.params.type;
        if (typeof error.params.limit === 'number') issue.limit = error.params.limit;
        const key = JSON.stringify(issue);
        if (!seen.has(key)) { seen.add(key); issues.push(issue); }
    }
    return {issues: issues.slice(0, 20), truncated: issues.length > 20};
}
const validateMeshAction = new Ajv({strict: true, allowUnionTypes: true}).addSchema(AUTOMATIONS_SCHEMA).getSchema(AUTOMATIONS_SCHEMA.$id + '#/definitions/leafAction');
const validateMeshCondition = new Ajv({strict: true, allowUnionTypes: true}).addSchema(AUTOMATIONS_SCHEMA).getSchema(AUTOMATIONS_SCHEMA.$id + '#/definitions/deviceCondition');
const yamlSchema = JSON_SCHEMA.withTags({
    ...mapTag,
    create: () => Object.create(null),
    addPair: (container, key, value) => {
        if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype', '<<'].includes(key)) return 'Unsupported mapping key';
        container[key] = value;
        return '';
    },
    has: (container, key) => Object.hasOwn(container, key),
    get: (container, key) => container[key]
});

export function validateYaml(yaml) {
    if (typeof yaml !== 'string' || yaml.length === 0 || Buffer.byteLength(yaml, 'utf8') > LIMITS.yamlBytes
        || Buffer.from(yaml, 'utf8').toString('utf8') !== yaml) fail('invalid_yaml');
    let document;
    try {
        const events = parseEvents(yaml, {maxDepth: 16});
        if (events.length > 20000 || events.filter(event => event.type === EVENT_ID.DOCUMENT).length !== 1) fail('invalid_yaml');
        for (const event of events) {
            if (event.type === EVENT_ID.ALIAS || event.anchorStart >= 0 || event.tagStart >= 0
                || (event.directives && event.directives.length !== 0)) fail('invalid_yaml');
        }
        [document] = constructFromEvents(events, {source: yaml, schema: yamlSchema, json: false, maxAliases: 0, maxTotalMergeKeys: 0});
    } catch (error) {
        const issue = {path: '', reason: 'yaml_syntax'};
        if (Number.isInteger(error.mark?.line) && error.mark.line >= 0 && error.mark.line < 1000000) {
            issue.line = error.mark.line + 1;
            if (Number.isInteger(error.mark.column) && error.mark.column >= 0 && error.mark.column < 1000000) issue.column = error.mark.column + 1;
        }
        fail('invalid_yaml', {issues: [issue], truncated: false});
    }
    if (!validateSchema(document)) fail('invalid_schema', schemaDetails(document));
    const ids = new Set();
    const issues = [];
    const sequenceIDs = new Set();
    for (const [index, sequence] of (document.sequences ?? []).entries()) {
        if (sequenceIDs.has(sequence.id)) issues.push({path: '/sequences/' + index + '/id', reason: 'sequence_duplicate'});
        sequenceIDs.add(sequence.id);
    }
    for (const [index, automation] of document.automations.entries()) {
        const path = '/automations/' + index;
        if (ids.has(automation.id)) issues.push({path: path + '/id', reason: 'duplicate_id'});
        ids.add(automation.id);
        for (const [condition, clause] of automation.conditions.entries()) {
            if (automation.enabled && clause.system !== undefined && !document.mesh_peers?.includes(clause.system)) {
                issues.push({path: path + '/conditions/' + condition + '/system', reason: 'remote_permission'});
            }
        }
        let plan = [];
        try { plan = expandActionPlan(document, automation.actions); }
        catch (error) {
            if (!(error instanceof SequenceError)) throw error;
            issues.push({path: path + '/actions/' + error.step + (error.reason === 'sequence_delay' ? '/delay_seconds' : '/sequence_id'), reason: error.reason});
        }
        for (const entry of plan) {
            const {action, source_index: step} = entry;
            if (automation.enabled && action.target.system !== undefined && !document.mesh_peers?.includes(action.target.system)) {
                const location = entry.sequence ? `/sequences/${entry.sequence - 1}/actions/${entry.sequence_step - 1}` : path + '/actions/' + step;
                if (!issues.some(issue => issue.path === location + '/target/system' && issue.reason === 'remote_permission')) {
                    issues.push({path: location + '/target/system', reason: 'remote_permission'});
                }
            }
        }
        for (const section of ['triggers', 'conditions']) for (const [step, clause] of automation[section].entries()) {
            const location = path + '/' + section + '/' + step;
            if (clause.timezone !== undefined) {
                try {
                    new Intl.DateTimeFormat('en', {timeZone: clause.timezone}).format(0);
                } catch {
                    issues.push({path: location + '/timezone', reason: 'timezone'});
                }
            }
            if (clause.type === 'time_window' && clause.after === clause.before) issues.push({path: location + '/before', reason: 'time_window'});
        }
    }
    if (issues.length) fail('invalid_semantics', {issues: issues.slice(0, 20), truncated: issues.length > 20});
    return {yaml, document, checksum: hash(yaml)};
}

// Bounded scalar capabilities and recognized writable colors enter the editor; raw definitions stay in Z2M.
export function buildEditorCatalog(zigbee) {
    const candidates = [];
    let optionCount = 0, devicesSeen = 0;
    const scalar = value => value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
        || (typeof value === 'string' && [...value].length <= 256);
    for (const device of zigbee?.devicesIterator?.() ?? []) {
        if (++devicesSeen > 256) break;
        if (!device?.isDevice?.() || device.zh?.type === 'Coordinator' || !/^0x[0-9a-f]{16}$/.test(device.ieeeAddr)) continue;
        const triggers = [], actions = [], numeric = [], properties = [];
        let visited = 0;
        const walk = (features, depth = 0, phase = 0, endpoint = '') => {
            if (!Array.isArray(features) || depth > 6) return;
            for (const feature of features) {
                if (++visited > 128 || optionCount >= 1024) break;
                if (!isObject(feature)) continue;
                const channel = typeof feature.endpoint === 'string' ? feature.endpoint : endpoint;
                // Composite children belong inside their parent payload, never at /set's top level.
                if (feature.type === 'composite') {
                    const members = feature.name === 'color_xy' ? ['x', 'y'] : feature.name === 'color_hs' ? ['hue', 'saturation'] : [];
                    if (phase === 1 && members.length && typeof feature.property === 'string' && feature.property.length <= 64 && /^color(?:_[A-Za-z0-9_]+)?$/.test(feature.property)
                        && (feature.access === undefined || (Number.isInteger(feature.access) && feature.access >= 0 && (feature.access & 2) !== 0))
                        && Array.isArray(feature.features) && feature.features.length === 2
                        && members.every(key => feature.features.filter(p => p?.property === key && p.type === 'numeric' && Number.isInteger(p.access) && p.access >= 0 && (p.access & 2) !== 0).length === 1)
                        && properties.length < 64 && !properties.some(p => p.property === feature.property)) {
                        properties.push({property: feature.property, type: 'color', access: 2, label: 'Color',
                            endpoint: typeof channel === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(channel) ? channel : '', values: []});
                        optionCount++;
                    }
                    continue;
                }
                walk(feature.features, depth + 1, phase, channel);
                if (typeof feature.property !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(feature.property)
                    || ['constructor', 'prototype', '__proto__'].includes(feature.property)) continue;
                const state = feature.type === 'binary' && (feature.property === 'state' || feature.name === 'state'
                    || (typeof feature.endpoint === 'string' && feature.property === 'state_' + feature.endpoint));
                const priority = state ? 0 : feature.type === 'enum' && /^(?:state|action)(?:_[A-Za-z0-9_]+)?$/.test(feature.property) ? 1 : 2;
                if (priority !== phase) continue;
                const admitted = [];
                const before = optionCount;
                if (feature.type === 'numeric' && (feature.access & 3) !== 0 && numeric.length < 64 && optionCount < 1024) {
                    if ((feature.access & 1) !== 0) {
                        numeric.push({property: feature.property, unit: typeof feature.unit === 'string' ? [...feature.unit].slice(0, 24).join('') : ''});
                    }
                    optionCount++;
                }
                const values = feature.type === 'binary' ? [feature.value_on, feature.value_off]
                    : feature.type === 'enum' && Array.isArray(feature.values) ? feature.values.slice(0, 32) : [];
                for (const value of values) {
                    if (!scalar(value) || optionCount >= 1024) continue;
                    const entry = {property: feature.property, value};
                    const prior = optionCount;
                    if ((feature.access & 1) !== 0 && triggers.length < 64 && optionCount < 1024) { triggers.push(entry); optionCount++; }
                    if ((feature.access & 2) !== 0 && actions.length < 64 && optionCount < 1024) { actions.push(entry); optionCount++; }
                    if (optionCount > prior && !admitted.includes(value)) admitted.push(value);
                }
                if (optionCount > before && properties.length < 64 && ['binary', 'enum', 'numeric'].includes(feature.type)
                    && !properties.some(item => item.property === feature.property)) {
                    const property = {property: feature.property, type: feature.type, access: feature.access & 3,
                        label: typeof feature.label === 'string' && !/[\x00-\x1f\x7f]/.test(feature.label) ? [...feature.label].slice(0, 80).join('') : feature.property,
                        endpoint: typeof channel === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(channel) ? channel : '', values: admitted};
                    if (feature.type === 'numeric') {
                        for (const [from, to] of [['value_min', 'minimum'], ['value_max', 'maximum'], ['value_step', 'step']]) {
                            if (typeof feature[from] === 'number' && Number.isFinite(feature[from]) && (to !== 'step' || feature[from] > 0)) property[to] = feature[from];
                        }
                    }
                    properties.push(property);
                }
            }
        };
        let features;
        try { features = device.exposes(); } catch { continue; }
        candidates.push({entry: {id: device.ieeeAddr,
            name: typeof device.name === 'string' ? [...device.name].slice(0, 120).join('') : device.ieeeAddr, triggers, actions, numeric, properties},
        scan: phase => { visited = 0; walk(features, 0, phase); }, failed: false});
    }
    // Reserve switch channels first, then button events and cover commands, before special options.
    for (const phase of [0, 1, 2]) {
        for (const candidate of candidates) {
            if (candidate.failed) continue;
            try { candidate.scan(phase); } catch { candidate.failed = true; }
        }
    }
    return candidates.filter(({entry, failed}) => !failed && (entry.triggers.length || entry.actions.length || entry.numeric.length || entry.properties.length)).map(({entry}) => entry);
}

// Only stable group identity and display name cross the editor boundary.
export function buildEditorGroups(zigbee) {
    const groups = [], seen = new Set();
    let visited = 0;
    for (const group of zigbee?.groupsIterator?.() ?? []) {
        if (++visited > 256) break;
        if (!Number.isInteger(group.ID) || group.ID < 1 || group.ID > 65535 || seen.has(group.ID)
            || typeof group.name !== 'string' || !group.name || /[\x00-\x1f\x7f+#]/.test(group.name)) continue;
        seen.add(group.ID);
        groups.push({id: group.ID, name: [...group.name].slice(0, 120).join('')});
    }
    return groups;
}

class ConfigurationStore {
    constructor(directory, io = fs) {
        this.directory = directory;
        this.io = io;
        this.current = null;
        this.state = 'empty';
    }

    metadata() {
        return {stored_revision: this.current?.document.revision ?? 0, checksum: this.current?.checksum ?? null,
            automation_count: this.current?.document.automations.length ?? 0, storage: this.state, executing: false};
    }

    async read(name) {
        const path = join(this.directory, name);
        let handle;
        try {
            const stat = await this.io.lstat(path);
            if (!stat.isFile() || stat.isSymbolicLink() || stat.size > LIMITS.yamlBytes) fail('storage_unavailable');
            handle = await this.io.open(path, 'r');
            const bytes = await handle.readFile();
            if (bytes.length > LIMITS.yamlBytes) fail('storage_unavailable');
            return validateYaml(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
        } finally {
            await handle?.close();
        }
    }

    async load() {
        this.current = null;
        this.state = 'empty';
        try {
            await this.io.mkdir(this.directory, {recursive: true, mode: 0o700});
            const directory = await this.io.lstat(this.directory);
            if (!directory.isDirectory() || directory.isSymbolicLink()) fail('storage_unavailable');
        } catch {
            this.state = 'error';
            return;
        }
        try {
            this.current = await this.read('automations.yaml');
            this.state = 'ok';
        } catch (error) {
            const missing = error.code === 'ENOENT';
            try {
                this.current = await this.read('automations.previous.yaml');
                // Never silently roll revision history back after a damaged/missing primary file.
                this.state = 'recovered_read_only';
            } catch (backupError) {
                this.state = missing && backupError.code === 'ENOENT' ? 'empty' : 'error';
            }
        }
    }

    async atomicWrite(name, yaml) {
        const temporary = join(this.directory, '.write-' + randomUUID() + '.tmp');
        let handle;
        let committed = false;
        try {
            handle = await this.io.open(temporary, 'wx', 0o600);
            await handle.writeFile(yaml, 'utf8');
            await handle.sync();
            await handle.close();
            handle = null;
            await this.io.rename(temporary, join(this.directory, name));
            committed = true;
        } finally {
            await handle?.close().catch(() => {});
            if (!committed) await this.io.unlink(temporary).catch(() => {});
        }
    }

    async verifyDisk() {
        try {
            // Verify that the primary has not been edited outside this extension since loading.
            if (this.current) {
                const disk = await this.read('automations.yaml');
                if (disk.checksum !== this.current.checksum) fail('storage_unavailable');
            } else {
                try {
                    await this.io.lstat(join(this.directory, 'automations.yaml'));
                    fail('storage_unavailable');
                } catch (error) {
                    if (error.code !== 'ENOENT') throw error;
                }
            }
        } catch {
            this.state = 'error';
            fail('storage_unavailable');
        }
    }

    async save(candidate, expectedRevision) {
        if (!['ok', 'empty'].includes(this.state)) fail('storage_unavailable');
        await this.verifyDisk();
        const revision = this.current?.document.revision ?? 0;
        if (candidate.document.revision === revision && candidate.checksum === this.current?.checksum
            && [revision, revision - 1].includes(expectedRevision)) {
            return {...this.metadata(), unchanged: true};
        }
        if (expectedRevision !== revision) fail('revision_conflict');
        if (candidate.document.revision !== revision + 1) fail('revision_reused');
        try {
            if (this.current) await this.atomicWrite('automations.previous.yaml', this.current.yaml);
            await this.atomicWrite('automations.yaml', candidate.yaml);
        } catch {
            fail('storage_error');
        }
        this.current = candidate;
        this.state = 'ok';
        return {...this.metadata(), unchanged: false};
    }
}

export default class Z2MAutomationsExtension {
    constructor(_zigbee, mqtt, _state, _publishEntityState, eventBus, _enableDisableExtension, _restartCallback, _addExtension, settings, logger, options = {}) {
        this.mqtt = mqtt;
        this.eventBus = eventBus;
        this.settings = settings;
        this.logger = logger;
        this.zigbee = _zigbee;
        this.clock = options.clock;
        this.diagnostics = new RuntimeDiagnostics(mqtt, options.clock);
        this.runtime = new AutomationRuntime({zigbee: _zigbee, logger, clock: options.clock,
            remoteDispatch: (action, context) => this.mesh.dispatch(action, context),
            remoteCondition: (clause, context) => this.mesh.condition(clause, context),
            onDeactivate: () => this.mesh?.cancel(),
            onCancelRun: run => this.mesh?.cancelRun(run),
            readState: typeof _state?.get === 'function' ? entity => _state.get(entity) : undefined,
            dispatch: (topic, message) => this.eventBus.emitMQTTMessage({topic: this.baseTopic + '/' + topic, message}),
            available: typeof eventBus.onPublishEntityState === 'function' && typeof eventBus.emitMQTTMessage === 'function'});
        this.runtime.diagnostics = this.diagnostics;
        this.runStatusDirty = false;
        this.runStatusTask = null;
        this.runtime.onExecutionChange = () => this.queueExecutionStatus();
        // A real deployed file is in data/external_extensions, including Z2M temporary import copies.
        const directory = options.directory ?? fileURLToPath(new URL('../z2m-automations/', import.meta.url));
        this.store = new ConfigurationStore(directory, options.io ?? fs);
        this.runJournal = new RunJournal(this.store, () => ({system: this.baseTopic,
            revision: this.store.current?.document.revision ?? 0, checksum: this.store.current?.checksum ?? null}),
        () => this.executionIntent?.active === true && this.executionIntent?.enabled === true);
        this.runtime.journal = this.runJournal;
        this.queue = Promise.resolve();
        this.pending = 0;
        this.accepting = false;
        this.session = '';
        this.activationToken = null;
        this.executionIntent = null;
        this.resumeStatus = 'unconfigured';
        this.resumeError = '';
        this.monotonicNow = options.clock?.now ?? (() => performance.now());
    }

    status() {
        return {protocol_version: 1, schema_version: 1, extension_version: EXTENSION_VERSION, extension_build: EXTENSION_BUILD, debug_version: 1, catalog_version: 1,
            resume_version: 1, resume_enabled: this.executionIntent?.enabled ?? false,
            resume_status: this.resumeStatus, resume_error: this.resumeError,
            mesh_version: 1, mesh_ready: Boolean(this.mesh?.subscribed && this.runtime.active?.document.mesh_peers?.length),
            mesh_peer_count: this.runtime.active?.document.mesh_peers?.length ?? 0,
            execution_version: 1, sequence_version: 1, execution: this.executionStatus(),
            session: this.session, state: this.accepting ? 'ready' : 'stopped', ...this.store.metadata(), ...this.runtime.metadata()};
    }

    queueExecutionStatus() {
        this.runStatusDirty = true;
        if (this.runStatusTask) return;
        // Keep at most one publish in flight and coalesce intervening changes.
        // Reporting never blocks device actions and never queues old snapshots.
        this.runStatusTask = Promise.resolve().then(async () => {
            while (this.runStatusDirty && this.accepting) {
                this.runStatusDirty = false;
                await this.publish('runs', this.executionStatus());
            }
        }).catch(() => {}).finally(() => {
            this.runStatusTask = null;
            if (this.runStatusDirty && this.accepting) this.queueExecutionStatus();
        });
    }

    executionStatus() {
        const snapshot = this.runtime.executionSnapshot(), current = this.store.current;
        return {protocol_version: 1, execution_version: 1, session: this.session,
            revision: current?.document.revision ?? 0, checksum: current?.checksum ?? null,
            sequence: snapshot.sequence, runs: snapshot.runs.filter(run => run.checksum === current?.checksum && run.revision === current?.document.revision)};
    }

    async publish(topic, data, retain = false) {
        try {
            await this.mqtt.publish(PREFIX + '/' + topic, JSON.stringify(data), {clientOptions: {retain, qos: 0}, skipLog: true});
        } catch {
            this.runtime.log('FEHLER', 'MQTT-Antwort konnte nicht veröffentlicht werden.');
        }
    }

    async start() {
        this.runtime.log('START', 'Erweiterung starten.');
        try {
            if (this.accepting) return;
            if (this.diagnostics.closed) {
                this.diagnostics = new RuntimeDiagnostics(this.mqtt, this.clock);
                this.runtime.diagnostics = this.diagnostics;
            }
            this.baseTopic = this.settings.get().mqtt.base_topic;
            this.runJournal.frozen = false;
            this.runtime.system = this.baseTopic;
            this.mesh = new MeshTransport({mqtt: this.mqtt, system: this.baseTopic, runtime: this.runtime, validateAction: validateMeshAction, validateCondition: validateMeshCondition, clock: this.clock});
            this.session = randomUUID();
            this.runtime.results.clear();
            this.runtime.executionSequence = 0;
            this.diagnostics.session = this.session;
            this.activationToken = null;
            await this.store.load();
            this.accepting = true;
            // Serialize user commands behind startup recovery, especially explicit stop.
            this.queue = this.restoreExecution();
            this.eventBus.onMQTTMessage(this, message => this.receive(message));
            this.eventBus.onPublishEntityState?.(this, event => {
                try { this.runtime.receive(event); }
                catch { this.runtime.log('FEHLER', 'Geräteereignis verworfen; interne Verarbeitung fehlgeschlagen.'); }
            });
            await this.queue;
            await this.publish('status', this.status(), true);
        } finally { this.runtime.log('ENDE', 'Startaufruf beendet.', {Bereit: this.accepting}); }
    }

    async stop() {
        this.runtime.log('START', 'Erweiterung stoppen.');
        try {
            this.accepting = false;
            this.runJournal.frozen = true;
            this.activationToken = null;
            this.eventBus.removeListeners(this);
            this.runtime.deactivate();
            await this.mesh?.stop();
            await this.queue;
            await this.runtime.stop();
            try { await this.runJournal.flush(); }
            catch { this.runtime.log('FEHLER', 'Fortsetzungsspeicher konnte beim Beenden nicht bestätigt werden.'); }
            this.diagnostics.stop();
            await this.publish('status', this.status(), true);
        } finally { this.runtime.log('ENDE', 'Stoppaufruf beendet.', {Bereit: this.accepting}); }
    }

    validateScenes(candidate) {
        const issues = [];
        for (const [rule, automation] of [...candidate.document.automations, ...(candidate.document.sequences ?? [])].entries()) {
            for (const [step, action] of automation.actions.entries()) {
                if (action.type !== 'scene' || action.target.system !== undefined) continue;
                let available = false;
                try { available = hasScene(this.runtime.target(action.target), action.target.type, action); }
                catch { /* A missing entity is reported at the same actionable scene position. */ }
                if (!available) {
                    const location = rule < candidate.document.automations.length ? `/automations/${rule}` : `/sequences/${rule - candidate.document.automations.length}`;
                    issues.push({path: `${location}/actions/${step}/scene_id`, reason: 'scene_unavailable'});
                }
            }
        }
        if (issues.length) fail('invalid_semantics', {issues: issues.slice(0, 20), truncated: issues.length > 20});
    }

    async persistExecution(active, enabled = this.executionIntent?.enabled ?? false) {
        const intent = {version: 1, system: this.baseTopic, enabled, active,
            revision: this.store.current?.document.revision ?? 0, checksum: this.store.current?.checksum ?? null};
        try {
            await this.store.atomicWrite('execution-state.json', JSON.stringify(intent));
        } catch {
            this.resumeStatus = 'blocked';
            this.resumeError = 'storage_error';
            fail('storage_error');
        }
        this.executionIntent = intent;
        this.resumeStatus = active ? (enabled ? 'armed' : 'disabled') : 'stopped';
        this.resumeError = '';
    }

    async prepareMesh() {
        if (!this.accepting) fail('not_ready');
        const peers = this.store.current.document.mesh_peers ?? [];
        if (peers.length) {
            if (peers.includes(this.baseTopic) || !meshSystemValid(this.baseTopic)) fail('mesh_not_allowed');
            await this.mesh.start();
        }
        if (!this.accepting) {
            await this.mesh.stop();
            fail('not_ready');
        }
    }

    async restoreExecution() {
        this.executionIntent = null;
        this.resumeStatus = 'unconfigured';
        this.resumeError = '';
        try {
            const path = join(this.store.directory, 'execution-state.json');
            let intent;
            try {
                const stat = await this.store.io.lstat(path);
                if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) fail('storage_unavailable');
                const bytes = await this.store.io.readFile(path);
                if (bytes.length > 4096) fail('storage_unavailable');
                intent = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
            } catch (error) {
                if (error.code === 'ENOENT') {
                    this.runtime.log('AKTION', 'Kein gespeicherter Betriebszustand; Automationen bleiben gestoppt.');
                    return;
                }
                throw error;
            }
            if (!isObject(intent) || Object.keys(intent).length !== 6 || intent.version !== 1 || intent.system !== this.baseTopic
                || typeof intent.enabled !== 'boolean' || typeof intent.active !== 'boolean' || !isRevision(intent.revision)
                || (intent.revision === 0 ? intent.checksum !== null : !/^[a-f0-9]{64}$/.test(intent.checksum))) fail('storage_unavailable');
            this.executionIntent = intent;
            this.resumeStatus = !intent.active ? 'stopped' : !intent.enabled ? 'disabled' : 'armed';
            if (!intent.active || !intent.enabled) {
                this.runtime.log('AKTION', 'Kein automatischer Wiederanlauf: bewusst gestoppt oder Wiederanlauf ausgeschaltet.');
                return;
            }
            if (this.store.state !== 'ok' || !this.store.current || intent.revision !== this.store.current.document.revision
                || intent.checksum !== this.store.current.checksum) fail('storage_unavailable');
            await this.store.verifyDisk();
            await this.prepareMesh();
            this.runtime.activate(this.store.current);
            this.resumeStatus = 'resumed';
            this.runtime.log('AKTION', 'Automationen nach Neustart automatisch aktiviert; neue Auslöser und ausdrücklich freigegebene Fortsetzungen werden verarbeitet.',
                {Revision: intent.revision, Regeln: this.runtime.rules.length});
            try {
                const records = await this.runJournal.load();
                const scheduled = this.runtime.restoreRuns(records);
                for (const saved of records) if (!scheduled.has(saved.run)) await this.runJournal.remove(saved.run);
            } catch {
                this.runJournal.failed = true;
                this.runtime.lastError = 'storage_error';
                this.runtime.log('FEHLER', 'Fortsetzungsspeicher unlesbar oder unpassend; kein gespeicherter Lauf wird fortgesetzt.');
            }
        } catch (error) {
            this.runtime.deactivate();
            this.resumeStatus = 'blocked';
            this.resumeError = error instanceof ConfigurationError || error instanceof RuntimeError ? error.code : 'storage_unavailable';
            this.runtime.log('FEHLER', 'Automatischer Wiederanlauf abgebrochen; Automationen bleiben gestoppt.', {Grund: this.resumeError});
        }
    }

    async receive(event) {
        if (this.accepting && this.mesh && await this.mesh.receive(event)) return;
        const prefix = this.baseTopic + '/' + PREFIX + '/request/';
        if (typeof event?.topic !== 'string' || !event.topic.startsWith(prefix)) return;
        const operation = event.topic.slice(prefix.length);
        if (operation === 'debug') {
            // Debug leases never enter the automation/storage queue or alter its status.
            let request;
            try {
                if (event.retain === true || typeof event.message !== 'string' || Buffer.byteLength(event.message) > 1024) throw new Error();
                request = JSON.parse(event.message);
                if (!isObject(request) || Object.keys(request).sort().join(',') !== 'client,protocol_version,seconds,session,transaction'
                    || request.protocol_version !== 1 || (typeof request.transaction !== 'string' || !VALID_TRANSACTION.test(request.transaction))
                    || request.session !== this.session || !this.accepting) throw new Error();
                const data = this.diagnostics.configure(request.client, request.seconds);
                if (!data) throw new Error();
                await this.publish('response/debug', {protocol_version: 1, transaction: request.transaction, status: 'ok', data});
            } catch {
                if (typeof request?.transaction === 'string' && VALID_TRANSACTION.test(request.transaction)) {
                    await this.publish('response/debug', {protocol_version: 1, transaction: request.transaction, status: 'error', error: {code: 'invalid_request'}});
                }
            }
            return;
        }
        if (!['validate', 'store', 'get', 'status', 'activate', 'deactivate', 'editor', 'catalog', 'run_once', 'stop_rule'].includes(operation)) return;
        this.runtime.log('START', 'Erweiterungsauftrag empfangen.', {Auftrag: operation});
        try { await this.handleRequest(operation, event); }
        finally { this.runtime.log('ENDE', 'Erweiterungsauftrag beendet; Ergebnis siehe Antwort.', {Auftrag: operation}); }
    }

    async handleRequest(operation, event) {
        let request;
        try {
            if (typeof event.message !== 'string' || Buffer.byteLength(event.message, 'utf8') > LIMITS.requestBytes) fail('invalid_request');
            request = JSON.parse(event.message);
            if (!isObject(request) || request.protocol_version !== 1 || typeof request.transaction !== 'string'
                || !VALID_TRANSACTION.test(request.transaction)) fail('invalid_request');
            const keys = ['protocol_version', 'transaction', ...(['validate', 'store'].includes(operation) ? ['yaml'] : []),
                ...(operation === 'store' ? ['session', 'expected_revision'] : []),
                ...(operation === 'activate' ? ['session', 'expected_revision', 'checksum', 'activation_token'] : []),
                ...(operation === 'deactivate' ? ['session'] : [])];
            if (['run_once', 'stop_rule'].includes(operation)) keys.push('session', 'rule_id', 'expected_revision', 'checksum');
            if (operation === 'run_once') keys.push('activation_token');
            if (operation === 'stop_rule') keys.push('run');
            if (operation === 'activate' && Object.hasOwn(request, 'resume_after_restart')) {
                if (typeof request.resume_after_restart !== 'boolean') fail('invalid_request');
                keys.push('resume_after_restart');
            }
            if (Object.keys(request).length !== keys.length || keys.some(key => !Object.hasOwn(request, key))) fail('invalid_request');
        } catch {
            this.runtime.log('FEHLER', 'Ungültigen Erweiterungsauftrag abgewiesen.', {Auftrag: operation, Grund: 'invalid_request'});
            const transaction = typeof request?.transaction === 'string' && VALID_TRANSACTION.test(request.transaction) ? request.transaction : undefined;
            await this.publish('response/' + operation, {protocol_version: 1, transaction, status: 'error', error: {code: 'invalid_request', message: ERRORS.invalid_request}});
            return;
        }
        if (!this.accepting || this.pending >= LIMITS.queuedRequests) {
            const code = this.accepting ? 'busy' : 'not_ready';
            await this.respond(operation, request.transaction, null, code);
            return;
        }
        this.pending++;
        const task = this.queue.then(async () => {
            try {
                if (!this.accepting) fail('not_ready');
                let data;
                if (operation === 'status') {
                    this.activationToken = {value: randomUUID(), expires: this.monotonicNow() + 30000};
                    // Only a correlated status response carries this one-use challenge, never retained status.
                    data = {...this.status(), activation_token: this.activationToken.value};
                }
                if (operation === 'get') data = {...this.store.metadata(), executing: this.runtime.metadata().executing, yaml: this.store.current?.yaml ?? null};
                if (['run_once', 'stop_rule'].includes(operation)) {
                    if (request.session !== this.session || event.retain === true) fail('session_mismatch');
                    if (!isRevision(request.expected_revision) || typeof request.checksum !== 'string'
                        || !/^[a-f0-9]{64}$/.test(request.checksum) || typeof request.rule_id !== 'string'
                        || !/^[a-z][a-z0-9_-]{0,63}$/.test(request.rule_id)) fail('invalid_request');
                    if (this.store.state !== 'ok' || !this.store.current) fail('storage_unavailable');
                    if (request.expected_revision !== this.store.current.document.revision) fail('revision_conflict');
                    if (request.checksum !== this.store.current.checksum) fail('checksum_mismatch');
                    if (operation === 'run_once') {
                        const token = this.activationToken; this.activationToken = null;
                        if (!token || request.activation_token !== token.value || token.expires <= this.monotonicNow()) fail('activation_expired');
                        const generation = this.runtime.generation;
                        await this.store.verifyDisk();
                        if (!this.accepting || generation !== this.runtime.generation) fail('not_ready');
                        const selected = this.store.current.document.automations.find(rule => rule.id === request.rule_id);
                        if (selected && (selected.conditions.some(clause => clause.system !== undefined)
                            || expandActionPlan(this.store.current.document, selected.actions).some(step => step.action.target.system !== undefined))) await this.prepareMesh();
                        if (!this.accepting || generation !== this.runtime.generation) fail('not_ready');
                        this.runtime.startOnce(this.store.current, request.rule_id);
                    } else {
                        if (typeof request.run !== 'string' || !/^[a-f0-9-]{36}$/.test(request.run)) fail('invalid_request');
                        this.runtime.stopRule(request.rule_id, request.run);
                        try { await this.runJournal.flush(); }
                        catch {
                            await this.persistExecution(Boolean(this.runtime.active), false);
                            fail('storage_error');
                        }
                    }
                    data = this.executionStatus();
                }
                if (operation === 'editor' || operation === 'catalog') {
                    const devices = buildEditorCatalog(this.zigbee), groups = buildEditorGroups(this.zigbee);
                    const scenes = buildEditorScenes(this.zigbee, devices, groups);
                    data = {...this.status(), devices, groups, scenes, ...(operation === 'catalog' ? {} : {
                        editor_version: 1, yaml: this.store.current?.yaml ?? null,
                        configuration: this.store.current?.document ?? {schema_version: 1, revision: 0, automations: []}})};
                    this.runtime.log('AKTION', 'Vorhandene Szenen für den Klick-Editor gelesen; keine Geräte geschaltet.', {Szenen: scenes.length});
                }
                if (operation === 'validate') {
                    const candidate = validateYaml(request.yaml);
                    this.validateScenes(candidate);
                    data = {valid: true, revision: candidate.document.revision, checksum: candidate.checksum,
                        automation_count: candidate.document.automations.length, executing: false};
                }
                if (operation === 'store') {
                    if (request.session !== this.session || event.retain === true) fail('session_mismatch');
                    if (!isRevision(request.expected_revision)) fail('invalid_request');
                    const candidate = validateYaml(request.yaml);
                    this.validateScenes(candidate);
                    if (candidate.checksum !== this.store.current?.checksum && ['ok', 'empty'].includes(this.store.state)
                        && request.expected_revision === (this.store.current?.document.revision ?? 0)
                        && candidate.document.revision === request.expected_revision + 1) {
                        this.runtime.deactivate();
                        await this.persistExecution(false);
                    }
                    data = await this.store.save(candidate, request.expected_revision);
                    this.activationToken = null;
                    if (!data.unchanged) { this.runtime.deactivate(); await this.runJournal.reset(true); }
                    data.executing = this.runtime.metadata().executing;
                }
                if (['activate', 'deactivate'].includes(operation)) {
                    if (request.session !== this.session || event.retain === true) fail('session_mismatch');
                    if (operation === 'activate') {
                        if (!isRevision(request.expected_revision) || typeof request.checksum !== 'string' || !/^[a-f0-9]{64}$/.test(request.checksum)) fail('invalid_request');
                        const token = this.activationToken;
                        this.activationToken = null;
                        if (!token || request.activation_token !== token.value || token.expires <= this.monotonicNow()) fail('activation_expired');
                        if (this.store.state !== 'ok' || !this.store.current) fail('storage_unavailable');
                        await this.store.verifyDisk();
                        if (!this.accepting) fail('not_ready');
                        if (request.expected_revision !== this.store.current.document.revision) fail('revision_conflict');
                        if (request.checksum !== this.store.current.checksum) fail('checksum_mismatch');
                        await this.prepareMesh();
                        // Disarm the previous durable intent before attempting a new activation.
                        await this.persistExecution(false, request.resume_after_restart ?? true);
                        if (this.runtime.active?.checksum !== this.store.current.checksum || this.runJournal.failed) await this.runJournal.reset(true);
                        if (!this.accepting) fail('not_ready');
                        this.runtime.activate(this.store.current);
                        try { await this.persistExecution(true, request.resume_after_restart ?? true); }
                        catch (error) { this.runtime.deactivate(); throw error; }
                        if (!this.accepting) this.runtime.deactivate();
                    } else {
                        this.activationToken = null;
                        this.runtime.deactivate();
                        await this.persistExecution(false);
                        await this.runJournal.reset(true);
                    }
                    data = this.status();
                }
                await this.respond(operation, request.transaction, data);
                if (['store', 'activate', 'deactivate'].includes(operation)) await this.publish('status', this.status(), true);
            } catch (error) {
                if (this.store.state === 'error') this.runtime.deactivate();
                const code = error instanceof ConfigurationError || error instanceof RuntimeError ? error.code : 'storage_error';
                this.runtime.log('FEHLER', 'Erweiterungsauftrag abgewiesen.', {Auftrag: operation, Grund: code});
                const details = error instanceof ConfigurationError ? error.details : null;
                for (const issue of details?.issues ?? []) this.runtime.log('FEHLER', 'Entwurf an dieser Stelle korrigieren.', {Position: issue.path, Grund: issue.reason});
                await this.respond(operation, request.transaction, null, code, details);
            } finally {
                this.pending--;
            }
        });
        // Keep the next request usable even when a transport or test boundary rejects.
        this.queue = task.catch(() => {});
        await task;
    }

    async respond(operation, transaction, data, code = null, details = null) {
        await this.publish('response/' + operation, code === null
            ? {protocol_version: 1, transaction, status: 'ok', data}
            : {protocol_version: 1, transaction, status: 'error', error: {code, message: ERRORS[code], ...(details ? {details} : {})}});
    }
}
