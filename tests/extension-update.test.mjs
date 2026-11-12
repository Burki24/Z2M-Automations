import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID, createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import LegacyExtension from './fixtures/extension-0.2.0/z2m-automations.mjs';
import Extension from '../apps/desktop/extension/z2m-automations.mjs';
import {remoteFixture, startPeer} from './support/mqtt-peer.mjs';

const require = createRequire(import.meta.url);
const {MqttReader} = require('../apps/desktop/.build/mqtt-reader.js');
const {ProjectService} = require('../apps/desktop/.build/project-service.js');
const {RuntimeControl} = require('../apps/desktop/.build/runtime-control.js');
const {ExtensionTransfer, bundledExtension} = require('../apps/desktop/.build/extension-transfer.js');
const {Diagnostics} = require('../apps/desktop/.build/diagnostics.js');
const sha = value => createHash('sha256').update(value).digest('hex');

async function setup(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'z2ma-update-'));
  const base = 'synthetic/update';
  const fixture = remoteFixture();
  const configuration = {...fixture.editor.configuration, revision: 1};
  const devices = fixture.editor.devices.map(({id, name}, index) => ({ID: id, ieeeAddr: id, name, isDevice: () => true,
    exposes: () => [{type: 'binary', property: index ? 'state' : 'occupancy', access: index ? 7 : 1,
      value_on: index ? 'ON' : true, value_off: index ? 'OFF' : false}]}));
  const effects = [], failures = [];
  let receive, send, extension, installedClass = LegacyExtension, restarted = false, droppedEditor = false;
  const load = async Class => {
    extension = new Class({devicesIterator: () => devices.values(), groupsIterator: () => [].values(),
      resolveEntity: id => devices.find(device => device.ID === id)}, {publish: async (topic, bytes) => {
      if (!topic.endsWith('/response/' + options.suppress)
        && !(options.loseRestoreAck && extension instanceof Extension && topic.endsWith('/response/activate'))) send?.(JSON.parse(bytes), base + '/' + topic);
    }}, {get: () => ({})}, null, {
      onMQTTMessage: (_owner, handler) => { receive = handler; }, onPublishEntityState() {},
      emitMQTTMessage: effect => effects.push(effect), removeListeners() {}
    }, null, null, null, {get: () => ({mqtt: {base_topic: base}})}, {}, {directory});
    await extension.start();
  };
  await load(LegacyExtension);
  await receive({topic: base + '/symcon/automations/request/store', message: JSON.stringify({protocol_version: 1,
    transaction: randomUUID(), session: extension.session, expected_revision: 0, yaml: JSON.stringify(configuration)})});
  assert.equal(extension.status().stored_revision, 1);
  const tasks = new Set();
  const peer = await startPeer({systems: new Map([[base, fixture]]),
    bridge: {state: {state: 'online'}, extensions: [{name: 'z2m-automations.mjs'}]}, reply(context) {
      const task = (async () => {
        const {operation, request, publish} = context;
        send = publish;
        if (operation === 'install') {
          assert.equal(sha(request.code), '56878a00be9671c8f470f3f3c8ad3be014d8f9a08a4ad807e4f0ec42f548867f');
          if (options.rejectInstall) { publish({...context.response, status: 'error'}); return; }
          installedClass = options.oldBuild ? LegacyExtension : Extension;
          if (!options.loadOnRestart) { await extension.stop(); await load(installedClass); }
          if (!options.loseInstallAck) publish();
        } else if (operation === 'restart') {
          if (!options.loseRestartAck) publish();
          if (options.noRestart) return;
          publish({state: 'offline'}, base + '/bridge/state', options.retainedRestart === true);
          if (options.changeStorage) await receive({topic: base + '/symcon/automations/request/store', message: JSON.stringify({protocol_version: 1,
            transaction: randomUUID(), session: extension.session, expected_revision: 1, yaml: JSON.stringify({...configuration, revision: 2})})});
          await extension.stop();
          await load(installedClass);
          restarted = true;
          publish({state: 'online'}, base + '/bridge/state', options.retainedRestart === true);
        } else if (options.losePostRestartEditor && restarted && !droppedEditor && operation === 'editor') droppedEditor = true;
        else if (options.rejectStop && operation === 'deactivate') publish({...context.response, status: 'error'});
        else await receive({topic: base + '/symcon/automations/request/' + operation, message: JSON.stringify(request)});
      })();
      tasks.add(task);
      void task.catch(error => failures.push(error)).finally(() => tasks.delete(task));
    }});
  const debug = new Diagnostics(); debug.control('start');
  const vault = {read: async () => null, status: async () => 'none', protectedAvailable: async () => false, clearSession() {}};
  const projects = new ProjectService(vault, {confirmDiscard: async () => true}, debug);
  await projects.command({action: 'new'});
  const broker = {id: randomUUID(), name: 'Synthetic', host: '127.0.0.1', port: peer.port, tls: false};
  await projects.command({action: 'broker', broker});
  const id = randomUUID();
  await projects.command({action: 'system', system: {id, name: 'Synthetic', brokerId: broker.id, baseTopic: base}});
  const reader = new MqttReader(vault, debug, async (project, epoch, system, stored, current) => {
    if (current()) projects.observe(project, epoch, system, stored);
  }, undefined, 100);
  t.after(async () => {
    reader.close(); await Promise.allSettled([...tasks]); await extension.stop(); await peer.close();
    await rm(directory, {recursive: true, force: true});
    assert.deepEqual(failures, []);
  });
  reader.reconcile(projects.data(), projects.generation());
  await reader.connectBroker(broker.id);
  for (let attempt = 0; !reader.connected(broker.id) && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
  await reader.refresh(id);
  const dialogs = {confirm: async () => true, backup: async () => join(directory, 'backup.z2ma')};
  const transfer = new ExtensionTransfer(projects, reader, dialogs, {timeout: 400, poll: 10});
  const runtime = new RuntimeControl(projects, reader, async () => true);
  return {id, reader, projects, peer, debug, dialogs, effects, directory, transfer,
    get extension() { return extension; },
    runtime: (action, fields = {}) => runtime.command(action, {action, id, ...fields}),
    update: () => transfer.command('install', id), check: () => transfer.command('checkTransfer', id),
    count: operation => peer.publications.filter(packet => packet.topic.endsWith('/request/' + operation)).length};
}

test('legacy update fixture retains the verified canonical artifact bytes', async () => {
  const bytes = await readFile(new URL('./fixtures/extension-0.2.0/z2m-automations.mjs', import.meta.url));
  assert.equal(sha(bytes), 'aef090e0fab41c50b7f5360d03c9c077ef559a7e192a18d26ad397e3ceda8ecd');
});

for (const resume of [true, false]) test('one update stops 0.2.0, installs, restarts Z2M and restores operation (resume=' + resume + ')', async t => {
  const s = await setup(t);
  await s.runtime('activate', {resume});
  const original = structuredClone(s.projects.data().systems[0].stored);
  const session = s.extension.session;
  assert.equal(await s.update(), 'transferInstalled');
  assert.equal(s.transfer.updatePending(s.id), false);
  assert.equal(s.extension.status().extension_build, bundledExtension.build);
  assert.notEqual(s.extension.session, session);
  assert.equal(s.extension.status().executing, true);
  assert.equal(s.extension.status().resume_enabled, resume);
  assert.deepEqual(s.projects.data().systems[0].stored, original);
  assert.deepEqual(JSON.parse(await readFile(join(s.directory, 'backup.z2ma'), 'utf8')).systems[0].stored, original);
  assert.equal(s.count('deactivate'), 1);
  assert.equal(s.count('extension/save'), 1);
  assert.equal(s.count('restart'), 1);
  assert.equal(s.count('activate'), 2);
  assert.equal(s.count('store'), 0);
  assert.deepEqual(s.effects, []);
  assert.ok(s.peer.publications.every(packet => packet.retain === false));
  const phases = s.debug.read().events.filter(event => event.code === 'extensionUpdate').map(event => event.phase);
  assert.deepEqual(phases, ['stopping', 'installing', 'restarting', 'waiting', 'verifying', 'restoring', 'complete']);
  const commands = s.peer.publications.map(packet => packet.topic.split('/request/')[1]).filter(value => ['deactivate', 'extension/save', 'restart', 'activate'].includes(value));
  assert.deepEqual(commands, ['activate', 'deactivate', 'extension/save', 'restart', 'activate']);
});

test('a stopped runtime remains stopped even with its saved restart preference', async t => {
  const s = await setup(t);
  await s.runtime('activate', {resume: true}); await s.runtime('deactivate');
  assert.equal(await s.update(), 'transferInstalled');
  assert.equal(s.extension.status().executing, false);
  assert.equal(s.extension.status().resume_status, 'stopped');
  assert.equal(s.extension.status().resume_enabled, true);
  assert.equal(s.count('activate'), 1);
  assert.equal(s.count('deactivate'), 1);
});

test('the saved extension may load only on the requested Z2M restart', async t => {
  const s = await setup(t, {loadOnRestart: true});
  await s.runtime('activate', {resume: true});
  assert.equal(await s.update(), 'transferInstalled');
  assert.equal(s.extension.status().extension_build, bundledExtension.build);
  assert.equal(s.extension.status().executing, true);
});

for (const options of [{suppress: 'deactivate'}, {loseInstallAck: true}, {loseRestartAck: true}, {loseRestoreAck: true}]) {
  test('missing acknowledgement is reconciled without replay: ' + JSON.stringify(options), async t => {
    const s = await setup(t, options);
    await s.runtime('activate', {resume: true});
    assert.equal(await s.update(), 'transferInstalled');
    assert.equal(s.extension.status().executing, true);
    assert.equal(s.count('deactivate'), 1);
    assert.equal(s.count('extension/save'), 1);
    assert.equal(s.count('restart'), 1);
    assert.equal(s.count('activate'), 2);
  });
}

for (const cancel of ['confirmation', 'backup']) test('canceling ' + cancel + ' causes no stop, upload or restart', async t => {
  const s = await setup(t);
  await s.runtime('activate', {resume: true});
  if (cancel === 'confirmation') s.dialogs.confirm = async () => false;
  else s.dialogs.backup = async () => null;
  assert.equal(await s.update(), 'transferCanceled');
  assert.equal(s.count('deactivate'), 0);
  assert.equal(s.count('extension/save'), 0);
  assert.equal(s.count('restart'), 0);
  assert.equal(s.extension.status().executing, true);
});

test('a rejected stop blocks installation and repeated checks never resend the stop', async t => {
  const s = await setup(t, {rejectStop: true});
  await s.runtime('activate', {resume: true});
  await assert.rejects(s.update(), /extensionStopUncertain/);
  await assert.rejects(s.check(), /extensionStopUncertain/);
  await assert.rejects(s.update(), /extensionStopUncertain/);
  assert.equal(s.count('deactivate'), 1);
  assert.equal(s.count('extension/save'), 0);
  assert.equal(s.count('restart'), 0);
});

test('a rejected upload leaves operation stopped and is never blindly uploaded again', async t => {
  const s = await setup(t, {rejectInstall: true});
  await s.runtime('activate', {resume: true});
  await assert.rejects(s.update(), /extensionSaveUncertain/);
  await assert.rejects(s.check(), /extensionSaveUncertain/);
  await assert.rejects(s.update(), /extensionSaveUncertain/);
  assert.equal(s.count('extension/save'), 1);
  assert.equal(s.count('restart'), 0);
  assert.equal(s.extension.status().executing, false);
});

for (const options of [{noRestart: true}, {retainedRestart: true}, {oldBuild: true}, {changeStorage: true}]) {
  test('restart verification fails safely: ' + JSON.stringify(options), async t => {
    const s = await setup(t, options);
    await s.runtime('activate', {resume: true});
    await assert.rejects(s.update(), /extensionRestartUncertain/);
    assert.equal(s.transfer.updatePending(s.id), true);
    await assert.rejects(s.check(), /extensionRestartUncertain/);
    assert.equal(s.count('restart'), 1);
    assert.equal(s.count('extension/save'), 1);
    assert.equal(s.count('activate'), 1);
    assert.equal(s.extension.status().executing, false);
  });
}

test('a project replaced during confirmation cannot receive update commands', async t => {
  const s = await setup(t);
  s.dialogs.confirm = async () => { await s.projects.command({action: 'new'}); return true; };
  await assert.rejects(s.update(), /transferChanged/);
  assert.equal(s.count('deactivate'), 0);
  assert.equal(s.count('extension/save'), 0);
  assert.equal(s.count('restart'), 0);
});

test('an interrupted verification is read-only until confirmed continuation restores operation without repeating the update', async t => {
  const s = await setup(t, {losePostRestartEditor: true});
  await s.runtime('activate', {resume: true});
  await assert.rejects(s.update(), /extensionVerifyUncertain/);
  assert.equal(s.transfer.updatePending(s.id), true);
  await assert.rejects(s.check(), /extensionRestoreUncertain/);
  assert.equal(s.count('activate'), 1, 'A status check must not restore operation');
  assert.equal(await s.update(), 'transferInstalled');
  assert.equal(s.transfer.updatePending(s.id), false);
  assert.equal(s.count('deactivate'), 1);
  assert.equal(s.count('extension/save'), 1);
  assert.equal(s.count('restart'), 1);
  assert.equal(s.count('activate'), 2);
});
