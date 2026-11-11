import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {mkdtemp, readFile, readdir, writeFile, mkdir, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {connect} from 'mqtt';
import {startPeer, remoteFixture} from './support/mqtt-peer.mjs';
const require = createRequire(import.meta.url);
const {MqttReader, mqttOptions, parseTLS} = require('../apps/desktop/.build/mqtt-reader.js');
const {AutomaticConnections} = require('../apps/desktop/.build/auto-connect.js');
const {editorData} = require('../apps/desktop/.build/mqtt-protocol.js');
const {newProject, emptyConfiguration, projectBytes, parseProject} = require('../apps/desktop/.build/project.js');
const {ProjectService} = require('../apps/desktop/.build/project-service.js');
const {Diagnostics} = require('../apps/desktop/.build/diagnostics.js');
const {validPayload} = require('../apps/desktop/.build/security.js');
async function waitFor(predicate, message = 'Expected MQTT state', limit = 6000) {
  const deadline = Date.now() + limit;
  while (Date.now() < deadline) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  assert.fail(message);
}
function projectFor(peers, count = peers.length) {
  const project = newProject('Synthetic MQTT project');
  project.brokers = peers.map((peer, index) => ({id: randomUUID(), name: 'Synthetic broker ' + index, host: '127.0.0.1', port: peer.port, tls: false}));
  project.systems = Array.from({length: count}, (_, index) => ({id: randomUUID(), name: 'Synthetic system ' + index,
    brokerId: project.brokers[index % peers.length].id, baseTopic: peers.length === count ? 'synthetic' : 'synthetic' + index,
    baseline: null, configuration: emptyConfiguration()}));
  return project;
}
function readerFor(t, project, {timeout = 500, secret = null, observe} = {}) {
  const stored = new Map(); const debug = new Diagnostics(); debug.control('start');
  const reader = new MqttReader({read: async () => secret}, debug, async (projectId, epoch, id, value, current) => {
    assert.equal(projectId, project.id); assert.equal(epoch, 1); assert.equal(current(), true);
    if (observe) await observe(value, current);
    stored.set(id, value);
  }, undefined, timeout);
  reader.reconcile(project, 1); t.after(() => reader.close());
  return {reader, stored, debug};
}
async function automaticFor(t, project, reader, debug = new Diagnostics()) {
  const directory = await mkdtemp(join(tmpdir(), 'z2ma-connections-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const automatic = new AutomaticConnections(directory, reader, debug);
  await automatic.reconcile(project, 1);
  return {automatic, directory};
}
test('automatic connections are local opt-ins, survive a new service and read eight systems through one broker', async t => {
  const peer = await startPeer({systems: new Map(Array.from({length: 8}, (_, i) => ['synthetic' + i, remoteFixture('Remote ' + i)]))});
  t.after(() => peer.close()); const project = projectFor([peer], 8); const before = structuredClone(project);
  const {reader, debug} = readerFor(t, project, {secret: {username: 'SYNTHETIC_USER', password: 'SYNTHETIC_SECRET'}});
  const {automatic, directory} = await automaticFor(t, project, reader, debug);
  const id = project.brokers[0].id;
  await assert.rejects(automatic.connect(randomUUID()), /noProject/);
  await automatic.opened(1); assert.equal(peer.clients.length, 0);
  await automatic.set(id, 'credentials'); assert.equal(peer.clients.length, 0, 'changing a preference does not initiate a connection');
  const reopened = new AutomaticConnections(directory, reader, debug);
  await reopened.reconcile(project, 1);
  assert.equal(reopened.setting(id).mode, 'credentials');
  await Promise.all([reopened.opened(1), reopened.connect(id)]);
  await waitFor(() => reader.state().systems.every(system => system.fresh));
  assert.equal(peer.clients.length, 1); assert.equal(peer.clients[0].username, 'SYNTHETIC_USER');
  assert.deepEqual(project, before);
  assert.ok(peer.publications.every(message => /\/request\/(status|editor)$/.test(message.topic) && !message.retain));
  const files = await readdir(directory); assert.equal(files.length, 1);
  assert.deepEqual(JSON.parse(await readFile(join(directory, files[0]), 'utf8')), {version: 1, mode: 'credentials'});
  assert.equal(JSON.stringify(debug.read()).includes('SYNTHETIC_SECRET'), false);
  reader.disconnect(id); await reopened.opened(1);
  assert.equal(reader.connected(id), false, 'an explicit disconnect lasts until the next project open');
  await reopened.set(id, 'off');
  const disabled = new AutomaticConnections(directory, reader, debug); await disabled.reconcile(project, 2); await disabled.opened(2);
  assert.equal(disabled.setting(id).mode, 'off'); assert.equal(peer.clients.length, 1);
});
test('missing and locked credentials report individual issues while other brokers connect; anonymous mode skips the vault', async t => {
  const peers = await Promise.all([startPeer(), startPeer(), startPeer()]);
  t.after(() => Promise.all(peers.map(peer => peer.close())));
  const project = projectFor(peers); const reads = [];
  const reader = new MqttReader({read: async (_project, broker) => {
    reads.push(broker.id);
    if (broker.id === project.brokers[0].id) return null;
    if (broker.id === project.brokers[1].id) throw new Error('protectionUnavailable');
    return {username: 'SYNTHETIC_USER', password: 'SYNTHETIC_SECRET'};
  }}, new Diagnostics(), async () => {});
  t.after(() => reader.close()); reader.reconcile(project, 1);
  const {automatic} = await automaticFor(t, project, reader);
  for (const broker of project.brokers) await automatic.set(broker.id, 'credentials');
  await automatic.opened(1); await waitFor(() => reader.state().systems[2].fresh);
  assert.equal(automatic.setting(project.brokers[0].id).issue, 'credentialsMissing');
  assert.equal(automatic.setting(project.brokers[1].id).issue, 'credentialsLocked');
  assert.deepEqual(peers.map(peer => peer.clients.length), [0, 0, 1]);
  await automatic.set(project.brokers[0].id, 'anonymous'); await automatic.set(project.brokers[2].id, 'off');
  reader.reconcile(project, 2); await automatic.reconcile(project, 2); await automatic.opened(2);
  await waitFor(() => reader.state().systems[0].fresh);
  assert.equal(peers[0].clients[0].username, undefined);
  assert.equal(reads.filter(id => id === project.brokers[0].id).length, 1, 'anonymous mode does not read saved secrets');
  assert.equal(peers[2].clients.length, 1, 'an off preference is respected at the next open');
});
test('automatic opt-ins are bound to project identity and the broker endpoint and damaged settings cannot initiate a connection', async t => {
  const peer = await startPeer(); t.after(() => peer.close()); const project = projectFor([peer]); const {reader} = readerFor(t, project);
  const {automatic, directory} = await automaticFor(t, project, reader);
  await automatic.set(project.brokers[0].id, 'anonymous');
  let epoch = 1;
  for (const change of [value => value.id = randomUUID(), value => value.brokers[0].id = randomUUID(), value => value.brokers[0].host = 'localhost',
    value => value.brokers[0].port++, value => value.brokers[0].tls = true]) {
    const changed = structuredClone(project); change(changed);
    reader.reconcile(changed, ++epoch); await automatic.reconcile(changed, epoch); await automatic.opened(epoch);
    assert.equal(automatic.setting(changed.brokers[0].id).mode, 'off');
  }
  assert.equal(peer.clients.length, 0);
  const file = join(directory, (await readdir(directory))[0]);
  for (const bytes of ['{invalid JSON', '{"version":1,"mode":["anonymous"]}', '{"version":1,"mode":"always"}', '{"version":2,"mode":"anonymous"}']) {
    await writeFile(file, bytes);
    reader.reconcile(project, ++epoch); await automatic.reconcile(project, epoch); await automatic.opened(epoch);
    assert.deepEqual(automatic.setting(project.brokers[0].id), {mode: 'off', issue: 'settingsUnavailable'});
    assert.equal(peer.clients.length, 0);
  }
  await automatic.set(project.brokers[0].id, 'credentials');
  await rm(file); await mkdir(file);
  await assert.rejects(automatic.set(project.brokers[0].id, 'anonymous'), /autoConnectSettings/);
  assert.equal(automatic.setting(project.brokers[0].id).mode, 'credentials', 'a failed write preserves the applied preference');
});
test('opening another project while credentials are being read cancels the old automatic attempt', async t => {
  const peer = await startPeer(); t.after(() => peer.close()); const project = projectFor([peer]);
  let release; let started;
  const reading = new Promise(resolve => { started = resolve; });
  const reader = new MqttReader({read: async () => { started(); return new Promise(resolve => { release = resolve; }); }}, new Diagnostics(), async () => {});
  t.after(() => reader.close()); reader.reconcile(project, 1);
  const {automatic} = await automaticFor(t, project, reader); await automatic.set(project.brokers[0].id, 'credentials');
  const opening = automatic.opened(1); await reading;
  const next = {...structuredClone(project), id: randomUUID()};
  reader.reconcile(next, 2); await automatic.reconcile(next, 2);
  release({username: 'SYNTHETIC_USER', password: 'SYNTHETIC_SECRET'}); await opening;
  assert.equal(peer.clients.length, 0);
  assert.deepEqual(automatic.setting(next.brokers[0].id), {mode: 'off', issue: ''});
});
test('real MQTT.js shares one broker for eight isolated systems and emits only non-retained read requests', async t => {
  const fixtures = new Map(Array.from({length: 8}, (_, index) => ['synthetic' + index, remoteFixture('Remote ' + index)]));
  const peer = await startPeer({systems: fixtures}); t.after(() => peer.close());
  const project = projectFor([peer], 8); const before = structuredClone(project);
  const {reader, stored, debug} = readerFor(t, project, {timeout: 1500, secret: {username: 'SYNTHETIC_USER', password: 'SYNTHETIC_SECRET'}});
  assert.equal(peer.clients.length, 0, 'opening a project must not connect');
  await reader.connectBroker(project.brokers[0].id);
  await waitFor(() => reader.state().systems.every(system => system.fresh), JSON.stringify(reader.state()));
  assert.equal(peer.clients.length, 1);
  assert.match(peer.clients[0].clientId, /^z2ma-desktop-/);
  assert.equal(peer.clients[0].clean, true); assert.equal(peer.clients[0].username, 'SYNTHETIC_USER');
  assert.equal(stored.size, 8);
  for (const [index, system] of project.systems.entries()) {
    assert.equal(stored.get(system.id).configuration.automations[0].name, 'Remote ' + index);
    assert.equal(stored.get(system.id).yaml, fixtures.get(system.baseTopic).editor.yaml);
    assert.equal(reader.current(system.id).devices[0].properties[0].access, 1);
    assert.equal(reader.current(system.id).devices[2].properties.length, 0, 'groups do not inherit write rights');
    assert.equal(reader.current(system.id).scenes.length, 1);
  }
  assert.deepEqual(project, before, 'observing remote rules never mutates local draft input');
  assert.equal(peer.publications.length, 24);
  for (const value of peer.publications) {
    assert.match(value.topic, /\/symcon\/automations\/request\/(?:status|editor)$/); assert.equal(value.qos, 0); assert.equal(value.retain, false);
    assert.deepEqual(Object.keys(JSON.parse(value.payload)).sort(), ['protocol_version', 'transaction']);
  }
  assert.equal(peer.subscriptions.some(topic => topic.includes('#') || topic.includes('+')), false);
  assert.equal(JSON.stringify(debug.read()).includes('SYNTHETIC_SECRET'), false);
  assert.equal(JSON.stringify(debug.read()).includes('Remote 0'), false);
  assert.ok(debug.read().events.some(event => event.transaction), 'wire transactions are traceable without raw content');
});
test('separate brokers with identical base topics and device IDs cannot cross system ownership', async t => {
  const peers = [await startPeer({systems: new Map([['synthetic', remoteFixture('First broker')]])}), await startPeer({systems: new Map([['synthetic', remoteFixture('Second broker')]])})];
  t.after(() => Promise.all(peers.map(peer => peer.close())));
  const project = projectFor(peers); const {reader, stored} = readerFor(t, project);
  await Promise.all(project.brokers.map(broker => reader.connectBroker(broker.id)));
  await waitFor(() => reader.state().systems.every(system => system.fresh));
  assert.equal(stored.get(project.systems[0].id).configuration.automations[0].name, 'First broker');
  assert.equal(stored.get(project.systems[1].id).configuration.automations[0].name, 'Second broker');
});
test('retained and mismatched responses cannot confirm a read; timeout leaves drafts untouched', async t => {
  const peer = await startPeer({reply: ({response, publish}) => { publish({...response, transaction: randomUUID()}); publish(response, 'synthetic/symcon/automations/response/editor'); publish(response, undefined, true); }});
  t.after(() => peer.close()); const project = projectFor([peer]); const {reader, stored} = readerFor(t, project, {timeout: 120});
  await reader.connectBroker(project.brokers[0].id);
  await waitFor(() => reader.state().systems[0].error === 'timeout');
  assert.equal(stored.size, 0); assert.equal(project.systems[0].configuration.automations.length, 0);
});
test('session changes during the correlated status/editor/status handshake reject stale remote data', async t => {
  let statusReads = 0;
  const peer = await startPeer({reply: ({operation, response, publish}) => { if (operation === 'status' && ++statusReads > 1) response.data.session = randomUUID(); publish(); }});
  t.after(() => peer.close()); const project = projectFor([peer]); const {reader, stored} = readerFor(t, project);
  await reader.connectBroker(project.brokers[0].id); await waitFor(() => reader.state().systems[0].error === 'stale');
  assert.equal(stored.size, 0);
});
test('checksum and malformed catalog data are rejected before any project observation', async t => {
  const fixture = remoteFixture(); fixture.editor.yaml += '# changed';
  const peer = await startPeer({systems: new Map([['synthetic', fixture]])}); t.after(() => peer.close());
  const project = projectFor([peer]); const {reader, stored} = readerFor(t, project);
  await reader.connectBroker(project.brokers[0].id); await waitFor(() => reader.state().systems[0].error === 'protocol'); assert.equal(stored.size, 0);
  const invalid = remoteFixture().editor; invalid.devices[0].properties[0].access = 0;
  assert.equal(editorData(invalid).devices[0].properties.length, 0, 'unknown access cannot grant rights');
  const duplicate = remoteFixture().editor; duplicate.devices.push(duplicate.devices[0]); assert.throws(() => editorData(duplicate), /protocol/);
});
test('catalogs retain Unicode labels and identical scene IDs on separate endpoints without admitting foreign targets', () => {
  const fixture = remoteFixture().editor;
  fixture.devices[0].name = '🌡'.repeat(120);
  fixture.scenes.push({...structuredClone(fixture.scenes[0]), name: '', endpoint: 2});
  fixture.scenes.push({...structuredClone(fixture.scenes[0]), target: {...fixture.scenes[0].target, system: 'foreign-system'}});
  const parsed = editorData(fixture);
  assert.equal(parsed.devices[0].name, fixture.devices[0].name);
  assert.deepEqual(parsed.scenes.map(scene => scene.endpoint), [1, 2]);
  assert.equal(parsed.scenes[1].name, '');
});
test('legacy discrete capabilities and numerical units are read without inventing switch rights', () => {
  const fixture = remoteFixture().editor; const sensor = fixture.devices[0]; delete sensor.properties;
  sensor.triggers = [{property: 'action', value: 'single'}]; sensor.actions = [];
  sensor.numeric = [{property: 'temperature', unit: '°C'}];
  const parsed = editorData(fixture);
  assert.equal(parsed.devices[0].properties.find(property => property.id === 'action').access, 1);
  assert.equal(parsed.devices[0].properties.find(property => property.id === 'temperature').unit, '°C');
});
test('a missing subscription acknowledgement has a bounded timeout and sends no read request', async t => {
  const peer = await startPeer({acknowledge: false}); t.after(() => peer.close()); const project = projectFor([peer]); const {reader} = readerFor(t, project, {timeout: 120});
  await reader.connectBroker(project.brokers[0].id); await waitFor(() => reader.state().brokers[0].error === 'timeout');
  assert.equal(peer.publications.length, 0);
});
test('a response arriving after timeout cannot satisfy a later explicit refresh', async t => {
  let late; let first = true;
  const peer = await startPeer({reply: ({publish}) => { if (first) { first = false; late = publish; } else { late(); publish(); } }});
  t.after(() => peer.close()); const project = projectFor([peer]); const {reader, stored} = readerFor(t, project, {timeout: 120});
  await reader.connectBroker(project.brokers[0].id); await waitFor(() => reader.state().systems[0].error === 'timeout');
  await reader.refresh(project.systems[0].id);
  assert.equal(reader.state().systems[0].fresh, true); assert.equal(stored.size, 1);
  assert.equal(peer.publications.length, 4);
});
test('disconnect/reconnect performs new read transactions and never replays a queued request or loses a local draft', async t => {
  const fixture = remoteFixture(); const peer = await startPeer({systems: new Map([['synthetic', fixture]])}); t.after(() => peer.close());
  const project = projectFor([peer]); project.systems[0].configuration.automations.push({id: 'local', name: 'Unsaved local draft', enabled: false, triggers: [], conditions: [], actions: []});
  const {reader} = readerFor(t, project);
  await reader.connectBroker(project.brokers[0].id); await waitFor(() => reader.state().systems[0].fresh);
  const oldTransactions = peer.publications.map(value => JSON.parse(value.payload).transaction);
  fixture.status.session = randomUUID(); fixture.editor.session = fixture.status.session;
  peer.drop(); await waitFor(() => !reader.state().systems[0].fresh);
  await waitFor(() => peer.clients.length === 2 && reader.state().systems[0].fresh, 'Reconnect did not obtain fresh state');
  assert.equal(project.systems[0].configuration.automations[0].name, 'Unsaved local draft');
  assert.equal(peer.publications.slice(3).some(value => oldTransactions.includes(JSON.parse(value.payload).transaction)), false);
  reader.disconnect(project.brokers[0].id);
  const changed = structuredClone(project); changed.systems[0].baseTopic = 'different'; reader.reconcile(changed, 1);
  assert.equal(reader.current(project.systems[0].id), null, 'a changed disconnected binding must discard old remote cache');
});
test('broker denial and locked credentials fail without control requests or anonymous fallback', async t => {
  const peer = await startPeer({deny: true}); t.after(() => peer.close()); const project = projectFor([peer]); const {reader} = readerFor(t, project);
  await reader.connectBroker(project.brokers[0].id); await waitFor(() => reader.state().brokers[0].error === 'permission'); assert.equal(peer.publications.length, 0);
  reader.close();
  const locked = new MqttReader({read: async () => { throw new Error('protectionUnavailable'); }}, new Diagnostics(), async () => {});
  locked.reconcile(project, 1); t.after(() => locked.close());
  await assert.rejects(locked.connectBroker(project.brokers[0].id), /protectionUnavailable/); assert.equal(peer.clients.length, 1);
});
test('network IPC exposes fixed transfer actions without raw MQTT, TLS or file operations', () => {
  for (const mode of ['off', 'credentials', 'anonymous']) assert.equal(validPayload('network', {action: 'autoConnect', id: randomUUID(), mode}), true);
  for (const extra of [{}, {mode: 'always'}, {mode: ['anonymous']}, {mode: 'credentials', password: 'PRIVATE'}, {mode: 'anonymous', host: 'private.invalid'}]) {
    assert.equal(validPayload('network', {action: 'autoConnect', id: randomUUID(), ...extra}), false);
  }
  for (const action of ['validate', 'store', 'install']) {
    assert.equal(validPayload('network', {action, id: randomUUID()}), true);
    assert.equal(validPayload('network', {action, id: randomUUID(), yaml: 'private'}), false);
  }
  for (const action of ['publish', 'activate', 'run_once', 'set']) assert.equal(validPayload('network', {action, id: randomUUID()}), false);
  assert.equal(validPayload('network', {action: 'connect', id: randomUUID(), host: 'private.invalid', rejectUnauthorized: false}), false);
  const options = mqttOptions({id: randomUUID(), name: 'Synthetic', host: 'broker.invalid', port: 8883, tls: true}, null, {});
  assert.equal(options.rejectUnauthorized, true); assert.equal(options.queueQoSZero, false); assert.equal(options.resubscribe, false); assert.equal(options.clean, true);
  assert.equal(options.will, undefined); assert.throws(() => parseTLS(Buffer.from('{"rejectUnauthorized":false}')), /invalidTLS/);
});
test('native TLS rejects an untrusted certificate and accepts an explicit synthetic CA with hostname checks intact', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'z2ma-tls-test-')); t.after(() => rm(dir, {recursive: true, force: true}));
  const gitOpenSSL = 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe';
  const executable = process.platform === 'win32' && existsSync(gitOpenSSL) ? gitOpenSSL : 'openssl';
  const generated = spawnSync(executable, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem'), '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], {windowsHide: true, encoding: 'utf8'});
  assert.equal(generated.status, 0, 'OpenSSL must generate a synthetic one-day test certificate');
  const key = await readFile(join(dir, 'key.pem')); const cert = await readFile(join(dir, 'cert.pem'));
  const peer = await startPeer({secure: {key, cert}}); t.after(() => peer.close()); const project = projectFor([peer]); project.brokers[0].tls = true;
  const {reader, stored} = readerFor(t, project, {timeout: 1500});
  await reader.connectBroker(project.brokers[0].id); await waitFor(() => reader.state().brokers[0].error === 'tlsError'); assert.equal(stored.size, 0);
  reader.setTLS(project.brokers[0].id, parseTLS(Buffer.from(JSON.stringify({ca: cert.toString()}))));
  await reader.connectBroker(project.brokers[0].id); await waitFor(() => reader.state().systems[0].fresh); assert.equal(stored.size, 1);
  assert.equal(JSON.stringify(reader.state()).includes('BEGIN CERTIFICATE'), false);
  assert.equal(projectBytes(project).includes('PRIVATE KEY'), false);
  const wrongName = new MqttReader({read: async () => null}, new Diagnostics(), async () => {}, options => connect({...options, servername: 'wrong.invalid'}), 1500);
  t.after(() => wrongName.close()); wrongName.reconcile(project, 1);
  wrongName.setTLS(project.brokers[0].id, {ca: cert.toString()}); await wrongName.connectBroker(project.brokers[0].id);
  await waitFor(() => wrongName.state().brokers[0].error === 'tlsError', 'A trusted CA must not bypass hostname verification');
  const mutual = await startPeer({secure: {key, cert, ca: cert, requestCert: true, rejectUnauthorized: true}}); t.after(() => mutual.close());
  const mutualProject = projectFor([mutual]); mutualProject.brokers[0].tls = true;
  const {reader: mutualReader} = readerFor(t, mutualProject, {timeout: 1500});
  mutualReader.setTLS(mutualProject.brokers[0].id, {ca: cert.toString(), cert: cert.toString(), key: key.toString()});
  await mutualReader.connectBroker(mutualProject.brokers[0].id); await waitFor(() => mutualReader.state().systems[0].fresh, 'Mutual TLS did not read state');
});
test('late observations cannot restore a cache after a binding change', async t => {
  const peer = await startPeer(); t.after(() => peer.close()); const project = projectFor([peer]);
  let reached; const entered = new Promise(resolve => { reached = resolve; }); let release; const gate = new Promise(resolve => { release = resolve; });
  const {reader, stored} = readerFor(t, project, {observe: async (_value, current) => { reached(); await gate; if (!current()) throw new Error('stale'); }});
  await reader.connectBroker(project.brokers[0].id); await entered;
  const changed = structuredClone(project); changed.systems[0].baseTopic = 'changed'; reader.reconcile(changed, 1); release();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(stored.size, 0); assert.equal(reader.current(project.systems[0].id), null);
  assert.equal(reader.connected(project.brokers[0].id), false);
});
test('an authentication rejection is terminal and never publishes a read request', async t => {
  const peer = await startPeer({auth: true}); t.after(() => peer.close()); const project = projectFor([peer]); const {reader} = readerFor(t, project);
  await reader.connectBroker(project.brokers[0].id);
  await waitFor(() => reader.state().brokers[0].error === 'authentication'); assert.equal(peer.publications.length, 0);
});
test('observed Z2M source is preserved separately in portable projects without overwriting drafts', async () => {
  const fixture = remoteFixture(); const project = newProject('Synthetic');
  const service = new ProjectService({status: async () => 'none', protectedAvailable: async () => false, clearSession() {}}, {
    chooseOpen: async () => null, chooseSave: async () => null, chooseCredentials: async () => null, confirmDiscard: async () => true, confirmRestore: async () => true, confirmDelete: async () => true
  }, new Diagnostics());
  await service.command({action: 'new'});
  const broker = {id: randomUUID(), name: 'Synthetic broker', host: 'broker.invalid', port: 1883, tls: false};
  await service.command({action: 'broker', broker}); const id = randomUUID();
  await service.command({action: 'system', system: {id, name: 'Synthetic system', brokerId: broker.id, baseTopic: 'synthetic'}});
  const local = service.data().systems[0].configuration;
  const remote = editorData(fixture.editor);
  service.observe(service.data().id, service.generation(), id, {revision: remote.status.revision, checksum: remote.status.checksum, configuration: remote.configuration, yaml: remote.yaml});
  const roundtrip = parseProject(projectBytes(service.data()));
  assert.equal(roundtrip.systems[0].stored.yaml, fixture.editor.yaml); assert.deepEqual(roundtrip.systems[0].configuration, local);
  assert.equal(JSON.stringify(roundtrip).includes(fixture.status.session), false);
  assert.throws(() => service.observe(project.id, service.generation(), id, {}), /stale/);
});
