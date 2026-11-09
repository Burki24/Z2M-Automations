import {createHash} from 'node:crypto';
import {validConfiguration, type Configuration, text, exact} from './project.js';

export const extensionPrefix = '/symcon/automations/';
export const readOperations = ['status', 'editor'] as const;
export type ReadOperation = typeof readOperations[number];
export interface RemoteStatus {session: string; revision: number; checksum: string | null; executing: boolean; resumeEnabled: boolean; storage: string; extensionVersion: string; build: string | null}
export interface CatalogProperty {id: string; label: string; type: string; access: number; values: (string | number | boolean | null)[]; unit?: string; endpoint?: string; minimum?: number; maximum?: number; step?: number}
export interface CatalogDevice {key: string; name: string; target: {type: 'device' | 'group'; id: string | number}; properties: CatalogProperty[]}
export interface RemoteRead {status: RemoteStatus; configuration: Configuration; yaml: string | null; devices: CatalogDevice[]; scenes: Scene[]}
export interface Scene {target: {type: 'device' | 'group'; id: string | number}; id: number; name: string; control_property: string; endpoint?: number}
export function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
const displayText = (value: unknown, max: number): value is string => typeof value === 'string' && [...value].length <= max && !/[\u0000-\u001f\u007f]/.test(value);
export const propertyId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value) && !['constructor', 'prototype', '__proto__'].includes(value);
export function statusData(value: unknown): RemoteStatus {
  if (!record(value) || value['protocol_version'] !== 1 || value['schema_version'] !== 1 || typeof value['session'] !== 'string'
    || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value['session']) || value['state'] !== 'ready'
    || !Number.isSafeInteger(value['stored_revision']) || Number(value['stored_revision']) < 0 || typeof value['executing'] !== 'boolean'
    || !['ok', 'empty'].includes(String(value['storage']))) throw new Error('protocol');
  const revision = Number(value['stored_revision']); const checksum = value['checksum'];
  if (revision === 0 ? checksum !== null : typeof checksum !== 'string' || !/^[a-f0-9]{64}$/.test(checksum)) throw new Error('protocol');
  if (revision === 0 ? value['storage'] !== 'empty' || value['executing'] : value['storage'] !== 'ok') throw new Error('protocol');
  return {session: value['session'], revision, checksum: checksum as string | null, executing: value['executing'], resumeEnabled: value['resume_enabled'] === true, storage: String(value['storage']),
    build: typeof value['extension_build'] === 'string' && /^[a-f0-9]{64}$/.test(value['extension_build']) ? value['extension_build'] : null,
    extensionVersion: text(value['extension_version'], 80) ? value['extension_version'] : ''};
}
function scalar(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value) || typeof value === 'string' && [...value].length <= 256;
}
function properties(device: Record<string, unknown>): CatalogProperty[] {
  const result: CatalogProperty[] = [];
  if (Array.isArray(device['properties'])) {
    if (device['properties'].length > 64) throw new Error('protocol');
    for (const raw of device['properties']) {
      if (!record(raw) || !propertyId(raw['property']) || !['binary', 'enum', 'numeric', 'color'].includes(String(raw['type']))
        || !Number.isInteger(raw['access']) || Number(raw['access']) < 1 || Number(raw['access']) > 3
        || !Array.isArray(raw['values']) || raw['values'].length > 32 || !raw['values'].every(scalar)) continue;
      if (result.some(item => item.id === raw['property'])) throw new Error('protocol');
      const value: CatalogProperty = {id: raw['property'], label: displayText(raw['label'], 80) && raw['label'] ? raw['label'] : raw['property'], type: String(raw['type']), access: Number(raw['access']), values: raw['values']};
      if (text(raw['endpoint'], 32) && /^[A-Za-z0-9_-]+$/.test(raw['endpoint'])) value.endpoint = raw['endpoint'];
      for (const bound of ['minimum', 'maximum', 'step'] as const) if (typeof raw[bound] === 'number' && Number.isFinite(raw[bound]) && (bound !== 'step' || raw[bound] > 0)) value[bound] = raw[bound];
      result.push(value);
    }
  } else {
    // Older extension catalogs carry bounded discrete read/write pairs only.
    for (const [field, access] of [['triggers', 1], ['actions', 2]] as const) {
      const entries = device[field]; if (!Array.isArray(entries) || entries.length > 64) continue;
      for (const entry of entries) if (record(entry) && propertyId(entry['property']) && scalar(entry['value'])) {
        let value = result.find(item => item.id === entry['property']);
        if (!value) { value = {id: entry['property'], label: entry['property'], type: 'enum', access: 0, values: []}; result.push(value); }
        value.access |= access; if (!value.values.includes(entry['value'])) value.values.push(entry['value']);
      }
    }
  }
  if (Array.isArray(device['numeric'])) for (const entry of device['numeric'].slice(0, 64)) if (record(entry) && propertyId(entry['property'])) {
    let value = result.find(item => item.id === entry['property']);
    if (!value) { value = {id: entry['property'], label: entry['property'], type: 'numeric', access: 1, values: []}; result.push(value); }
    if (displayText(entry['unit'], 24)) value.unit = entry['unit'];
  }
  if (result.length > 64) throw new Error('protocol');
  return result;
}
export function editorData(value: unknown): RemoteRead {
  const status = statusData(value);
  if (!record(value) || value['editor_version'] !== 1 || !Array.isArray(value['devices']) || value['devices'].length > 256
    || !record(value['configuration'])) throw new Error('protocol');
  const raw = value['configuration'];
  const configuration = {...raw, sequences: raw['sequences'] ?? [], mesh_peers: raw['mesh_peers'] ?? []};
  if (!validConfiguration(configuration, true) || configuration.revision !== status.revision) throw new Error('protocol');
  const yaml = value['yaml'];
  if (status.revision === 0 ? yaml !== null : typeof yaml !== 'string' || Buffer.byteLength(yaml) > 1048576
    || createHash('sha256').update(yaml, 'utf8').digest('hex') !== status.checksum) throw new Error('protocol');
  const devices: CatalogDevice[] = [];
  for (const raw of value['devices']) {
    if (!record(raw) || typeof raw['id'] !== 'string' || !/^0x[0-9a-f]{16}$/.test(raw['id']) || !displayText(raw['name'], 120)) throw new Error('protocol');
    if (devices.some(device => device.target.id === raw['id'])) throw new Error('protocol');
    devices.push({key: raw['id'], name: raw['name'] || raw['id'], target: {type: 'device', id: raw['id']}, properties: properties(raw)});
  }
  const groups = value['groups'] ?? [];
  if (!Array.isArray(groups) || groups.length > 256) throw new Error('protocol');
  for (const group of groups) {
    if (!record(group) || !Number.isInteger(group['id']) || Number(group['id']) < 1 || Number(group['id']) > 65535 || !displayText(group['name'], 120) || !group['name']) throw new Error('protocol');
    if (devices.some(device => device.target.type === 'group' && device.target.id === group['id'])) throw new Error('protocol');
    devices.push({key: 'group:' + group['id'], name: group['name'], target: {type: 'group', id: Number(group['id'])}, properties: []});
  }
  const scenes: Scene[] = []; const rawScenes = value['scenes'] ?? [];
  if (!Array.isArray(rawScenes) || rawScenes.length > 512) throw new Error('protocol');
  for (const scene of rawScenes) {
    if (!record(scene) || !exact(scene['target'], ['type', 'id']) || !Number.isInteger(scene['id']) || Number(scene['id']) < 0 || Number(scene['id']) > 255
      || !displayText(scene['name'], 120) || !propertyId(scene['control_property'])) continue;
    const device = devices.find(device => device.target.type === (scene['target'] as Record<string, unknown>)['type'] && device.target.id === (scene['target'] as Record<string, unknown>)['id']);
    const target = device?.target;
    if (!target || target.type === 'device' && (!Number.isInteger(scene['endpoint']) || Number(scene['endpoint']) < 1 || Number(scene['endpoint']) > 240)) continue;
    if (target.type === 'device' && !device?.properties.some(property => property.id === scene['control_property'] && (property.access & 2) !== 0)) continue;
    if (target.type === 'group' && (scene['endpoint'] !== undefined || scene['control_property'] !== 'state')) continue;
    if (scenes.some(item => item.target.type === target.type && item.target.id === target.id && item.id === scene['id'] && item.endpoint === (target.type === 'device' ? scene['endpoint'] : undefined))) continue;
    scenes.push({target: {...target}, id: Number(scene['id']), name: scene['name'], control_property: scene['control_property'], ...(target.type === 'device' ? {endpoint: Number(scene['endpoint'])} : {})});
  }
  return {status, configuration, yaml: yaml as string | null, devices, scenes};
}
