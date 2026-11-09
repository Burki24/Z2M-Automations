import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID, createHash} from 'node:crypto';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parse} from 'yaml';
import {startPeer, remoteFixture} from './support/mqtt-peer.mjs';

const require = createRequire(import.meta.url);
const {ExtensionTransfer, bundledExtension} = require('../apps/desktop/.build/extension-transfer.js');
const {MqttReader} = require('../apps/desktop/.build/mqtt-reader.js');
const {ProjectService} = require('../apps/desktop/.build/project-service.js');
const {Diagnostics} = require('../apps/desktop/.build/diagnostics.js');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function setup(t, options = {}) {
  const fixture = remoteFixture();
  const draft = structuredClone(fixture.editor.configuration);
  fixture.status.executing = fixture.editor.executing = false;
  fixture.status.extension_build = fixture.editor.extension_build = 'a'.repeat(64);
  let installed = !options.absent;
  let loseAck = false;
  const peer = await startPeer({
    systems: new Map([['synthetic', fixture]]),
    bridge: {state: {state: 'online'}, extensions: installed ? [{name: 'z2m-automations.mjs'}] : []},
    reply({operation, request, response, publish}) {
      if (operation === 'install') {
        assert.equal(request.name, 'z2m-automations.mjs');
        assert.equal(hash(request.code), 'aef090e0fab41c50b7f5360d03c9c077ef559a7e192a18d26ad397e3ceda8ecd');
        installed = true;
        Object.assign(fixture.status, {session: randomUUID(), extension_build: bundledExtension.build, extension_version: bundledExtension.version});
        if (options.absent) {
          Object.assign(fixture.status, {stored_revision: 0, checksum: null, storage: 'empty'});
          Object.assign(fixture.editor, {yaml: null, configuration: {schema_version: 1, revision: 0, automations: []}});
        }
        Object.assign(fixture.editor, fixture.status);
        if (!options.loseInstallAck) publish();
      } else if (installed && operation === 'validate') {
        const doc = parse(request.yaml);
        publish({...response, data: {valid: true, revision: doc.revision, checksum: hash(request.yaml), automation_count: doc.automations.length, executing: false}});
      } else if (installed && operation === 'store') {
        assert.equal(request.session, fixture.status.session);
        assert.equal(request.expected_revision, fixture.status.stored_revision);
        const doc = parse(request.yaml);
        assert.equal(doc.revision, request.expected_revision + 1);
        assert.ok(doc.automations.every(rule => !rule.enabled));
        Object.assign(fixture.status, {stored_revision: doc.revision, checksum: hash(request.yaml), storage: 'ok'});
        Object.assign(fixture.editor, fixture.status, {configuration: doc, yaml: request.yaml});
        if (!loseAck) publish({...response, data: {...fixture.status, automation_count: doc.automations.length}});
      } else if (installed) publish();
    }
  });
  const directory = await mkdtemp(join(tmpdir(), 'z2ma-transfer-'));
  const backup = join(directory, 'backup.z2ma');
  const debug = new Diagnostics(); debug.control('start');
  const vault = {read: async () => null, status: async () => 'none', protectedAvailable: async () => false, clearSession() {}};
  const projects = new ProjectService(vault, {}, debug);
  await projects.command({action: 'new'});
  const broker = {id: randomUUID(), name: 'Synthetic', host: '127.0.0.1', port: peer.port, tls: false};
  const id = randomUUID();
  await projects.command({action: 'broker', broker});
  await projects.command({action: 'system', system: {id, name: 'Synthetic', brokerId: broker.id, baseTopic: 'synthetic'}});
  projects.replaceDraft(id, draft);
  const reader = new MqttReader(vault, debug, async (project, epoch, system, stored, current) => {
    await options.beforeObservation?.();
    if (current()) projects.observe(project, epoch, system, stored);
  }, undefined, 500);
  t.after(async () => { reader.close(); await peer.close(); await rm(directory, {recursive: true, force: true}); });
  reader.reconcile(projects.data(), projects.generation());
  await reader.connectBroker(broker.id);
  for (let attempt = 0; !reader.connected(broker.id) && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
  if (!options.absent) await reader.refresh(id);
  const dialogs = {confirm: async () => true, backup: async () => backup};
  const transfers = new ExtensionTransfer(projects, reader, dialogs);
  const command = action => projects.serialize(() => transfers.command(action, id));
  const count = suffix => peer.publications.filter(packet => packet.topic.endsWith(suffix)).length;
  const system = () => projects.data().systems[0];
  return {command, count, system, fixture, draft, backup, dialogs, reader, id, projects, peer, debug, loseAck: () => { loseAck = true; }};
}

test('D5 validates the exact disabled bytes, backs up the prior state and confirms storage independently', async t => {
  const s = await setup(t);
  assert.equal(await s.command('validate'), 'transferValidated');
  assert.equal(s.count('/request/store'), 0);
  assert.equal(await s.command('store'), 'transferStored');
  assert.equal(s.count('/request/store'), 1);
  assert.equal(s.system().stored.revision, 4);
  assert.equal(s.system().stored.configuration.automations[0].enabled, false);
  assert.deepEqual(s.system().configuration, s.draft);
  assert.equal(JSON.parse(await readFile(s.backup, 'utf8')).systems[0].stored.revision, 3);
  assert.ok(s.peer.publications.every(packet => !packet.retain && packet.qos === 0));
  assert.ok(s.debug.read().events.some(event => event.operation === 'store' && event.transaction));
});

test('D5 cancellation consumes validation and a newer remote revision is backed up without being overwritten', async t => {
  const s = await setup(t);
  await s.command('validate');
  s.dialogs.confirm = async () => false;
  assert.equal(await s.command('store'), 'transferCanceled');
  await assert.rejects(s.command('store'), /transferValidateFirst/);
  await s.command('validate');
  const config = {...s.fixture.editor.configuration, revision: 4};
  const yaml = JSON.stringify(config);
  Object.assign(s.fixture.status, {stored_revision: 4, checksum: hash(yaml)});
  Object.assign(s.fixture.editor, s.fixture.status, {configuration: config, yaml});
  await s.reader.refresh(s.id);
  await assert.rejects(s.command('store'), /transferConflict/);
  assert.equal(s.system().baseline.revision, 3);
  assert.equal(JSON.parse(await readFile(s.backup, 'utf8')).systems[0].stored.revision, 4);
  assert.equal(s.count('/request/store'), 0);
});

test('D5 lost store acknowledgement is reconciled by reading and never resending the write', async t => {
  const s = await setup(t);
  await s.command('validate');
  s.loseAck();
  await assert.rejects(s.command('store'), /transferUncertain/);
  assert.equal(await s.command('checkTransfer'), 'transferStored');
  await assert.rejects(s.command('store'), /transferValidateFirst/);
  assert.equal(s.count('/request/store'), 1);
  assert.equal(s.system().baseline.revision, 4);
});

test('D5 installs the pinned artifact on a synthetic empty bridge and confirms its build without activating', async t => {
  const s = await setup(t, {absent: true});
  assert.equal(await s.command('install'), 'transferInstalled');
  assert.equal(s.count('/bridge/request/extension/save'), 1);
  assert.equal(s.system().stored.revision, 0);
  assert.equal(await s.command('install'), 'transferInstalled');
  assert.equal(s.count('/bridge/request/extension/save'), 1);
  assert.equal(s.count('/request/activate'), 0);
});

test('D5 rechecks the receiver after confirmation and refuses a store after a session change', async t => {
  const s = await setup(t);
  await s.command('validate');
  s.dialogs.confirm = async () => {
    s.fixture.status.session = s.fixture.editor.session = randomUUID();
    return true;
  };
  await assert.rejects(s.command('store'), /transferChanged/);
  assert.equal(s.count('/request/store'), 0);
});

test('D5 reads back an upgrade after a lost reply and preserves the previous stored rules', async t => {
  const s = await setup(t, {loseInstallAck: true});
  const original = s.system().stored;
  await assert.rejects(s.command('install'), /transferUncertain/);
  assert.equal(await s.command('checkTransfer'), 'transferInstalled');
  assert.equal(s.count('/bridge/request/extension/save'), 1);
  assert.deepEqual(s.system().stored, original);
  assert.deepEqual(JSON.parse(await readFile(s.backup, 'utf8')).systems[0].stored, original);
});

test('D5 discards a queued pre-write observation after storage has been confirmed', async t => {
  let hold = false;
  let release;
  let entered;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const s = await setup(t, {beforeObservation: async () => {
    if (hold) { entered(); await gate; }
  }});
  await s.command('validate');
  hold = true;
  const oldRead = s.reader.refresh(s.id);
  await started;
  try {
    assert.equal(await s.command('store'), 'transferStored');
  } finally {
    hold = false;
    release();
  }
  await assert.rejects(oldRead, /stale/);
  assert.equal(s.system().stored.revision, 4);
  await s.reader.refresh(s.id);
  assert.equal(s.reader.current(s.id).status.revision, 4);
});
