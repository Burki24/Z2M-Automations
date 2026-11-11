import {t, bindText, bindHTML, bindAttribute, localizedOption, localizeRecord, MessageError, ResponseError, locale, formatDate, formatNumber, onLanguageChange, installLanguagePicker, localizeResponse} from './localization.js';
/* Shared typed metadata and scheduling helpers for the rule editor. */
export {createUUID as requestIdentity} from './identity.js';
export function creationProperties(device, side, sourceKind = '') {
    const reading = side === 'source' || side === 'condition';
    const properties = (device?.properties ?? []).filter(property => reading ? property.readable && property.type !== 'color' : property.writable);
    if (!reading || !sourceKind) return properties;
    return properties.filter(property => sourceKind === 'measurement' ? property.type === 'numeric' : property.type !== 'numeric');
}

export function creationDevices(data, side, search = '', sourceKind = '') {
    const term = search.trim().toLocaleLowerCase(locale());
    return (data?.devices ?? []).filter(device => (side === 'target' || device.target.type === 'device' && (side === 'condition' || !device.target.system))
        && creationProperties(device, side, sourceKind).length > 0
        && `${device.name} ${device.key} ${device.target.system ?? data.module.baseTopic} ${device.target.id}`.toLocaleLowerCase(locale()).includes(term));
}

export function creationValue(property, side, input) {
    if (!property || input === '') throw new MessageError("ui.select.or.enter.a.value.c9280c1c");
    if (property.type === 'numeric') {
        const number = Number(input);
        if (!Number.isFinite(number)) throw new MessageError("ui.enter.a.valid.number.d56c739c");
        return number;
    }
    if (property.type === 'color') return {hex: input};
    const values = side === 'target' ? property.actionValues : property.values;
    const index = Number(input);
    if (!Number.isInteger(index) || index < 0 || index >= values.length) throw new MessageError("ui.select.one.of.the.available.8802882c");
    return values[index];
}

export function creationSchedule(type, values) {
    const timezone = values.timezone?.trim();
    if (!timezone) throw new MessageError("ui.select.a.time.zone.78ee35ef");
    if (type === 'time') {
        if (!Array.isArray(values.times) || values.times.length < 1 || values.times.length > 8) throw new MessageError("ui.enter.between.one.and.eight.3b133cb8");
        const times = values.times.map(value => {
            if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) throw new MessageError("ui.complete.each.time.entry.6e9a500f");
            return value.length === 5 ? value + ':00' : value;
        });
        if (new Set(times).size !== times.length) throw new MessageError("ui.this.time.has.been.entered.356d5c30");
        return {type, times, timezone};
    }
    if (type !== 'sun') throw new MessageError("ui.select.an.available.trigger.type.676567fe");
    if (!['sunrise', 'sunset'].includes(values.event)) throw new MessageError("ui.select.sunrise.or.sunset.0b2efc42");
    const number = (text, limit, message) => {
        if (typeof text !== 'string' || text.trim() === '' || !Number.isFinite(Number(text)) || Math.abs(Number(text)) > limit) throw new MessageError(message);
        return Number(text);
    };
    const latitude = number(values.latitude, 90, "ui.enter.a.latitude.between.90.d193c512");
    const longitude = number(values.longitude, 180, "ui.enter.a.longitude.between.180.b5c6b040");
    const offset_minutes = number(values.offset, 720, "ui.enter.an.offset.between.720.730402ef");
    if (!Number.isInteger(offset_minutes)) throw new MessageError("ui.enter.the.offset.as.whole.c76f638d");
    return {type, event: values.event, latitude, longitude, offset_minutes, timezone};
}
