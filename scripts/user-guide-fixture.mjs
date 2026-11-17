// Synthetic presentation data only; no private project, MQTT connection or device command.
export function guideModel(language, version) {
  const de = language === 'de';
  const text = (a, b) => de ? a : b;
  const id = number => '0x' + number.toString(16).padStart(16, '0');
  const property = (name, label, type, values, access = 1, unit = '') => ({id: name, label, type, values, access, readable: Boolean(access & 1), writable: Boolean(access & 2), actionValues: access & 2 ? [...values, ...(name.startsWith('state') ? ['TOGGLE'] : [])] : [], valueLabels: [], ...(unit ? {unit} : {})});
  const devices = [
    {key: id(1), name: text('Flur / Bewegungsmelder', 'Hall / Motion sensor'), target: {type: 'device', id: id(1)}, properties: [property('occupancy', text('Anwesenheit', 'Occupancy'), 'binary', [true, false]), property('illuminance', text('Helligkeit', 'Illuminance'), 'numeric', [], 1, 'lx')]},
    {key: id(2), name: text('Flur / Deckenlicht', 'Hall / Ceiling light'), target: {type: 'device', id: id(2)}, properties: [property('state', text('Status', 'State'), 'binary', ['ON', 'OFF'], 7)]},
    {key: id(3), name: text('Wohnzimmer / Taster', 'Living room / Button'), target: {type: 'device', id: id(3)}, properties: [property('action', text('Tastendruck', 'Button press'), 'enum', ['single', 'double']), property('battery', text('Batterie', 'Battery'), 'numeric', [], 1, '%')]},
    {key: id(4), name: text('Küche / Fenstergriff', 'Kitchen / Window handle'), target: {type: 'device', id: id(4)}, properties: [property('position', text('Position', 'Position'), 'enum', ['up', 'middle', 'down']), property('temperature', text('Temperatur', 'Temperature'), 'numeric', [], 1, '°C')]},
    {key: id(5), name: text('Wohnzimmer / Raumklima', 'Living room / Climate sensor'), target: {type: 'device', id: id(5)}, properties: [property('temperature', text('Temperatur', 'Temperature'), 'numeric', [], 1, '°C'), property('humidity', text('Luftfeuchtigkeit', 'Humidity'), 'numeric', [], 1, '%')]},
    {key: 'remote-light', name: text('Terrasse / Beleuchtung', 'Terrace / Lighting'), target: {type: 'device', id: id(12), system: 'garden'}, properties: [property('state_l1', text('Status L1', 'State L1'), 'binary', ['ON', 'OFF'], 7)]}
  ];
  const rule = (rid, name, triggers, actions, enabled = false, conditions = []) => ({id: rid, name, enabled, retrigger: 'ignore', restart_policy: 'abort', triggers, conditions, actions});
  const trigger = (device, name, value, extra = {}) => ({type: 'device', device: id(device), property: name, operator: 'eq', value, ...extra});
  const set = (value, extra = {}) => ({type: 'set', target: {type: 'device', id: id(2)}, values: {state: value}, delay_seconds: 0, ...extra});
  const configuration = {schema_version: 1, revision: 12, mesh_peers: ['garden'], sequences: [], automations: [
    rule('hall-on', text('Flurlicht bei Bewegung', 'Hall light on motion'), [trigger(1, 'occupancy', true)], [set('ON')], true),
    rule('hall-off', text('Flurlicht nach 30 Sekunden ohne Bewegung aus', 'Hall light off after 30 seconds without motion'), [trigger(1, 'occupancy', false, {for_seconds: 30})], [set('OFF')]),
    rule('terrace-toggle', text('Terrassenlicht mit Taster umschalten', 'Toggle terrace light with button'), [trigger(3, 'action', 'single')], [{type: 'toggle', target: {type: 'device', id: id(12), system: 'garden'}, property: 'state_l1', delay_seconds: 0}]),
    rule('evening-light', text('Licht am Abend', 'Evening light'), [{type: 'sun', event: 'sunset', offset_minutes: -15, latitude: 52.52, longitude: 13.405, timezone: 'Europe/Berlin'}], [set('ON')])
  ]};
  const bindings = [{id: 'example-a', name: text('Haus', 'House'), brokerId: 'example-a', baseTopic: 'house'}, {id: 'example-b', name: text('Garten', 'Garden'), brokerId: 'example-b', baseTopic: 'garden'}];
  const brokers = [{id: 'example-a', name: text('Broker Haus', 'House broker'), host: 'mqtt-house.example.invalid', port: 1883, tls: false}, {id: 'example-b', name: text('Broker Garten', 'Garden broker'), host: 'mqtt-garden.example.invalid', port: 1883, tls: false}];
  const project = {format: 'z2m-automations-project', version: 2, id: '11111111-1111-4111-8111-111111111111', name: text('Mein Beispielhaus', 'My example home'), brokers,
    systems: bindings.map((s, index) => ({...s, baseline: null, configuration: index ? {...configuration, automations: [], mesh_peers: ['house']} : configuration}))};
  const runtime = {peers: ['garden'], rules: configuration.automations.map(({id, name, enabled}) => ({id, name, enabled})), runs: [], resume: true};
  const view = {contractVersion: 1, mode: 'read', capabilities: {operationControls: false},
    desktop: {platform: 'win32', version, project: true, projectId: project.id, epoch: 1, source: 'draft', systemName: bindings[0].name, draftRevision: 12, projectDirty: false,
      draftSummary: {rules: 4, enabled: 1, sequences: 0}, storedSummary: {rules: 4, enabled: 1, sequences: 0}},
    module: {id: 0, name: project.name, baseTopic: 'house', gateway: 0},
    workspace: {fingerprint: project.id, systems: bindings.map(s => ({name: s.name, runtimeConfirmed: true, executing: s.id === 'example-a', binding: {systemId: s.id, generation: 2, baseTopic: s.baseTopic}}))},
    workspaceContext: {systemId: 'example-a', generation: 2, fingerprint: 'a'.repeat(64)},
    status: {confirmed: true, mqttConnected: true, executing: true, storedRevision: 11, activeRevision: 11},
    draftAvailable: true, catalogAvailable: true, catalogLoadedAt: 1794816000000, draftMismatch: false, openFormEdits: false,
    devices, scenes: [], configuration, operationConfiguration: {...configuration, revision: 11},
    createAllowed: true, editAllowed: true, sequenceAllowed: true, sequenceCreateAllowed: true, manageAllowed: true,
    diagnosticsAllowed: false, permissionsAllowed: true, createContext: 'a'.repeat(64),
    editSections: Object.fromEntries(configuration.automations.map(r => [r.id, {triggers: true, conditions: true, actions: true}])), sequenceSections: {},
    deviceSystems: bindings.map((s, index) => ({key: index ? 'garden' : '', name: s.name, baseTopic: s.baseTopic, broker: brokers[index].name, reason: ''})),
    timezones: ['Europe/Berlin', 'UTC'], notices: [], draftSyncAllowed: true,
    draftSync: {systemId: 'example-a', generation: 2, fingerprint: 'a'.repeat(64), operation: '', phase: 'current', pending: false, canStart: true, canReplace: false, canRestore: false, baseRevision: 11, remoteRevision: 11, counts: {added: 0, changed: 0, removed: 0}, permissionsChanged: false, conflicts: [], error: '', source: 'z2m', automatic: false, canOffline: true}};
  return {view, projectState: {active: true, epoch: 1, project, dirty: false, hasPath: true, protectedAvailable: true, credentials: {'example-a': 'protected', 'example-b': 'none'}, autoConnect: {}},
    networkState: {sequence: 1, brokers: brokers.map(b => ({...b, state: 'connected', error: '', certificates: false})),
      systems: bindings.map((s, i) => ({...s, fresh: true, reading: false, error: '', source: 'draft', stored: true, revision: 11, executing: !i, runtime: i ? {peers: ['house'], rules: [], runs: [], resume: true} : runtime, extensionVersion: '0.2.4', build: 'b'.repeat(64), devices: i ? 1 : 5, scenes: 0, flagsContext: 'c'.repeat(64)})),
      extensionUpdates: [], transferProgress: [], draftChecks: [], bundledExtension: {version: '0.2.4'}}};
}

export async function installGuideBridge(model, language) {
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem('z2ma.designer.language', language);
  window.guideModel = model;
  const copy = value => structuredClone(value);
  window.z2maDesktop = {
    snapshot: async () => copy(model.view),
    project: async command => {
      if (!['status', 'editing', 'edited'].includes(command.action)) throw new Error('Documentation fixture does not write projects.');
      return {ok: true, state: copy(model.projectState)};
    },
    language: async () => ({ok: true}), theme: async () => ({ok: true}),
    diagnostics: async () => ({active: false, end: 0, expired: false, events: []}),
    recording: async () => ({active: false, end: 0, expired: false, events: []}),
    credential: async () => { throw new Error('Documentation fixture has no credentials.'); },
    selectSystem: async () => ({ok: true}),
    designer: async command => {
      if (command.route === 'check-draft' || command.route === 'editor-state') return {ok: true};
      throw new Error('Documentation fixture does not submit drafts.');
    },
    network: async command => {
      if (command.action === 'validate') {
        model.networkState.outcome = 'transferValidated';
        model.networkState.draftChecks = [{id: 'example-a', kind: 'configuration', added: 1, changed: 1, removed: 0}];
        model.networkState.sequence++;
      } else if (command.action !== 'status') throw new Error('Documentation fixture has no network transport.');
      return {ok: true, state: copy(model.networkState)};
    }
  };
  await import('./desktop.js');
  const localization = await import('./localization.js');
  localization.setLanguage(language);
  document.documentElement.style.colorScheme = 'light';
  document.querySelector('#desktop-theme').value = 'light';
  window.guideRefresh = () => document.querySelector('#validate-button').click();
}
