import Ajv from 'ajv';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {Configuration, Project, ProjectSystem} from './project.js';
import {validConfiguration} from './project.js';
import type {MqttReader} from './mqtt-reader.js';
import type {CatalogProperty} from './mqtt-protocol.js';

// Values below have passed the pinned schema before semantic inspection.
export type Entry = Record<string, any>;
const ajv = new Ajv({strict: false, allErrors: false, validateFormats: false});
const schema = JSON.parse(readFileSync(join(__dirname, 'schema/automations.schema.json'), 'utf8'));
ajv.addSchema(schema);
const ruleSchema = ajv.compile({$ref: schema.$id + '#/definitions/automation'});
const sequenceSchema = ajv.compile({$ref: schema.$id + '#/definitions/sequence'});
export const digestPattern = /^[a-f0-9]{64}$/;
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const topic = (value: string): boolean => value.length <= 128 && /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(value);
export function uniqueTopic(project: Project, baseTopic: string): ProjectSystem | undefined {
  const found = project.systems.filter(system => system.baseTopic === baseTopic);
  return found.length === 1 ? found[0] : undefined;
}
export function editorDevices(project: Project, system: ProjectSystem, reader: MqttReader): Entry[] {
  const devices: Entry[] = [];
  for (const owner of project.systems) {
    const local = owner.id === system.id;
    if (!local && (!uniqueTopic(project, owner.baseTopic) || !uniqueTopic(project, system.baseTopic) || !topic(owner.baseTopic)
      || !owner.configuration.mesh_peers.includes(system.baseTopic))) continue;
    const remote = reader.current(owner.id); if (!remote) continue;
    for (const device of remote.devices) {
      const properties: Entry[] = device.properties.map(property => ({...property,
        readable: local && Boolean(property.access & 1), writable: remote.fresh && Boolean(property.access & 2),
        actionValues: property.values, valueLabels: []}));
      for (const scene of remote.scenes.filter(scene => equal(scene.target, device.target))) {
        const endpoint = scene.endpoint ?? 0;
        let property = properties.find(property => property['sceneEndpoint'] === endpoint);
        if (!property) { property = {id: 'scene_recall_' + endpoint, label: device.name + (endpoint ? ' · ' + endpoint : ''), type: 'enum', readable: false,
          writable: remote.fresh, values: [], actionValues: [], sceneNames: {}, sceneEndpoint: endpoint}; properties.push(property); }
        property['actionValues'].push(scene.id); property['sceneNames'][scene.id] = scene.name || String(scene.id);
      }
      devices.push({...device, key: local ? device.key : owner.id + ':' + device.key,
        target: {...device.target, ...(!local ? {system: owner.baseTopic} : {})}, properties});
    }
  }
  return devices;
}
function timezone(value: unknown): void {
  if (typeof value !== 'string') throw new Error('draftSchema');
  try { new Intl.DateTimeFormat('en', {timeZone: value}).format(0); } catch { throw new Error('draftTimezone'); }
}
function propertyValue(property: CatalogProperty, value: unknown, writing: boolean): void {
  if (property.type === 'numeric') {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('draftValue');
    if (writing && (property.minimum !== undefined && value < property.minimum || property.maximum !== undefined && value > property.maximum
      || property.step !== undefined && Math.abs((value - (property.minimum ?? 0)) / property.step - Math.round((value - (property.minimum ?? 0)) / property.step)) > 1e-7)) throw new Error('draftValue');
  } else if (property.type === 'color') {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).join() !== 'hex' || !/^#[a-f0-9]{6}$/i.test((value as {hex: string}).hex)) throw new Error('draftValue');
  } else if (!property.values.some(candidate => equal(candidate, value))) throw new Error('draftValue');
}
export function checkedEntry(entry: Entry, sequence: boolean): void {
  if (!(sequence ? sequenceSchema(entry) : ruleSchema(entry))) throw new Error('draftSchema');
  if (!entry['name'].trim()) throw new Error('draftSchema');
  for (const item of [...(entry['triggers'] ?? []), ...(entry['conditions'] ?? [])] as Entry[]) if (item['timezone'] !== undefined) timezone(item['timezone']);
}
export function checkCapabilities(entry: Entry, sequence: boolean, configuration: Configuration, project: Project, system: ProjectSystem, reader: Pick<MqttReader, 'current'>, sections = ['triggers', 'conditions', 'actions']): void {
  checkedEntry(entry, sequence);
  for (const item of sections.filter(section => section !== 'actions').flatMap(section => entry[section] ?? []) as Entry[]) if (['device', 'device_value'].includes(item['type'])) {
    const remote = reader.current(system.id);
    const property = remote?.devices.find(device => device.target.type === 'device' && device.target.id === item['device'])?.properties.find(property => property.id === item['property']);
    if (!remote?.fresh || !property || !(property.access & 1) || property.type === 'color') throw new Error('draftCapability');
    if (!['eq', 'ne'].includes(item['operator']) && property.type !== 'numeric') throw new Error('draftValue');
    propertyValue(property, item['value'], false);
  }
  if (!sections.includes('actions')) return;
  let count = 0;
  const actions = entry['actions'] as Entry[];
  for (const action of actions) {
    if (action['type'] === 'sequence') {
      const definition = configuration.sequences.find(value => value['id'] === action['sequence_id']);
      if (sequence || !definition) throw new Error('draftSequence');
      checkedEntry(definition, true);
      const leaves = definition['actions'] as Entry[];
      if ((action['delay_seconds'] ?? 0) + (leaves[0]?.['delay_seconds'] ?? 0) > 86400) throw new Error('draftSequence');
      checkCapabilities(definition, true, configuration, project, system, reader); count += leaves.length;
    } else {
      count++;
      const target = action['target'];
      const owner = target['system'] === undefined ? system : uniqueTopic(project, target['system']);
      if (!owner || target['system'] !== undefined && (owner.id === system.id || !uniqueTopic(project, system.baseTopic)
        || !owner.configuration.mesh_peers.includes(system.baseTopic))) throw new Error('draftPermission');
      const remote = reader.current(owner.id);
      const device = remote?.devices.find(device => device.target.type === target['type'] && device.target.id === target['id']);
      if (!remote?.fresh || !device) throw new Error('draftCapability');
      if (action['type'] === 'scene') {
        if (!remote.scenes.some(scene => equal(scene.target, device.target) && scene.id === action['scene_id'] && scene.endpoint === action['endpoint'])) throw new Error('draftCapability');
      } else {
        const values = action['type'] === 'toggle' ? {[action['property']]: 'TOGGLE'} : action['values'];
        for (const [key, value] of Object.entries(values)) {
          const property = device.properties.find(property => property.id === key);
          if (!property || !(property.access & 2)) throw new Error('draftCapability');
          if (action['type'] === 'set' && value === 'TOGGLE') throw new Error('draftValue');
          propertyValue(property, value, true);
        }
      }
    }
    if (count > 16) throw new Error('draftSequence');
  }
}
export function checkedDocument(value: unknown): Configuration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('draftSchema');
  const config = {...value, sequences: (value as Entry)['sequences'] ?? [], mesh_peers: (value as Entry)['mesh_peers'] ?? []};
  if (!validConfiguration(config) || !ajv.validate(schema.$id, config)) throw new Error('draftSchema');
  for (const entry of config.automations) checkedEntry(entry, false);
  for (const entry of config.sequences) checkedEntry(entry, true);
  for (const rule of config.automations) {
    let steps = 0;
    for (const action of rule['actions'] as Entry[]) {
      if (action['type'] !== 'sequence') { steps++; continue; }
      const sequence = config.sequences.find(sequence => sequence['id'] === action['sequence_id']);
      if (!sequence) throw new Error('draftSequence');
      const leaves = sequence['actions'] as Entry[];
      if ((action['delay_seconds'] ?? 0) + (leaves[0]?.['delay_seconds'] ?? 0) > 86400) throw new Error('draftSequence');
      steps += leaves.length;
    }
    if (steps > 16) throw new Error('draftSequence');
  }
  return config;
}
