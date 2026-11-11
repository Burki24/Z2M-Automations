import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID, createHash} from 'node:crypto';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {remoteFixture} from './support/mqtt-peer.mjs';
const require = createRequire(import.meta.url);
const {ProjectService} = require('../apps/desktop/.build/project-service.js');
const {Diagnostics} = require('../apps/desktop/.build/diagnostics.js');
const {DraftEditor, validDesignerCommand} = require('../apps/desktop/.build/draft-editor.js');
const {checkedDocument} = require('../apps/desktop/.build/draft-validation.js');
const {DraftExchange, importDraft, exportDraft} = require('../apps/desktop/.build/draft-exchange.js');
const {editorData} = require('../apps/desktop/.build/mqtt-protocol.js');
const {parseProject} = require('../apps/desktop/.build/project.js');
async function setup() {
  const debug = new Diagnostics(); debug.control('start');
  const service = new ProjectService({status: async () => 'none', protectedAvailable: async () => false, clearSession() {}}, {
    chooseOpen: async () => null, chooseSave: async () => null, confirmDiscard: async () => true, confirmRestore: async () => true, confirmDelete: async () => true
  }, debug);
  await service.command({action: 'new'});
  const broker = {id: randomUUID(), name: 'Synthetic', host: 'broker.invalid', port: 1883, tls: false};
  await service.command({action: 'broker', broker});
  const id = randomUUID(); await service.command({action: 'system', system: {id, name: 'Synthetic', brokerId: broker.id, baseTopic: 'synthetic'}});
  const remotes = new Map([[id, {...editorData(remoteFixture().editor), fresh: true}]]);
  const views = new Map(); const reader = {current: id => remotes.get(id) ?? null, source: id => views.get(id) ?? 'draft',
    reconcile() {}, view(id, source) { views.set(id, source); }};
  const editor = new DraftEditor(service, reader);
  const system = () => service.data().systems.find(system => system.id === id);
  const command = (route, payload = {}) => ({route, systemId: id, generation: service.generation() + 1, fingerprint: editor.context(system()), payload});
  const send = (route, payload) => editor.command(command(route, {requestId: randomUUID(), context: editor.context(system()), ...payload}));
  const rule = () => ({name: 'Synthetic local rule', retrigger: 'ignore', restart_policy: 'abort',
    triggers: [{type: 'time', at: '18:00:00', timezone: 'Europe/Berlin'}], conditions: [],
    actions: [{type: 'set', target: {type: 'device', id: '0x0000000000000002'}, values: {state: 'ON'}}]});
  return {service, editor, reader, remotes, views, id, system, command, send, rule, debug};
}
test('local creation is disabled, edits increment only the draft and stale/idempotent requests cannot duplicate writes', async () => {
  const s = await setup(); const payload = {requestId: randomUUID(), context: s.editor.context(s.system()), rule: s.rule()};
  const command = s.command('create', payload); const result = s.editor.command(command);
  assert.equal(s.system().configuration.automations[0].enabled, false); assert.match(result.ruleId, /^rule-/);
  assert.deepEqual(s.editor.command(command), result); assert.equal(s.system().configuration.automations.length, 1);
  const prior = s.command('edit', {requestId: randomUUID(), context: s.editor.context(s.system()), ruleId: result.ruleId, changes: {name: 'Delayed'}});
  s.send('edit', {ruleId: result.ruleId, changes: {name: 'Fresh', enabled: true}});
  assert.throws(() => s.editor.command(prior), /draftStale/);
  assert.equal(s.system().configuration.automations[0].name, 'Fresh'); assert.equal(s.system().stored, undefined);
  assert.equal(s.remotes.get(s.id).configuration.automations[0].name, 'Synthetic remote rule');
  assert.equal(JSON.stringify(s.debug.read()).includes('Fresh'), false);
});
test('the canonical schema blocks invalid times, time zones, unknown fields and invalid numeric/color writes without mutation', async () => {
  const s = await setup(); const original = JSON.stringify(s.system());
  for (const change of [rule => rule.triggers[0].at = '25:00:00', rule => rule.triggers[0].timezone = 'invalid/zone',
    rule => rule.password = 'PRIVATE', rule => rule.actions[0].values = {brightness: 255},
    rule => rule.actions[0].values = {occupancy: true}, rule => rule.actions[0].values = {state: 'TOGGLE'},
    rule => rule.triggers = [{type: 'device', device: '0x0000000000000001', property: 'occupancy', operator: 'gt', value: 1}]]) {
    const rule = s.rule(); change(rule); assert.throws(() => s.send('create', {rule}), /draft/);
    assert.equal(JSON.stringify(s.system()), original);
  }
  const light = s.remotes.get(s.id).devices[1]; light.properties.push({id: 'color', label: 'Color', type: 'color', access: 2, values: []});
  const color = s.rule(); color.actions[0].values = {color: {hex: '#12aBcD'}}; s.send('create', {rule: color});
  const invalid = s.rule(); invalid.actions[0].values = {color: {hex: 'red'}}; assert.throws(() => s.send('create', {rule: invalid}), /draftValue/);
});

test('partner grants belong to the system configuration and survive creating, copying and editing automations', async () => {
  const s = await setup(); const configuration = s.system().configuration;
  configuration.mesh_peers = ['other']; s.service.replaceDraft(s.id, configuration);
  const created = s.send('create', {rule: s.rule()});
  const copied = s.send('manage', {operation: 'copy-rule', id: created.ruleId});
  s.send('edit', {ruleId: copied.ruleId, changes: {name: 'Another automation'}});
  assert.equal(s.system().configuration.automations.length, 2);
  assert.deepEqual(s.system().configuration.mesh_peers, ['other']);
  assert.equal(s.system().configuration.automations.some(rule => Object.hasOwn(rule, 'mesh_peers')), false);
});
test('read permissions never imply write permissions; scenes and directed partner permissions are independently checked', async () => {
  const s = await setup();
  const other = randomUUID(); const p = s.service.data();
  await s.service.command({action: 'system', system: {id: other, name: 'Other', brokerId: p.brokers[0].id, baseTopic: 'other'}});
  s.remotes.set(other, structuredClone(s.remotes.get(s.id)));
  const rule = s.rule(); rule.actions[0].target.system = 'other';
  assert.throws(() => s.send('create', {rule}), /draftPermission/);
  const receiver = s.service.data().systems.find(system => system.id === other).configuration; receiver.mesh_peers = ['synthetic']; s.service.replaceDraft(other, receiver);
  assert.throws(() => s.send('create', {rule}), /draftPermission/);
  const sender = s.system().configuration; sender.mesh_peers = ['other']; s.service.replaceDraft(s.id, sender);
  s.send('create', {rule});
  const scene = s.rule(); scene.actions = [{type: 'scene', target: {type: 'device', id: '0x0000000000000002'}, scene_id: 1, endpoint: 1}];
  s.send('create', {rule: scene}); scene.actions[0].endpoint = 2; assert.throws(() => s.send('create', {rule: scene}), /draftCapability/);
  const view = s.editor.view(s.system());
  assert.equal(view.devices.find(device => device.key === '0x0000000000000001').properties[0].writable, false);
  s.remotes.get(s.id).fresh = false; assert.throws(() => s.send('create', {rule: s.rule()}), /draftCapability/);
});

test('conditions and actions select devices owned by another broker without mixing equal IEEE addresses', async () => {
  const s = await setup(); const id = randomUUID(); const broker = {id: randomUUID(), name: 'Other broker', host: 'other.invalid', port: 1883, tls: false};
  await s.service.command({action: 'broker', broker});
  await s.service.command({action: 'system', system: {id, name: 'Other system', brokerId: broker.id, baseTopic: 'other'}});
  s.remotes.set(id, structuredClone(s.remotes.get(s.id)));
  const other = () => s.service.data().systems.find(system => system.id === id);
  assert.equal(s.editor.view(s.system()).deviceSystems.find(owner => owner.key === 'other').reason, 'permissions');
  for (const [owner, peer] of [[s.system(), 'other'], [other(), 'synthetic']]) {
    const configuration = owner.configuration; configuration.mesh_peers = [peer]; s.service.replaceDraft(owner.id, configuration);
  }
  const rule = s.rule();
  rule.conditions = [{type: 'device_value', system: 'other', device: '0x0000000000000001', property: 'occupancy', operator: 'eq', value: true}];
  rule.actions[0].target.system = 'other';
  const {ruleId} = s.send('create', {rule});
  const saved = s.system().configuration.automations.find(rule => rule.id === ruleId);
  assert.equal(saved.conditions[0].system, 'other'); assert.equal(saved.conditions[0].device, '0x0000000000000001');
  const view = s.editor.view(s.system());
  assert.equal(view.deviceSystems.find(owner => owner.key === 'other').broker, 'Other broker');
  assert.equal(view.deviceSystems.find(owner => owner.key === 'other').reason, '');
  const remote = view.devices.find(device => device.target.system === 'other' && device.target.id === rule.conditions[0].device);
  assert.notEqual(remote.key, rule.conditions[0].device); assert.equal(remote.properties[0].readable, true);
  s.remotes.get(id).devices[0].properties[0].access = 2;
  assert.throws(() => s.send('create', {rule}), /draftCapability/, 'A local readable device cannot replace a foreign write-only source');
  s.remotes.get(id).fresh = false;
  assert.equal(s.editor.view(s.system()).deviceSystems.find(owner => owner.key === 'other').reason, 'catalog');
  assert.throws(() => s.send('create', {rule}), /draftCapability/);
});

test('ambiguous cross-broker topics remain unavailable and partner revocation invalidates an open editor', async () => {
  const s = await setup(); const broker = {id: randomUUID(), name: 'Other broker', host: 'other.invalid', port: 1883, tls: false};
  await s.service.command({action: 'broker', broker});
  const id = randomUUID(); await s.service.command({action: 'system', system: {id, name: 'Other', brokerId: broker.id, baseTopic: 'other'}});
  s.remotes.set(id, structuredClone(s.remotes.get(s.id)));
  for (const [ownerId, peer] of [[s.id, 'other'], [id, 'synthetic']]) {
    const configuration = s.service.data().systems.find(system => system.id === ownerId).configuration;
    configuration.mesh_peers = [peer]; s.service.replaceDraft(ownerId, configuration);
  }
  const rule = s.rule(); rule.conditions = [{type: 'device_value', system: 'other', device: '0x0000000000000001', property: 'occupancy', operator: 'eq', value: true}];
  const command = s.command('create', {requestId: randomUUID(), context: s.editor.context(s.system()), rule});
  const receiver = s.service.data().systems.find(system => system.id === id).configuration; receiver.mesh_peers = []; s.service.replaceDraft(id, receiver);
  assert.throws(() => s.editor.command(command), /draftStale/);
  await s.service.command({action: 'system', system: {id: randomUUID(), name: 'Ambiguous', brokerId: broker.id, baseTopic: 'synthetic'}});
  assert.equal(s.editor.view(s.system()).deviceSystems.find(owner => owner.key === 'other').reason, 'ambiguous');
  assert.throws(() => s.send('create', {rule}), /draftPermission/);
});
test('sequence references, expanded steps and accumulated delay are bounded; deletion cannot strand a caller', async () => {
  const s = await setup(); const leaf = s.rule().actions[0];
  const created = s.send('sequence', {sequenceId: '', changes: {name: 'Reusable', actions: [leaf]}});
  const rule = s.rule(); rule.actions = [{type: 'sequence', sequence_id: created.sequenceId, delay_seconds: 2}]; s.send('create', {rule});
  assert.throws(() => s.send('manage', {operation: 'delete-sequence', id: created.sequenceId}), /draftSequence/);
  const long = Array.from({length: 16}, () => structuredClone(leaf));
  s.send('sequence', {sequenceId: created.sequenceId, changes: {actions: long}});
  rule.actions.push(leaf); assert.throws(() => s.send('create', {rule}), /draftSequence/);
  assert.throws(() => s.send('sequence', {sequenceId: created.sequenceId, changes: {actions: [{...leaf, delay_seconds: 86400}]}}), /draftSequence/);
});
test('draft IPC rejects unknown operations, extra routing fields, oversized payloads and stored-view editing', async () => {
  const s = await setup(); const command = s.command('create', {rule: s.rule()});
  assert.equal(validDesignerCommand(command), true);
  for (const route of ['create-yaml', 'edit-yaml']) assert.equal(validDesignerCommand({...command, route}), false);
  for (const invalid of [{...command, route: 'publish'}, {...command, path: 'private'}, {...command, payload: {value: 'x'.repeat(140000)}}]) assert.equal(validDesignerCommand(invalid), false);
  s.views.set(s.id, 'stored'); assert.throws(() => s.send('create', {rule: s.rule()}), /draftStale/);
  s.views.set(s.id, 'draft'); s.service.editorState(true); await assert.rejects(s.service.command({action: 'save'}), /applyFirst/); s.service.editorState(false);
});
test('private YAML draft exchange preserves IDs/order and blocks aliases, duplicate keys, Symcon references and invalid sequences', () => {
  const configuration = remoteFixture().editor.configuration;
  configuration.mesh_peers = ['floor/one'];
  const bytes = exportDraft(configuration); assert.deepEqual(importDraft(bytes), configuration);
  for (const invalid of ['schema_version: 1\nschema_version: 1\n', 'a: &a [*a]', '---\na: 1\n---\na: 2', '!!js/function x']) assert.throws(() => importDraft(Buffer.from(invalid)), /draftSchema/);
  const privateValue = structuredClone(configuration); privateValue.automations[0].symconVariableId = 123;
  assert.throws(() => exportDraft(privateValue), /draftSchema/);
  const missing = structuredClone(configuration); missing.automations[0].actions = [{type: 'sequence', sequence_id: 'missing'}];
  assert.throws(() => checkedDocument(missing), /draftSequence/);
  assert.throws(() => importDraft(Buffer.alloc(1048577, 32)), /draftLimit/);
});
test('adopting stored state requires a private backup and never changes stored data; cancellation preserves the draft', async t => {
  const s = await setup(); const dir = await mkdtemp(join(tmpdir(), 'z2ma-draft-')); t.after(() => rm(dir, {recursive: true, force: true}));
  const remote = s.remotes.get(s.id); s.service.observe(s.service.data().id, s.service.generation(), s.id,
    {revision: remote.status.revision, checksum: remote.status.checksum, configuration: remote.configuration, yaml: remote.yaml});
  const before = structuredClone(s.system());
  const dialogs = {chooseImport: async () => null, chooseExport: async () => null, chooseBackup: async () => null, confirm: async () => true};
  const exchange = new DraftExchange(s.service, s.editor, dialogs);
  assert.equal((await exchange.command(s.command('adopt'))).canceled, true); assert.deepEqual(s.system(), before);
  dialogs.chooseBackup = async () => join(dir, 'missing-parent', 'before.z2ma');
  await assert.rejects(exchange.command(s.command('adopt'))); assert.deepEqual(s.system(), before);
  const backup = join(dir, 'before.z2ma'); dialogs.chooseBackup = async () => backup;
  await exchange.command(s.command('adopt'));
  assert.deepEqual(parseProject(await readFile(backup)).systems[0].configuration, before.configuration);
  assert.deepEqual(s.system().stored, before.stored); assert.equal(s.system().configuration.automations[0].enabled, false);
  assert.equal(s.system().configuration.automations[0].id, 'remote-rule');
});
test('YAML exports the complete local draft without saving or changing the selected source', async t => {
  const s = await setup();
  const dir = await mkdtemp(join(tmpdir(), 'z2ma-export-')); t.after(() => rm(dir, {recursive: true, force: true}));
  const path = join(dir, 'automations.yaml');
  const existing = s.send('create', {rule: s.rule()});
  s.send('edit', {ruleId: existing.ruleId, changes: {enabled: true}});
  s.send('create', {rule: {...s.rule(), name: 'New local rule'}});
  s.views.set(s.id, 'stored');
  const before = s.service.data();
  const draft = before.systems[0].configuration;
  const command = s.command('export');
  const dialogs = {chooseImport: async () => null, chooseExport: async () => null, chooseBackup: async () => null, confirm: async () => true};
  const exchange = new DraftExchange(s.service, s.editor, dialogs);
  assert.deepEqual(await exchange.command(command), {ok: true, canceled: true});
  await assert.rejects(readFile(path), {code: 'ENOENT'});
  dialogs.chooseExport = async () => path;
  await exchange.command(command);
  const exported = importDraft(await readFile(path));
  assert.deepEqual(exported, draft);
  assert.deepEqual(s.service.data(), before);
  assert.equal(s.reader.source(s.id), 'stored');
  dialogs.chooseExport = async () => {
    await s.service.command({action: 'draft', systemId: s.id, operation: 'rename', ruleId: existing.ruleId, name: 'Changed while choosing a file'});
    return path;
  };
  await assert.rejects(exchange.command(command), /draftStale/);
  assert.deepEqual(importDraft(await readFile(path)), exported);
});
test('the consumed schema artifact matches its recorded provenance', async () => {
  const base = new URL('../apps/desktop/schema/', import.meta.url); const provenance = JSON.parse(await readFile(new URL('provenance.json', base)));
  assert.equal(createHash('sha256').update(await readFile(new URL('automations.schema.json', base))).digest('hex'), provenance.sha256);
});
