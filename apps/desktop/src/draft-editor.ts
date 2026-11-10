import {createHash, randomUUID} from 'node:crypto';
import type {ProjectService} from './project-service.js';
import type {MqttReader} from './mqtt-reader.js';
import {exact, validId, type ProjectSystem, type Configuration} from './project.js';
import {editorDevices, checkCapabilities, checkedDocument, digestPattern, uniqueTopic, type Entry} from './draft-validation.js';

const routes = ['create', 'edit', 'sequence', 'manage', 'permissions-status', 'permissions', 'import', 'export', 'adopt', 'editor-state'] as const;
export interface DesignerCommand {route: typeof routes[number]; systemId: string; generation: number; fingerprint: string; payload: Entry}
export const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function validDesignerCommand(value: unknown): value is DesignerCommand {
  return exact(value, ['route', 'systemId', 'generation', 'fingerprint', 'payload']) && routes.includes(value['route'] as DesignerCommand['route'])
    && validId(value['systemId']) && Number.isSafeInteger(value['generation']) && typeof value['fingerprint'] === 'string' && digestPattern.test(value['fingerprint'])
    && value['payload'] !== null && typeof value['payload'] === 'object' && !Array.isArray(value['payload']) && Buffer.byteLength(JSON.stringify(value)) <= 131072;
}
export class DraftEditor {
  private replies = new Map<string, {signature: string; reply: Entry}>();
  constructor(private readonly projects: ProjectService, private readonly reader: MqttReader) {}
  context(system: ProjectSystem): string {
    const project = this.projects.data();
    return digest([project.id, this.projects.generation(), system.id, system.brokerId, system.baseTopic, system.configuration,
      project.systems.map(owner => {
        const remote = this.reader.current(owner.id);
        // Runtime status and execution results do not change the draft's available targets.
        return [owner.id, owner.baseTopic, owner.brokerId, owner.configuration.mesh_peers,
          remote && {fresh: remote.fresh, devices: remote.devices, scenes: remote.scenes}];
      })]);
  }
  view(system: ProjectSystem): Entry {
    const configuration = system.configuration; const context = this.context(system);
    const editable = this.reader.source(system.id) === 'draft';
    const sections = Object.fromEntries(configuration.automations.map(rule => [rule['id'], {triggers: true, conditions: true, actions: true}]));
    return {devices: editorDevices(this.projects.data(), system, this.reader), createContext: context,
      createAllowed: editable && configuration.automations.length < 100, editAllowed: editable,
      sequenceAllowed: editable, sequenceCreateAllowed: editable && configuration.sequences.length < 32,
      manageAllowed: editable, permissionsAllowed: editable && Boolean(uniqueTopic(this.projects.data(), system.baseTopic))
        && system.baseTopic.length <= 128 && /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(system.baseTopic), editSections: sections,
      sequenceSections: Object.fromEntries(configuration.sequences.map(sequence => [sequence['id'], true])),
      workspaceContext: {systemId: system.id, generation: this.projects.generation() + 1, fingerprint: context}};
  }
  system(command: DesignerCommand): ProjectSystem {
    if (!this.projects.active) throw new Error('noProject');
    const system = this.projects.data().systems.find(system => system.id === command.systemId);
    if (!system || command.generation !== this.projects.generation() + 1 || command.route !== 'adopt' && this.reader.source(system.id) !== 'draft'
      || command.fingerprint !== this.context(system)) throw new Error('draftStale');
    return system;
  }
  private permissionView(system: ProjectSystem): Entry {
    const project = this.projects.data(); const peers = system.configuration.mesh_peers;
    const topics = new Set([...peers, ...project.systems.filter(owner => owner.id !== system.id).map(owner => owner.baseTopic)]);
    const choices = [...topics].filter(topic => topic.length <= 128 && /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(topic)).map(topic => {
      const found = project.systems.filter(owner => owner.baseTopic === topic); const owner = found.length === 1 ? found[0] : undefined;
      const targetsReceiver = (actions: unknown): boolean => Array.isArray(actions) && actions.some((action: Entry) => action?.['target']?.system === system.baseTopic
        || action?.['type'] === 'sequence' && (owner?.configuration.sequences ?? []).some(sequence => sequence['id'] === action['sequence_id']
          && Array.isArray(sequence['actions']) && (sequence['actions'] as Entry[]).some(leaf => leaf?.['target']?.system === system.baseTopic)));
      const affected = (owner?.configuration.automations ?? []).filter(rule => targetsReceiver(rule['actions']));
      return {topic, systemId: owner?.id ?? '', name: owner?.name ?? topic, assigned: Boolean(owner), selected: peers.includes(topic), affectedCount: affected.length,
        affected: affected.slice(0, 20).map(rule => ({id: rule['id'], name: rule['name'], enabled: rule['enabled']}))};
    });
    return {systemId: system.id, generation: this.projects.generation() + 1, fingerprint: this.context(system), context: this.context(system),
      baseTopic: system.baseTopic, name: system.name, canEdit: /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(system.baseTopic) && system.baseTopic.length <= 128,
      message: '', notice: '', blocked: '', peers, choices};
  }
  command(command: DesignerCommand): Entry {
    const payload = command.payload;
    if (command.route === 'editor-state') {
      if (!exact(payload, ['pending']) || typeof payload['pending'] !== 'boolean' || !this.projects.active
        || command.generation !== this.projects.generation() + 1 || !this.projects.data().systems.some(system => system.id === command.systemId)) throw new Error('draftStale');
      this.projects.editorState(payload['pending']); return {ok: true};
    }
    const request = payload['requestId']; const signature = digest(command);
    const key = typeof request === 'string' ? this.projects.data().id + ':' + this.projects.generation() + ':' + request : '';
    const cached = key ? this.replies.get(key) : null;
    if (cached) { if (cached.signature !== signature) throw new Error('draftStale'); return structuredClone(cached.reply); }
    const system = this.system(command); const configuration = structuredClone(system.configuration);
    if (command.route === 'permissions-status') {
      if (!exact(payload, [])) throw new Error('invalidRequest');
      return {ok: true, permissions: this.permissionView(system)};
    }
    if (!validId(request) || String(request).startsWith('example') || payload['context'] !== this.context(system)) throw new Error('draftStale');
    let reply: Entry = {ok: true};
    switch (command.route) {
      case 'create': case 'edit': case 'sequence': {
        const sequence = command.route === 'sequence';
        const list = sequence ? configuration.sequences : configuration.automations;
        const idField = sequence ? 'sequenceId' : 'ruleId';
        const creating = command.route === 'create' || sequence && payload[idField] === '';
        if (!exact(payload, creating && !sequence ? ['requestId', 'context', 'rule'] : ['requestId', 'context', idField, 'changes'])) throw new Error('invalidRequest');
        const original = creating ? null : list.find(entry => entry['id'] === payload[idField]);
        if (!creating && !original) throw new Error('draftStale');
        const changes = creating && !sequence ? payload['rule'] : payload['changes'];
        const fields = sequence ? ['name', 'actions'] : ['name', 'enabled', 'retrigger', 'restart_policy', 'triggers', 'conditions', 'actions'];
        if (!changes || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).some(field => !fields.includes(field)) || creating && Object.hasOwn(changes, 'enabled')) throw new Error('draftSchema');
        const entry: Entry = {...original, ...changes, id: creating ? (sequence ? 'sequence-' : 'rule-') + randomUUID() : String(payload[idField]), ...(!sequence && creating ? {enabled: false} : {})};
        if (creating && list.length >= (sequence ? 32 : 100)) throw new Error('draftLimit');
        checkCapabilities(entry, sequence, configuration, this.projects.data(), system, this.reader,
          creating || (changes as Entry)['enabled'] === true ? undefined : Object.keys(changes));
        if (original) list[list.indexOf(original)] = entry; else list.push(entry);
        if (sequence && Object.hasOwn(changes, 'actions')) for (const rule of configuration.automations) if ((rule['actions'] as Entry[]).some(action => action['sequence_id'] === entry.id)) {
          checkCapabilities(rule, false, configuration, this.projects.data(), system, this.reader);
        }
        reply[idField] = entry.id; break;
      }
      case 'manage': {
        if (!exact(payload, ['requestId', 'context', 'operation', 'id'])) throw new Error('invalidRequest');
        const operation = String(payload['operation']);
        if (operation === 'filter') return {ok: true, operation, message: ''};
        if (!['copy-rule', 'delete-rule', 'delete-sequence'].includes(operation)) throw new Error('invalidRequest');
        const sequence = operation === 'delete-sequence'; const list = sequence ? configuration.sequences : configuration.automations;
        const entry = list.find(entry => entry['id'] === payload['id']); if (!entry) throw new Error('draftStale');
        if (sequence && configuration.automations.some(rule => (rule['actions'] as Entry[]).some(action => action['type'] === 'sequence' && action['sequence_id'] === entry['id']))) throw new Error('draftSequence');
        if (operation === 'copy-rule') {
          if (list.length >= 100) throw new Error('draftLimit');
          const copy = {...structuredClone(entry), id: 'rule-' + randomUUID(), enabled: false}; list.push(copy); reply['ruleId'] = copy.id;
        } else list.splice(list.indexOf(entry), 1);
        reply['operation'] = operation; reply['message'] = ''; break;
      }
      case 'permissions': {
        if (!exact(payload, ['requestId', 'context', 'peers', 'confirmed']) || payload['confirmed'] !== true || !Array.isArray(payload['peers'])) throw new Error('invalidRequest');
        const peers = payload['peers']; const choices = this.permissionView(system)['choices'] as Entry[];
        if (peers.length > 8 || new Set(peers).size !== peers.length || peers.some(peer => !choices.some(row => row['topic'] === peer))) throw new Error('draftPermission');
        configuration.mesh_peers = peers;
        reply = {...reply, permissionsSaved: true, systemId: system.id, generation: command.generation, fingerprint: command.fingerprint,
          changed: digest(peers) !== digest(system.configuration.mesh_peers), peerCount: peers.length, notice: ''}; break;
      }
      default: throw new Error('invalidRequest');
    }
    this.save(system, configuration);
    if (key) { this.replies.set(key, {signature, reply: structuredClone(reply)}); if (this.replies.size > 32) this.replies.delete(this.replies.keys().next().value!); }
    return reply;
  }
  save(system: ProjectSystem, configuration: Configuration): void {
    configuration.revision = system.configuration.revision + 1;
    if (!Number.isSafeInteger(configuration.revision)) throw new Error('draftLimit');
    this.projects.replaceDraft(system.id, configuration);
    this.reader.reconcile(this.projects.data(), this.projects.generation());
    this.reader.view(system.id, 'draft');
  }
  export(command: DesignerCommand): Configuration { return checkedDocument(this.system(command).configuration); }
}
