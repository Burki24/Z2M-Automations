import {posix} from 'node:path';
import {channels, type Channel, type LanguageChange} from './contracts.js';

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
    case 'select-system': return typeof value === 'string' && /^example-[ab]$/.test(value);
    case 'language': return languageChange(value);
    case 'recording': return value === 'start' || value === 'stop';
  }
}
export function isChannel(value: string): value is Channel { return channels.some(channel => channel === value); }
