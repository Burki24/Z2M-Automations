import {posix} from 'node:path';
import {channels, type Channel, type LanguageChange} from './contracts.js';
import {exact, validId, validBroker, text} from './project.js';

export const entryURL = 'z2ma://app/index.html';
export const csp = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
export const rendererPreferences = Object.freeze({nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false});

export function trustedSender(knownId: number, senderId: number, mainFrame: boolean, url: string): boolean {
  return knownId === senderId && mainFrame && url === entryURL;
}
export function assetPath(url: string, method: string, assets: ReadonlySet<string>): string | null {
  if (!['GET', 'HEAD'].includes(method)) return null;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== 'z2ma:' || parsed.hostname !== 'app' || parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  const name = parsed.pathname.slice(1);
  if (!/^[a-zA-Z0-9._/-]+$/.test(name) || name.includes('..') || name !== posix.normalize(name) || !assets.has(name)) return null;
  return name;
}
function object(value: unknown, keys: string[]): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === keys.sort().join(',');
}
export function languageChange(value: unknown): value is LanguageChange {
  return object(value, ['language', 'previousLanguage', 'openEditor'])
    && typeof value['language'] === 'string' && ['de', 'en'].includes(value['language'])
    && typeof value['previousLanguage'] === 'string' && ['de', 'en'].includes(value['previousLanguage'])
    && typeof value['openEditor'] === 'boolean';
}
export function validPayload(channel: Channel, value: unknown): boolean {
  switch (channel) {
    case 'snapshot': case 'diagnostics': return value === undefined;
    case 'select-system': return validId(value);
    case 'language': return languageChange(value);
    case 'recording': return value === 'start' || value === 'stop';
    case 'project': return validProjectCommand(value);
    case 'credential': return exact(value, ['brokerId', 'mode']) && validId(value['brokerId'])
      && ['remove', 'protected', 'session'].includes(String(value['mode']));
  }
}
export function validProjectCommand(value: unknown): boolean {
  if (exact(value, ['action'])) return ['status', 'new', 'open', 'save', 'saveAs', 'export', 'restore', 'editing', 'edited'].includes(String(value['action']));
  if (exact(value, ['action', 'name'])) return value['action'] === 'rename' && text(value['name']);
  if (exact(value, ['action', 'broker'])) return value['action'] === 'broker' && validBroker(value['broker']);
  if (exact(value, ['action', 'system']) && value['action'] === 'system') {
    const system = value['system'];
    return exact(system, ['id', 'name', 'brokerId', 'baseTopic']) && validId(system['id']) && validId(system['brokerId']) && text(system['name'])
      && text(system['baseTopic'], 256) && !/[#+]/.test(system['baseTopic']);
  }
  return exact(value, ['action', 'systemId', 'operation', 'ruleId', 'name']) && value['action'] === 'draft' && validId(value['systemId'])
    && ['new', 'rename', 'copy', 'delete'].includes(String(value['operation'])) && typeof value['ruleId'] === 'string' && value['ruleId'].length <= 128
    && text(value['name']);
}
export function isChannel(value: string): value is Channel { return channels.some(channel => channel === value); }
