import {randomUUID} from 'node:crypto';

export type Json = null | boolean | number | string | Json[] | {[key: string]: Json};
export interface Configuration {schema_version: 1; revision: number; automations: {[key: string]: Json}[]; sequences: {[key: string]: Json}[]; mesh_peers: string[]}
export interface Broker {id: string; name: string; host: string; port: number; tls: boolean}
export interface ProjectSystem {id: string; name: string; brokerId: string; baseTopic: string; baseline: {revision: number; checksum: string} | null; configuration: Configuration}
export interface Project {format: 'z2m-automations-project'; version: 1; id: string; name: string; brokers: Broker[]; systems: ProjectSystem[]}
export const maximumProjectBytes = 2 * 1024 * 1024;
export const validId = (value: unknown): value is string => typeof value === 'string' && /^(?:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|example-[ab])$/.test(value);
export const text = (value: unknown, max = 160): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value);
export function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}
export function emptyConfiguration(): Configuration { return {schema_version: 1, revision: 1, automations: [], sequences: [], mesh_peers: []}; }
export function newProject(name: string): Project { return {format: 'z2m-automations-project', version: 1, id: randomUUID(), name, brokers: [], systems: []}; }
function json(value: unknown, depth = 0): boolean {
  if (depth > 16) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.length <= 4096;
  if (Array.isArray(value)) return value.length <= 512 && value.every(item => json(item, depth + 1));
  if (typeof value !== 'object') return false;
  return Object.entries(value).length <= 100 && Object.entries(value).every(([key, item]) =>
    !/^(?:__proto__|prototype|constructor|password|username|credentials?|(?:access_?|refresh_?|owner_?)?token|session(?:_?id)?|instance_?id|object_?id|variable_?id|private_?key|certificate|symcon.*)$/i.test(key) && json(item, depth + 1));
}
function configuration(value: unknown): value is Configuration {
  if (!exact(value, ['schema_version', 'revision', 'automations', 'sequences', 'mesh_peers']) || value['schema_version'] !== 1
    || !Number.isSafeInteger(value['revision']) || Number(value['revision']) < 1 || !json(value)) return false;
  for (const [field, limit] of [['automations', 100], ['sequences', 32]] as const) {
    const entries = value[field];
    if (!Array.isArray(entries) || entries.length > limit || new Set(entries.map(entry => entry?.id)).size !== entries.length) return false;
    if (!entries.every(entry => entry && !Array.isArray(entry) && text(entry.id, 128) && text(entry.name)
      && (field === 'sequences' || typeof entry.enabled === 'boolean'))) return false;
  }
  return Array.isArray(value['mesh_peers']) && value['mesh_peers'].length <= 8
    && value['mesh_peers'].every(peer => text(peer, 64) && /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(peer));
}
export function validBroker(value: unknown): value is Broker {
  return exact(value, ['id', 'name', 'host', 'port', 'tls']) && validId(value['id']) && text(value['name'])
    && typeof value['host'] === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9.:-]{0,252}$/.test(value['host'])
    && Number.isInteger(value['port']) && Number(value['port']) >= 1 && Number(value['port']) <= 65535 && typeof value['tls'] === 'boolean';
}
export function validProject(value: unknown): value is Project {
  if (!exact(value, ['format', 'version', 'id', 'name', 'brokers', 'systems']) || value['format'] !== 'z2m-automations-project'
    || value['version'] !== 1 || !validId(value['id']) || !text(value['name']) || !Array.isArray(value['brokers']) || value['brokers'].length > 8
    || !value['brokers'].every(validBroker) || !Array.isArray(value['systems']) || value['systems'].length > 8) return false;
  const brokers = value['brokers'] as Broker[];
  const systems = value['systems'];
  if (new Set(brokers.map(broker => broker.id)).size !== brokers.length || new Set(systems.map(system => system?.id)).size !== systems.length) return false;
  const bindings = new Set<string>();
  return systems.every(system => {
    if (!exact(system, ['id', 'name', 'brokerId', 'baseTopic', 'baseline', 'configuration']) || !validId(system['id']) || !text(system['name'])
      || !brokers.some(broker => broker.id === system['brokerId']) || !text(system['baseTopic'], 256)
      || /[#+]/.test(system['baseTopic']) || system['baseTopic'].startsWith('/') || system['baseTopic'].endsWith('/')
      || !configuration(system['configuration'])) return false;
    const binding = system['brokerId'] + ':' + system['baseTopic'];
    if (bindings.has(binding)) return false;
    bindings.add(binding);
    const base = system['baseline'];
    return base === null || (exact(base, ['revision', 'checksum']) && Number.isSafeInteger(base['revision']) && Number(base['revision']) > 0
      && typeof base['checksum'] === 'string' && /^[a-f0-9]{64}$/.test(base['checksum']));
  });
}
export function parseProject(bytes: Buffer): Project {
  if (bytes.length > maximumProjectBytes) throw new Error('invalidProject');
  try {
    const value: unknown = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
    if (!validProject(value)) throw new Error();
    return value;
  } catch { throw new Error('invalidProject'); }
}
export function projectBytes(project: Project): Buffer {
  const bytes = Buffer.from(JSON.stringify(project, null, 2) + '\n');
  parseProject(bytes);
  return bytes;
}
