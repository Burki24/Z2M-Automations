/* Local catalogs are compiled from JSON; this module has no translation dependency. */
import {catalogs} from './locales.js';

const supported = new Set(['de', 'en']);
const storageKey = 'z2ma.designer.language';
const normalize = value => typeof value === 'string' ? value.toLowerCase().split(/[-_]/)[0] : '';
function initialLanguage() {
    try { const saved = globalThis.localStorage?.getItem(storageKey); if (supported.has(saved)) return saved; } catch {}
    for (const candidate of globalThis.navigator?.languages ?? [globalThis.navigator?.language]) {
        if (supported.has(normalize(candidate))) return normalize(candidate);
    }
    return 'en';
}
let currentLanguage = initialLanguage();
const bindings = new WeakMap();
const references = new Set();
const collected = new FinalizationRegistry(reference => references.delete(reference));
const listeners = new Set();
let audit = null;
const valueOf = value => typeof value === 'function' ? valueOf(value()) : value;
export const language = () => currentLanguage;
export const locale = () => currentLanguage === 'de' ? 'de-DE' : 'en-GB';
export const formatNumber = value => new Intl.NumberFormat(locale(), {maximumFractionDigits: 20}).format(value);
export const formatDate = (value, options) => new Intl.DateTimeFormat(locale(), options ?? {dateStyle: 'medium', timeStyle: 'medium'}).format(value);
export function translate(catalog, selected, key, values = {}) {
    const count = Number.isFinite(values.count) ? new Intl.PluralRules(selected).select(values.count) : null;
    const text = catalog[selected]?.[count ? key + '.' + count : key] ?? catalog[selected]?.[key]
        ?? catalog.en?.[count ? key + '.' + count : key] ?? catalog.en?.[key];
    if (typeof text !== 'string') return 'Translation unavailable';
    return text.replace(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g, (_, name) => Object.hasOwn(values, name) ? (name === 'count' && Number.isFinite(values[name]) ? new Intl.NumberFormat(selected).format(values[name]) : String(values[name] ?? '')) : '{{' + name + '}}');
}
export const t = (key, values = {}) => translate(catalogs, currentLanguage, key, values);
function bind(element, property, provider, apply) {
    let entries = bindings.get(element);
    if (!entries) { entries = new Map(); bindings.set(element, entries); const reference = new WeakRef(element); references.add(reference); collected.register(element, reference); }
    const update = () => apply(valueOf(provider));
    entries.set(property, update); update(); return element;
}
export function bindText(element, provider) {
    // Own only the text node. Icons/controls appended later must survive a language change.
    element.textContent = valueOf(provider) ?? '';
    const text = element.firstChild?.nodeType === 3 ? element.firstChild : null;
    return bind(element, 'content', provider, value => {
        if (text?.parentNode === element) text.data = String(value ?? '');
        else element.textContent = value ?? '';
    });
}
export const bindAttribute = (element, name, provider) => bind(element, 'attribute:' + name, provider, value => { element.setAttribute(name, String(value ?? '')); });
function updateMarkup(existing, replacement) {
    const oldChildren = [...existing.childNodes].filter(node => !node.hasAttribute?.('data-language-picker')); const nextChildren = [...replacement.childNodes];
    if (oldChildren.length !== nextChildren.length) return;
    for (let index = 0; index < oldChildren.length; index++) {
        const old = oldChildren[index]; const next = nextChildren[index];
        if (old.nodeType === 3 && next.nodeType === 3) { if (old.data !== next.data) old.data = next.data; continue; }
        if (old.nodeType !== 1 || next.nodeType !== 1 || old.tagName !== next.tagName || old.id !== next.id) continue;
        for (const name of ['title', 'placeholder', 'aria-label', 'alt']) if (next.hasAttribute(name)) old.setAttribute(name, next.getAttribute(name));
        updateMarkup(old, next);
    }
}
export function bindHTML(element, provider) {
    element.innerHTML = valueOf(provider);
    if (element.tagName === 'DIALOG') element.append(languagePicker());
    return bind(element, 'content', provider, text => {
        const template = element.ownerDocument?.createElement('template');
        if (!template) return;
        template.innerHTML = text; updateMarkup(element, template.content);
    });
}
export function localizeRecord(factory) {
    return new Proxy(factory(), {get(_target, key) { const record = factory(); const value = Reflect.get(record, key); return typeof value === 'function' ? value.bind(record) : value; }});
}
export function localizedOption(provider, value, defaultSelected, selected) {
    const option = new Option(String(valueOf(provider)), value, defaultSelected, selected);
    bindText(option, provider); return option;
}
export class MessageError extends Error {
    constructor(key, values = {}) {
        super(t(key, values));
        Object.defineProperty(this, 'message', {get: () => t(key, values), configurable: true});
    }
}
export class ResponseError extends Error {
    constructor(response, fallback) {
        super();
        Object.defineProperty(this, 'message', {get: () => typeof response?.message === 'string' && response.message ? response.message : valueOf(fallback), configurable: true});
    }
}
// The adapter annotates display fields with stable keys. Never translate arbitrary
// strings, device names, scene names, protocol values or configuration documents.
export function localizeResponse(data) {
    if (!data || typeof data !== 'object' || data.presentation?.version !== 1 || !Array.isArray(data.presentation.messages) || data.presentation.messages.length > 256) return data;
    for (const descriptor of data.presentation.messages) {
        if (!descriptor || typeof descriptor !== 'object') continue;
        const path = descriptor.path;
        if (!Array.isArray(path) || path.length === 0 || path.length > 12 || !Object.hasOwn(catalogs.en, descriptor.key)
            || !descriptor.values || typeof descriptor.values !== 'object'
            || !['message', 'notice', 'assessment', 'lastError', 'details', 'blocked', 'createNotice', 'editNotice', 'sequenceNotice', 'healthText', 'label', 'InstalledExtensionInfo', 'BundledExtensionInfo', 'ExtensionUpdateInfo'].includes(path.at(-1))
            || path.some(key => ['__proto__', 'constructor', 'prototype', 'configuration', 'name', 'sceneNames'].includes(key))) continue;
        let owner = data;
        for (const key of path.slice(0, -1)) owner = owner && Object.hasOwn(owner, key) ? owner[key] : null;
        if (owner && typeof owner[path.at(-1)] === 'string') {
            Object.defineProperty(owner, path.at(-1), {get: () => {
                const values = {...descriptor.values};
                for (const [name, options] of Object.entries(descriptor.localizedValues ?? {})) {
                    if (typeof options?.en === 'string' && typeof options?.de === 'string') values[name] = options[currentLanguage];
                }
                return t(descriptor.key, values);
            }, enumerable: true, configurable: true});
        }
    }
    return data;
}
export function onLanguageChange(callback) { listeners.add(callback); return () => listeners.delete(callback); }
export function setLanguage(next, {persist = true, report = true} = {}) {
    if (!supported.has(next)) throw new Error('Unsupported language.');
    const previous = currentLanguage; currentLanguage = next;
    if (persist) { try { globalThis.localStorage?.setItem(storageKey, next); } catch {} }
    if (globalThis.document?.documentElement) globalThis.document.documentElement.lang = next;
    for (const reference of references) {
        const element = reference.deref();
        if (!element || element.isConnected === false) { references.delete(reference); continue; }
        for (const update of bindings.get(element)?.values() ?? []) update();
    }
    for (const callback of listeners) callback(next, previous);
    if (report && audit && previous !== next) {
        void Promise.resolve().then(() => audit({language: next, previousLanguage: previous, openEditor: !!globalThis.document?.querySelector('dialog[open]')})).catch(() => {
            console.info('[Z2MAutomations] Language changed locally; module debug confirmation unavailable.');
        });
    }
    return next;
}
export function installLanguagePicker({report} = {}) {
    if (typeof document === 'undefined') return;
    if (report) audit = report;
    document.documentElement.lang = currentLanguage;
    if (document.getElementById('designer-language')) return;
    document.querySelector('.toolbar')?.append(languagePicker(true));
    for (const dialog of document.querySelectorAll('dialog')) if (!dialog.querySelector('[data-language-picker]')) dialog.append(languagePicker());
    for (const element of document.querySelectorAll('[data-i18n]')) bindText(element, () => t(element.dataset.i18n));
    for (const name of ['title', 'placeholder', 'aria-label']) for (const element of document.querySelectorAll('[data-i18n-' + name + ']')) {
        bindAttribute(element, name, () => t(element.getAttribute('data-i18n-' + name)));
    }
}

function languagePicker(header = false) {
    const label = document.createElement('label'); label.className = 'designer-language'; label.setAttribute('data-language-picker', '');
    const caption = document.createElement('span'); bindText(caption, () => t('language.caption'));
    const select = document.createElement('select'); if (header) select.id = 'designer-language';
    select.add(new Option('Deutsch', 'de')); select.add(new Option('English', 'en')); select.value = currentLanguage;
    bindAttribute(select, 'aria-label', () => t('language.caption'));
    select.addEventListener('change', () => setLanguage(select.value));
    label.append(caption, select);
    onLanguageChange(() => { select.value = currentLanguage; });
    return label;
}
