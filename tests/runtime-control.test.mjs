import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Extension from '../apps/desktop/extension/z2m-automations.mjs';
import {remoteFixture, startPeer} from './support/mqtt-peer.mjs';

const require = createRequire(import.meta.url);
const {MqttReader, validNetworkCommand} = require('../apps/desktop/.build/mqtt-reader.js');
const {ProjectService} = require('../apps/desktop/.build/project-service.js');
const {Diagnostics} = require('../apps/desktop/.build/diagnostics.js');
const {RuntimeControl} = require('../apps/desktop/.build/runtime-control.js');
const {ExtensionTransfer} = require('../apps/desktop/.build/extension-transfer.js');

async function setup(t, {delay = 0, systems = 1} = {}) {
  const base = 'synthetic/runtime';
  const directory = await mkdtemp(join(tmpdir(), 'z2ma-runtime-'));
  const fixture = remoteFixture();
  const configuration = {...fixture.editor.configuration, revision: 1};
  if (delay) configuration.automations[0].actions[0].delay_seconds = delay;
  const [sensor, light] = fixture.editor.devices.map(({id, name}) => ({ID: id, ieeeAddr: id, name, isDevice: () => true}));
  sensor.exposes = () => [{type: 'binary', property: 'occupancy', access: 1, value_on: true, value_off: false}];
  light.exposes = () => [{type: 'binary', property: 'state', access: 7, value_on: 'ON', value_off: 'OFF'}];
  const effects = [];
  let receive, state, send, suppress;
  const zigbee = {devicesIterator: () => [sensor, light].values(), groupsIterator: () => [].values(),
    resolveEntity: id => [sensor, light].find(device => device.ID === id)};
  const extension = new Extension(zigbee, {publish: async (topic, bytes) => {
    if (!topic.endsWith('/response/' + suppress)) send?.(JSON.parse(bytes), base + '/' + topic);
  }}, {get: () => ({})}, null, {
    onMQTTMessage: (_owner, handler) => { receive = handler; },
    onPublishEntityState: (_owner, handler) => { state = handler; },
    emitMQTTMessage: effect => effects.push(effect),
    removeListeners() {}
  }, null, null, null, {get: () => ({mqtt: {base_topic: base}})}, {}, {directory});
  t.after(async () => { await extension.stop(); await rm(directory, {recursive: true, force: true}); });
  await extension.start();
  let stored;
  send = (response, topic) => { if (topic.endsWith('/response/store')) stored = response; };
  await receive({topic: base + '/symcon/automations/request/store',
    message: JSON.stringify({protocol_version: 1, transaction: randomUUID(), session: extension.session,
      expected_revision: 0, yaml: JSON.stringify(configuration)})});
  assert.equal(extension.status().stored_revision, 1, JSON.stringify(stored));
  const siblings = Array.from({length: systems - 1}, (_, index) => [base + '-' + index, remoteFixture()]);
  const peer = await startPeer({systems: new Map([[base, fixture], ...siblings]), reply({base: topic, operation, request, publish}) {
    if (topic !== base) { publish(); return; }
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
    suppress: operation => { suppress = operation; }};
}

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
