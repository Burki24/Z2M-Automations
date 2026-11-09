import {Diagnostics} from './diagnostics.js';

export class OfflineWorkspace {
  private selected = 'example-a';
  constructor(readonly debug: Diagnostics, private readonly platform: string, private readonly version: string) {}
  select(id: string): {ok: true} {
    if (!['example-a', 'example-b'].includes(id)) throw new Error('Unknown example system.');
    this.selected = id;
    this.debug.record('systemSelected', id);
    return {ok: true};
  }
  snapshot() {
    this.debug.record('snapshotRead', this.selected);
    const a = this.selected === 'example-a';
    const sensor = a ? '0x0000000000000001' : '0x0000000000000011';
    const lamp = a ? '0x0000000000000002' : '0x0000000000000012';
    const systems = ['example-a', 'example-b'].map((id, index) => ({name: 'Example ' + (index + 1), binding: {systemId: id, generation: 1, baseTopic: 'example' + (index + 1)}}));
    return {
      contractVersion: 1, mode: 'read', capabilities: {operationControls: false},
      desktop: {platform: this.platform, version: this.version},
      module: {id: 0, name: 'Z2M-Automations', baseTopic: a ? 'example1' : 'example2', gateway: 0},
      status: {confirmed: false, mqttConnected: false, executing: false},
      draftAvailable: true, catalogAvailable: true, catalogLoadedAt: 0, draftMismatch: false, openFormEdits: false,
      workspace: {fingerprint: 'offline-v1', systems},
      workspaceContext: {systemId: this.selected, generation: 1, fingerprint: 'offline-v1'},
      createAllowed: false, editAllowed: false, sequenceAllowed: false, manageAllowed: false,
      diagnosticsAllowed: false, permissionsAllowed: false, editSections: {}, sequenceSections: {}, timezones: ['UTC'], notices: [],
      devices: [
        {key: sensor, name: a ? 'Hall / Motion' : 'Office / Button', target: {type: 'device', id: sensor}, properties: [{id: a ? 'occupancy' : 'action', label: a ? 'Occupancy' : 'Action', type: a ? 'binary' : 'enum', access: 1, values: a ? [true, false] : ['single', 'double']} ]},
        {key: lamp, name: a ? 'Hall / Light' : 'Office / Light', target: {type: 'device', id: lamp}, properties: [{id: 'state', label: 'State', type: 'binary', access: 7, values: ['ON', 'OFF', 'TOGGLE']} ]}
      ],
      configuration: {schema_version: 1, revision: 1, sequences: [], mesh_peers: [], automations: [{
        id: a ? 'example-motion' : 'example-button', name: a ? 'Hall light on motion' : 'Office light on button', enabled: false,
        triggers: [{type: 'device', device: sensor, property: a ? 'occupancy' : 'action', operator: 'eq', value: a ? true : 'single'}],
        conditions: [], actions: [{type: 'set', target: {type: 'device', id: lamp}, values: {state: 'ON'}}]
      }]}
    };
  }
}
