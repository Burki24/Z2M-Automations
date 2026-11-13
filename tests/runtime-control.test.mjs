import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parse} from 'yaml';
import Extension from '../apps/desktop/extension/z2m-automations.mjs';
import LegacyExtension from './fixtures/extension-0.2.0/z2m-automations.mjs';
import {remoteFixture, startPeer} from './support/mqtt-peer.mjs';

const require = createRequire(import.meta.url);
const {MqttReader, validNetworkCommand} = require('../apps/desktop/.build/mqtt-reader.js');
const {ProjectService} = require('../apps/desktop/.build/project-service.js');
const {Diagnostics} = require('../apps/desktop/.build/diagnostics.js');
const {RuntimeControl} = require('../apps/desktop/.build/runtime-control.js');
const {ExtensionTransfer} = require('../apps/desktop/.build/extension-transfer.js');

async function setup(t, {delay = 0, systems = 1, enabled = true, stored = true, extensionClass = Extension, brightness = false} = {}) {
  const base = 'synthetic/runtime';
  const directory = await mkdtemp(join(tmpdir(), 'z2ma-runtime-'));
  const fixture = remoteFixture();
  const configuration = {...fixture.editor.configuration, revision: 1};
  configuration.automations[0].enabled = enabled;
  if (delay) configuration.automations[0].actions[0].delay_seconds = delay;
  const [sensor, light] = fixture.editor.devices.map(({id, name}) => ({ID: id, ieeeAddr: id, name, isDevice: () => true}));
  sensor.exposes = () => [{type: 'binary', property: 'occupancy', access: 1, value_on: true, value_off: false}];
  light.exposes = () => [{type: 'binary', property: 'state', access: 7, value_on: 'ON', value_off: 'OFF'},
    ...(brightness ? [{type: 'numeric', property: 'brightness', access: 7, value_min: 0, value_max: 254, value_step: 1}] : [])];
  const effects = [];
  let receive, state, send, suppress, rejected;
  const zigbee = {devicesIterator: () => [sensor, light].values(), groupsIterator: () => [].values(),
    resolveEntity: id => [sensor, light].find(device => device.ID === id)};
  const extension = new extensionClass(zigbee, {publish: async (topic, bytes) => {
    if (!topic.endsWith('/response/' + suppress)) send?.(JSON.parse(bytes), base + '/' + topic);
  }}, {get: () => ({})}, null, {
    onMQTTMessage: (_owner, handler) => { receive = handler; },
    onPublishEntityState: (_owner, handler) => { state = handler; },
    emitMQTTMessage: effect => effects.push(effect),
    removeListeners() {}
  }, null, null, null, {get: () => ({mqtt: {base_topic: base}})}, {}, {directory});
  t.after(async () => { await extension.stop(); await rm(directory, {recursive: true, force: true}); });
  await extension.start();
  let storedReply;
  send = (response, topic) => { if (topic.endsWith('/response/store')) storedReply = response; };
  if (stored) await receive({topic: base + '/symcon/automations/request/store',
    message: JSON.stringify({protocol_version: 1, transaction: randomUUID(), session: extension.session,
      expected_revision: 0, yaml: JSON.stringify(configuration)})});
  assert.equal(extension.status().stored_revision, stored ? 1 : 0, JSON.stringify(storedReply));
  const siblings = Array.from({length: systems - 1}, (_, index) => [base + '-' + index, remoteFixture()]);
  const peer = await startPeer({systems: new Map([[base, fixture], ...siblings]), reply({base: topic, operation, request, response, publish}) {
    if (topic !== base) { publish(); return; }
    if (operation === rejected) { publish({...response, status: 'error'}); return; }
    send = publish;
    void receive({topic: base + '/symcon/automations/request/' + operation, message: JSON.stringify(request)});
  }});
  t.after(() => peer.close());
  const debug = new Diagnostics();
  debug.control('start');
  const vault = {read: async () => null, status: async () => 'none', protectedAvailable: async () => false, clearSession() {}};
  const projects = new ProjectService(vault, {}, debug);
  await projects.command({action: 'new'});
  const broker = {id: randomUUID(), name: 'Synthetic', host: '127.0.0.1', port: peer.port, tls: false};
  await projects.command({action: 'broker', broker});
  const id = randomUUID();
  await projects.command({action: 'system', system: {id, name: 'Synthetic', brokerId: broker.id, baseTopic: base}});
  const otherIds = [];
  for (const [baseTopic] of siblings) {
    const id = randomUUID();
    otherIds.push(id);
    await projects.command({action: 'system', system: {id, name: baseTopic, brokerId: broker.id, baseTopic}});
  }
  const reader = new MqttReader(vault, debug, async (project, epoch, system, stored, current) => {
    if (current()) projects.observe(project, epoch, system, stored);
  }, undefined, 600);
  t.after(() => reader.close());
  reader.reconcile(projects.data(), projects.generation());
  await reader.connectBroker(broker.id);
  for (let attempt = 0; !reader.connected(broker.id) && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
  await reader.refresh(id);
  const review = {confirm: async () => true};
  const runtime = new RuntimeControl(projects, reader, (...args) => review.confirm(...args));
  const command = (action, fields) => runtime.command(action, {action, id, ...fields});
  const event = async () => {
    state({entity: sensor, payload: {occupancy: true}, message: {occupancy: true}});
    await Promise.all([...extension.runtime.tasks]);
  };
  return {base, otherIds, command, extension, reader, id, effects, event, review, projects, peer, debug, directory,
    restart: async () => { await extension.stop(); await extension.start(); await reader.refresh(id); },
    reject: operation => { rejected = operation; },
    suppress: operation => { suppress = operation; }};
}

test('one draft check automatically preserves enabled flags when only switches changed', async t => {
  const s = await setup(t, {enabled: false});
  const transfer = new ExtensionTransfer(s.projects, s.reader, {confirm: async () => true, backup: async () => join(s.directory, 'backup.z2ma')});
  const draft = structuredClone(s.reader.current(s.id).configuration);
  draft.automations[0].enabled = true;
  s.projects.replaceDraft(s.id, draft);
  assert.equal(await transfer.command('validate', s.id), 'transferValidated');
  const request = s.peer.publications.find(packet => packet.topic.endsWith('/request/validate'));
  assert.equal(parse(JSON.parse(request.payload).yaml).automations[0].enabled, true);
  assert.equal(s.extension.status().executing, false);
  assert.equal(s.peer.publications.some(packet => packet.topic.endsWith('/request/store')), false);
});

test('operation grants confirm and store selected rule switches directly while keeping operation stopped', async t => {
  const s = await setup(t, {enabled: false, systems: 2});
  const original = structuredClone(s.reader.current(s.id).configuration);
  s.projects.replaceDraft(s.id, original);
  let confirmations = 0;
  const transfer = new ExtensionTransfer(s.projects, s.reader, {
    confirm: async (action, review) => { confirmations++; assert.equal(action, 'store'); assert.equal(review.kind, 'flags'); assert.equal(review.enabled, 1); return true; },
    backup: async () => join(s.directory, 'operation-flags.z2ma')
  });
  const context = transfer.flagsContext(s.id);
  assert.match(context, /^[a-f0-9]{64}$/);
  assert.equal(await transfer.applyFlags(s.id, context, ['remote-rule']), 'transferStored');
  await s.reader.refresh(s.id);
  const saved = s.reader.current(s.id).configuration;
  assert.deepEqual({...saved, revision: original.revision, automations: saved.automations.map(rule => ({...rule, enabled: false}))}, original);
  assert.equal(saved.automations[0].enabled, true);
  assert.equal(s.projects.data().systems[0].configuration.automations[0].enabled, true);
  assert.equal(s.extension.status().executing, false); assert.equal(confirmations, 1); assert.equal(s.effects.length, 0);
  assert.ok(s.peer.publications.filter(packet => /\/request\/(validate|store)$/.test(packet.topic)).every(packet => packet.topic.startsWith(s.base + '/')));
  assert.equal(s.peer.publications.some(packet => /\/request\/(activate|run_once)$/.test(packet.topic)), false);
});

test('operation grants preserve unrelated local draft content and can revoke the last enabled rule', async t => {
  const s = await setup(t);
  const draft = structuredClone(s.reader.current(s.id).configuration); draft.automations[0].name = 'Unsubmitted local change';
  draft.mesh_peers = ['unsubmitted-peer']; s.projects.replaceDraft(s.id, draft);
  await s.command('activate', {resume: true}); await s.reader.refresh(s.id);
  const transfer = new ExtensionTransfer(s.projects, s.reader, {confirm: async (_action, review) => {
    assert.equal(review.enabled, 0); assert.equal(review.running, true); return true;
  }, backup: async () => join(s.directory, 'revoke-flags.z2ma')});
  assert.equal(await transfer.applyFlags(s.id, transfer.flagsContext(s.id), []), 'transferStored');
  await s.reader.refresh(s.id);
  assert.deepEqual(s.projects.data().systems[0].configuration, draft);
  assert.equal(s.reader.current(s.id).configuration.automations[0].name, 'Synthetic remote rule');
  assert.deepEqual(s.reader.current(s.id).configuration.mesh_peers, []);
  assert.equal(s.reader.current(s.id).configuration.automations[0].enabled, false);
  assert.equal(s.extension.status().executing, false); assert.equal(s.effects.length, 0);
});

for (const canceled of ['confirm', 'backup']) test('canceling direct rule permissions at ' + canceled + ' leaves stored rules and local input unchanged', async t => {
  const s = await setup(t); const draft = structuredClone(s.reader.current(s.id).configuration);
  s.projects.replaceDraft(s.id, draft); await s.command('activate', {resume: false}); await s.reader.refresh(s.id);
  const before = s.peer.publications.length;
  const transfer = new ExtensionTransfer(s.projects, s.reader, {confirm: async () => canceled !== 'confirm',
    backup: async () => null});
  assert.equal(await transfer.applyFlags(s.id, transfer.flagsContext(s.id), []), 'transferCanceled');
  assert.equal(s.extension.status().executing, true);
  assert.deepEqual(s.projects.data().systems[0].configuration, draft);
  assert.equal(s.peer.publications.slice(before).some(packet => /\/request\/(store|deactivate|activate|run_once)$/.test(packet.topic)), false);
});

test('direct rule permission requests reject stale contexts, unknown or duplicate IDs and pending input without writing', async t => {
  const s = await setup(t, {enabled: false});
  const transfer = new ExtensionTransfer(s.projects, s.reader, {confirm: async () => { throw new Error('Unexpected confirmation'); }, backup: async () => null});
  const context = transfer.flagsContext(s.id);
  await assert.rejects(transfer.applyFlags(s.id, 'f'.repeat(64), ['remote-rule']), /runtimeFlagsChanged/);
  await assert.rejects(transfer.applyFlags(s.id, context, ['missing-rule']), /runtimeFlagsChanged/);
  await assert.rejects(transfer.applyFlags(s.id, context, ['remote-rule', 'remote-rule']), /invalidRequest/);
  s.projects.editorState(true);
  await assert.rejects(transfer.applyFlags(s.id, context, ['remote-rule']), /applyFirst/); s.projects.editorState(false);
  assert.equal(await transfer.applyFlags(s.id, context, []), 'transferUnchanged');
  const draft = s.projects.data().systems[0].configuration; draft.revision++; s.projects.replaceDraft(s.id, draft);
  await assert.rejects(transfer.applyFlags(s.id, context, ['remote-rule']), /runtimeFlagsChanged/);
  for (const invalid of [{action: 'setRuleFlags', id: s.id, context, enabled: ['remote-rule'], path: 'private'},
    {action: 'setRuleFlags', id: s.id, context: '', enabled: []}, {action: 'setRuleFlags', id: s.id, context, enabled: ['other/topic']}]) {
    assert.equal(validNetworkCommand(invalid), false);
  }
  assert.equal(validNetworkCommand({action: 'setRuleFlags', id: s.id, context, enabled: []}), true);
  assert.equal(s.peer.publications.some(packet => /\/request\/(validate|store|deactivate|activate|run_once)$/.test(packet.topic)), false);
});

test('an unconfirmed direct-grant stop blocks a second attempt instead of replaying control commands', async t => {
  const s = await setup(t); await s.command('activate', {resume: true}); await s.reader.refresh(s.id);
  const transfer = new ExtensionTransfer(s.projects, s.reader, {confirm: async () => true, backup: async () => join(s.directory, 'uncertain-flags.z2ma')});
  const context = transfer.flagsContext(s.id); s.reject('deactivate');
  await assert.rejects(transfer.applyFlags(s.id, context, []), /transferStopUncertain/);
  await assert.rejects(transfer.applyFlags(s.id, context, []), /transferUncertain/);
  assert.equal(s.peer.publications.filter(packet => packet.topic.endsWith('/request/deactivate')).length, 1);
  assert.equal(s.peer.publications.some(packet => packet.topic.endsWith('/request/store')), false);
});

test('the pinned extension validates, stores and executes native state TOGGLE together with another command value', async t => {
  const s = await setup(t, {brightness: true});
  const draft = structuredClone(s.reader.current(s.id).configuration);
  draft.automations[0].actions[0].values = {state: 'TOGGLE', brightness: 100};
  s.projects.replaceDraft(s.id, draft);
  const transfer = new ExtensionTransfer(s.projects, s.reader, {confirm: async () => true, backup: async () => join(s.directory, 'native-toggle.z2ma')});
  assert.equal(await transfer.command('validate', s.id), 'transferValidated');
  assert.equal(await transfer.command('store', s.id), 'transferStored');
  await s.reader.refresh(s.id);
  assert.deepEqual(s.reader.current(s.id).configuration.automations[0].actions[0].values, {state: 'TOGGLE', brightness: 100});
  assert.equal(await s.command('run_once', {rule: 'remote-rule'}), 'runtimeConfirmed');
  await Promise.all([...s.extension.runtime.tasks]);
  assert.equal(s.effects.length, 1);
  assert.deepEqual(JSON.parse(s.effects[0].message), {state: 'TOGGLE', brightness: 100});
  assert.equal(s.effects[0].topic, 'synthetic/runtime/Synthetic light/set');
  assert.ok(s.peer.publications.every(packet => !packet.retain));
});

test('guided transfer confirms and backs up before stopping, storing and checking the exact disabled draft', async t => {
  const s = await setup(t);
  await s.command('activate', {resume: true});
  const before = structuredClone(s.projects.data().systems[0].stored);
  const draft = structuredClone(s.reader.current(s.id).configuration); draft.automations[0].name = 'Edited synthetic rule';
  s.projects.replaceDraft(s.id, draft);
  const steps = [];
  const transfer = new ExtensionTransfer(s.projects, s.reader, {
    confirm: async () => { steps.push('confirm'); assert.equal(s.extension.status().executing, true); return true; },
    backup: async () => { steps.push('backup'); assert.equal(s.extension.status().executing, true); return join(s.directory, 'backup.z2ma'); }
  });
  assert.equal(await transfer.command('validate', s.id), 'transferValidated');
  assert.equal(s.extension.status().executing, true, 'Checking must not stop operation');
  assert.equal(await transfer.command('store', s.id), 'transferStored');
  assert.deepEqual(steps, ['confirm', 'backup']);
  assert.equal(s.extension.status().executing, false);
  assert.equal(s.projects.data().systems[0].stored.configuration.automations[0].enabled, false);
  assert.equal(s.projects.data().systems[0].stored.configuration.automations[0].name, 'Edited synthetic rule');
  assert.deepEqual(JSON.parse(await readFile(join(s.directory, 'backup.z2ma'), 'utf8')).systems[0].stored, before);
  assert.deepEqual(s.effects, []);
  const commands = s.peer.publications.map(packet => packet.topic.split('/request/')[1]).filter(value => ['activate', 'deactivate', 'store'].includes(value));
  assert.deepEqual(commands, ['activate', 'deactivate', 'store']);
});

async function guided(t, options = {}) {
  const s = await setup(t, options);
  const draft = structuredClone(s.reader.current(s.id).configuration);
  if (options.flags) draft.automations[0].enabled = !draft.automations[0].enabled;
  else draft.automations[0].name = 'Edited synthetic rule';
  s.projects.replaceDraft(s.id, draft);
  const dialogs = {confirm: async () => true, backup: async () => join(s.directory, 'backup.z2ma')};
  const transfer = new ExtensionTransfer(s.projects, s.reader, dialogs);
  return {...s, draft, dialogs, transfer, check: () => transfer.command('validate', s.id), send: () => transfer.command('store', s.id),
    count: operation => s.peer.publications.filter(packet => packet.topic.endsWith('/request/' + operation)).length};
}

test('the common check stores changed switches while leaving operation stopped', async t => {
  const s = await guided(t, {enabled: false, flags: true});
  assert.equal(await s.check(), 'transferValidated');
  assert.equal(s.transfer.reviewState().checks[0].kind, 'flags');
  assert.equal(await s.send(), 'transferStored');
  assert.equal(s.projects.data().systems[0].stored.configuration.automations[0].enabled, true);
  assert.equal(s.extension.status().executing, false);
  assert.equal(s.count('deactivate'), 0);
  assert.equal(s.count('activate'), 0);
});

test('unchanged configuration needs no write even with a different local revision', async t => {
  const s = await guided(t);
  const draft = structuredClone(s.reader.current(s.id).configuration); draft.revision = 27;
  s.projects.replaceDraft(s.id, draft);
  assert.equal(await s.check(), 'transferUnchanged');
  assert.equal(s.transfer.reviewState().checks[0].kind, 'unchanged');
  await assert.rejects(s.send(), /transferUnchanged/);
  assert.equal(s.count('validate'), 0);
  assert.equal(s.count('store'), 0);
  assert.equal(s.count('deactivate'), 0);
});

test('an empty draft and empty Z2M storage need no transfer', async t => {
  const s = await setup(t, {stored: false});
  const transfer = new ExtensionTransfer(s.projects, s.reader, {confirm: async () => assert.fail('Unchanged state must not request consent'), backup: async () => null});
  assert.equal(await transfer.command('validate', s.id), 'transferUnchanged');
  assert.equal(s.peer.publications.some(packet => packet.topic.endsWith('/request/validate') || packet.topic.endsWith('/request/store')), false);
});

for (const cancel of ['confirmation', 'backup']) test('guided transfer cancellation at ' + cancel + ' leaves operation running', async t => {
  const s = await guided(t);
  await s.command('activate', {resume: true}); await s.check();
  if (cancel === 'confirmation') s.dialogs.confirm = async () => false;
  else s.dialogs.backup = async () => null;
  assert.equal(await s.send(), 'transferCanceled');
  assert.equal(s.extension.status().executing, true);
  assert.equal(s.count('deactivate'), 0);
  assert.equal(s.count('store'), 0);
});

for (const stage of ['confirmation', 'backup']) test('a draft edited during ' + stage + ' cannot be stopped or uploaded', async t => {
  const s = await guided(t);
  await s.command('activate', {resume: true}); await s.check();
  const edit = () => { const changed = structuredClone(s.draft); changed.automations[0].name += ' newer'; s.projects.replaceDraft(s.id, changed); };
  if (stage === 'confirmation') s.dialogs.confirm = async () => { edit(); return true; };
  else s.dialogs.backup = async () => { edit(); return join(s.directory, 'backup.z2ma'); };
  await assert.rejects(s.send(), /transferChanged/);
  assert.equal(s.extension.status().executing, true);
  assert.equal(s.count('deactivate'), 0);
  assert.equal(s.count('store'), 0);
});

test('a session changed during confirmation cannot receive a guided upload', async t => {
  const s = await guided(t); await s.check();
  s.dialogs.confirm = async () => { await s.restart(); return true; };
  await assert.rejects(s.send(), /transferChanged/);
  assert.equal(s.count('deactivate'), 0);
  assert.equal(s.count('store'), 0);
});

for (const operation of ['deactivate', 'store']) test('guided transfer independently verifies a lost ' + operation + ' acknowledgement', async t => {
  const s = await guided(t);
  await s.command('activate', {resume: true}); await s.check(); s.suppress(operation);
  assert.equal(await s.send(), 'transferStored');
  assert.equal(s.count('deactivate'), 1);
  assert.equal(s.count('store'), 1);
  assert.equal(s.extension.status().executing, false);
  assert.equal(s.transfer.transferPending(s.id), false);
});

test('an unconfirmed stop blocks the upload without repeating the stop', async t => {
  const s = await guided(t);
  await s.command('activate', {resume: true}); await s.check(); s.reject('deactivate');
  await assert.rejects(s.send(), /transferStopUncertain/);
  await assert.rejects(s.transfer.command('checkTransfer', s.id), /transferStopUncertain/);
  await assert.rejects(s.send(), /transferStopUncertain/);
  assert.equal(s.transfer.transferPending(s.id), true);
  assert.equal(s.count('deactivate'), 1);
  assert.equal(s.count('store'), 0);
  s.reject(null); await s.command('deactivate');
  assert.equal(await s.transfer.command('checkTransfer', s.id), 'transferStopped');
  assert.equal(s.transfer.transferPending(s.id), false);
});

test('an unconfirmed store is never resent by transfer or check commands', async t => {
  const s = await guided(t); await s.check(); s.reject('store');
  await assert.rejects(s.send(), /transferUncertain/);
  await assert.rejects(s.send(), /transferUncertain/);
  await assert.rejects(s.transfer.command('checkTransfer', s.id), /transferUncertain/);
  assert.equal(s.count('store'), 1);
  assert.equal(s.transfer.transferPending(s.id), true);
});

test('a failed post-stop validation cannot upload or restart operation', async t => {
  const s = await guided(t);
  await s.command('activate', {resume: true}); await s.check(); s.reject('validate');
  await assert.rejects(s.send(), /remoteError/);
  assert.equal(s.extension.status().executing, false);
  assert.equal(s.extension.status().stored_revision, 1);
  assert.equal(s.count('store'), 0);
  assert.equal(s.count('activate'), 1);
});

test('guided transfer writes only its selected system among eight shared-broker systems', async t => {
  const s = await guided(t, {systems: 8});
  await s.command('activate', {resume: false}); await s.check();
  assert.equal(await s.send(), 'transferStored');
  const writes = s.peer.publications.filter(packet => /\/request\/(deactivate|store)$/.test(packet.topic));
  assert.equal(writes.length, 2);
  assert.ok(writes.every(packet => packet.topic.startsWith(s.base + '/symcon/automations/')));
  const phases = s.debug.read().events.filter(event => event.code === 'draftTransfer').map(event => event.phase);
  assert.deepEqual(phases, ['backingUp', 'stopping', 'checking', 'sending', 'verifying', 'complete']);
});

test('desktop starts a stored rule, records the run, and confirms a specific device effect', async t => {
  const s = await setup(t);
  assert.equal(await s.command('run_once', {rule: 'remote-rule'}), 'runtimeConfirmed');
  await s.reader.refresh(s.id);
  assert.equal(s.effects.length, 1);
  assert.equal(s.effects[0].topic, 'synthetic/runtime/Synthetic light/set');
  assert.deepEqual(JSON.parse(s.effects[0].message), {state: 'ON'});
  const [run] = s.reader.current(s.id).status.execution.runs;
  assert.equal(run.state, 'completed');
  assert.ok(s.debug.read().events.some(event => event.code === 'execution' && event.system === s.id && event.run === run.run && event.step === 1));
  assert.equal(s.debug.read().events.some(event => JSON.stringify(event).includes('activation_token')), false);
});

test('activation persists across desktop disconnect and the opted-in Z2M restart', async t => {
  const s = await setup(t);
  assert.equal(await s.command('activate', {resume: true}), 'runtimeConfirmed');
  await s.restart();
  assert.equal(s.reader.current(s.id).status.recovery, 'resumed');
  s.reader.close();
  await s.event();
  assert.equal(s.effects.length, 1);
  assert.equal(s.extension.status().executing, true);
});

for (const [name, extensionClass] of [['0.2.0', LegacyExtension], ['bundled', Extension]]) {
  test('stopping ' + name + ' confirms a stopped runtime with its persisted restart preference', async t => {
    const s = await setup(t, {extensionClass});
    assert.equal(await s.command('activate', {resume: true}), 'runtimeConfirmed');
    assert.equal(s.extension.status().resume_enabled, true);
    assert.equal(await s.command('deactivate'), 'runtimeConfirmed');
    assert.equal(s.extension.status().executing, false);
    assert.equal(s.extension.status().resume_status, 'stopped');
    await s.restart();
    assert.equal(s.extension.status().executing, false);
    assert.equal(s.extension.status().resume_status, 'stopped');
  });
  test('a lost stop acknowledgement from ' + name + ' is confirmed by reading without resending', async t => {
    const s = await setup(t, {extensionClass});
    await s.command('activate', {resume: true}); s.suppress('deactivate');
    assert.equal(await s.command('deactivate'), 'runtimeConfirmed');
    assert.equal(s.extension.status().executing, false);
    assert.equal(s.peer.publications.filter(packet => packet.topic.endsWith('/request/deactivate')).length, 1);
  });
}

test('cancellation and uncertainty never cause a second start publication', async t => {
  const s = await setup(t);
  s.review.confirm = async () => false;
  assert.equal(await s.command('run_once', {rule: 'remote-rule'}), 'transferCanceled');
  assert.equal(s.effects.length, 0);
  s.review.confirm = async () => true;
  s.suppress('run_once');
  await assert.rejects(s.command('run_once', {rule: 'remote-rule'}), /runtimeUncertain/);
  await s.reader.refresh(s.id);
  await assert.rejects(s.command('run_once', {rule: 'remote-rule'}), /runtimeUncertain/);
  assert.equal(s.peer.publications.filter(packet => packet.topic.endsWith('/request/run_once')).length, 1);
  assert.equal(s.effects.length, 1);
  assert.equal(await s.command('deactivate'), 'runtimeConfirmed');
  assert.equal(s.extension.status().resume_enabled, false);
});

test('enabled-flag validation allows only changes to flags on an existing stored document', async t => {
  const s = await setup(t);
  const transfer = new ExtensionTransfer(s.projects, s.reader, {confirm: async () => true, backup: async () => join(s.directory, 'backup.z2ma')});
  const draft = structuredClone(s.reader.current(s.id).configuration);
  draft.automations[0].enabled = false;
  s.projects.replaceDraft(s.id, draft);
  assert.equal(await transfer.command('validateEnabled', s.id), 'transferValidated');
  assert.equal(await transfer.command('store', s.id), 'transferStored');
  assert.equal(s.extension.store.current.document.automations[0].enabled, false);
  draft.automations[0].name = 'Changed content';
  s.projects.replaceDraft(s.id, draft);
  await assert.rejects(transfer.command('validateEnabled', s.id), /runtimeFlagsOnly/);
});

test('only the exact selected run can be stopped before the delayed device action', async t => {
  const s = await setup(t, {delay: 30});
  await s.command('run_once', {rule: 'remote-rule'});
  await s.reader.refresh(s.id);
  const [run] = s.reader.current(s.id).status.execution.runs;
  assert.equal(run.state, 'running');
  await assert.rejects(s.command('stop_rule', {rule: run.rule, run: randomUUID()}), /runtimeChanged/);
  assert.equal(await s.command('stop_rule', {rule: run.rule, run: run.run}), 'runtimeConfirmed');
  assert.equal(s.effects.length, 0);
  assert.equal(s.extension.executionStatus().runs[0].state, 'stopped');
});

for (const systems of [2, 8]) {
  test(`a rule with a shared ID is run only on its selected system among ${systems} systems`, async t => {
    const s = await setup(t, {systems});
    await Promise.all(s.otherIds.map(id => s.reader.refresh(id)));
    await s.command('run_once', {rule: 'remote-rule'});
    assert.equal(s.effects.length, 1);
    assert.deepEqual(s.peer.publications.filter(packet => packet.topic.endsWith('/request/run_once')).map(packet => packet.topic),
      [s.base + '/symcon/automations/request/run_once']);
  });
}

test('restart recovery is opt-in and the extension remains stopped after an unarmed restart', async t => {
  const s = await setup(t);
  await s.command('activate', {resume: false});
  await s.restart();
  await s.event();
  assert.equal(s.effects.length, 0);
  assert.equal(s.extension.status().executing, false);
});

test('IPC rejects extra protocol fields and malformed stored rule or run identifiers', () => {
  const id = randomUUID();
  assert.equal(validNetworkCommand({action: 'activate', id, resume: false}), true);
  assert.equal(validNetworkCommand({action: 'activate', id, resume: false, activation_token: randomUUID()}), false);
  assert.equal(validNetworkCommand({action: 'run_once', id, rule: 'other/topic'}), false);
  assert.equal(validNetworkCommand({action: 'stop_rule', id, rule: 'remote-rule', run: 'example-a'}), false);
});
