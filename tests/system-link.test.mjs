import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {startPeer, remoteFixture} from './support/mqtt-peer.mjs';
const require = createRequire(import.meta.url);
const {systemLinkPlan, readSystemLink} = require('../apps/desktop/.build/system-link.js');
const {newProject, emptyConfiguration} = require('../apps/desktop/.build/project.js');
const {validPayload} = require('../apps/desktop/.build/security.js');
const {MqttReader} = require('../apps/desktop/.build/mqtt-reader.js');
const {Diagnostics} = require('../apps/desktop/.build/diagnostics.js');

function setup(shared = false) {
  const project = newProject('Synthetic project');
  project.brokers = ['a', 'b'].map(name => ({id: randomUUID(), name: 'Broker ' + name,
    host: 'broker-' + name + '.invalid', port: 1883, tls: false}));
  project.systems = project.brokers.map((broker, i) => ({id: randomUUID(), name: 'System ' + (i + 1),
    brokerId: shared ? project.brokers[0].id : broker.id, baseTopic: 'synthetic/' + (i + 1), baseline: null, configuration: emptyConfiguration()}));
  const [a, b] = project.systems;
  const remotes = new Map(); const connections = new Map(); const reads = [];
  const reader = {current: id => remotes.get(id) ?? null, connected: id => connections.get(id) === 'connected',
    state: () => ({brokers: project.brokers.map(b => ({id: b.id, state: connections.get(b.id) ?? 'disconnected', error: ''})),
      systems: project.systems.map(s => ({id: s.id, reading: false, error: ''}))}),
    refresh: async id => { reads.push(id); }};
  const observe = (system, peers, {fresh = true, executing = true, activeMatches = true, version = '0.2.2'} = {}) => {
    connections.set(system.brokerId, 'connected');
    remotes.set(system.id, {fresh, configuration: {...emptyConfiguration(), mesh_peers: peers},
      status: {executing, activeMatches, extensionVersion: version}});
  };
  return {project, a, b, reader, observe, connections, remotes, reads, plan: () => systemLinkPlan(project, reader, a.id, b.id)};
}

test('link plan is read-only, keeps external permissions unverified and needs no bridge on a shared broker', () => {
  const s = setup(true); s.a.configuration.mesh_peers = [s.b.baseTopic]; s.b.configuration.mesh_peers = [s.a.baseTopic];
  s.observe(s.a, [s.b.baseTopic]); s.observe(s.b, [s.a.baseTopic]);
  const before = structuredClone(s.project); const plan = s.plan();
  assert.equal(plan.topology, 'shared'); assert.equal(plan.suggestions.filter(item => item.kind === 'bridge').length, 0);
  assert.ok(plan.systems.flatMap(system => system.checks).every(check => check.state === 'ok'));
  assert.deepEqual(plan.external, {accounts: 'unknown', rights: 'unknown', bridge: 'unneeded', roundTrip: 'unknown'});
  assert.equal(plan.systems[0].broker.id, s.a.brokerId); assert.equal(plan.systems[1].broker.id, s.a.brokerId);
  assert.deepEqual(s.project, before); assert.deepEqual(s.reads, []);
});

test('separate brokers get one mesh-only bidirectional bridge and separate endpoint ACL additions', () => {
  const s = setup(); const plan = s.plan();
  assert.equal(plan.topology, 'separate');
  const bridges = plan.suggestions.filter(item => item.kind === 'bridge'); assert.equal(bridges.length, 1);
  const bridge = bridges[0].text;
  assert.match(bridge, /address broker-b\.invalid:1883/);
  assert.match(bridge, /^topic z2ma\/mesh\/# both 0$/m);
  assert.match(bridge, /^cleansession true$/m); assert.match(bridge, /^local_cleansession true$/m);
  assert.match(bridge, /^notifications false$/m);
  assert.match(bridge, /^local_username REPLACE_LOCAL_BRIDGE_USER$/m);
  assert.match(bridge, /^remote_username REPLACE_REMOTE_BRIDGE_USER$/m);
  assert.doesNotMatch(bridge, /^topic #|synthetic\/|broker-a|user.*z2m-desktop/m);
  assert.equal(plan.external.bridge, 'unknown');
  assert.equal(plan.suggestions.filter(item => item.kind === 'acl').length, 2);
  for (const item of plan.suggestions.filter(item => item.kind === 'acl')) {
    assert.match(item.text, /topic readwrite z2ma\/mesh\/#/);
    assert.match(item.text, /REPLACE_Z2M_USER/); assert.match(item.text, /REPLACE_BRIDGE_USER/);
    assert.doesNotMatch(item.text, /topic readwrite #/);
  }
});

test('cached state, missing declarations, old extensions and inactive revisions never become green', () => {
  const s = setup(); s.a.configuration.mesh_peers = [s.b.baseTopic];
  s.observe(s.a, [s.b.baseTopic], {fresh: false});
  s.observe(s.b, [], {version: '0.2.0', activeMatches: false});
  const plan = s.plan(); const [a, b] = plan.systems;
  assert.equal(a.checks.find(c => c.id === 'stored').state, 'unknown');
  assert.equal(a.checks.find(c => c.id === 'runtime').state, 'unknown');
  assert.equal(b.checks.find(c => c.id === 'local').state, 'missing');
  assert.equal(b.checks.find(c => c.id === 'extension').state, 'missing');
  assert.equal(b.checks.find(c => c.id === 'stored').state, 'missing');
  assert.notEqual(b.checks.find(c => c.id === 'runtime').state, 'ok');
  s.observe(s.b, [s.a.baseTopic], {executing: false});
  assert.equal(s.plan().systems[1].checks.find(c => c.id === 'runtime').state, 'missing');
});

test('ambiguous or unsafe mesh identities suppress config snippets instead of inventing bindings', () => {
  const s = setup(); s.b.baseTopic = s.a.baseTopic;
  assert.equal(s.plan().checks[0].state, 'missing'); assert.deepEqual(s.plan().suggestions, []);
  s.b.baseTopic = 'synthetic/topic with space'; assert.deepEqual(s.plan().suggestions, []);
  s.b.baseTopic = 'safe/topic'; s.project.systems.push({...structuredClone(s.b), id: randomUUID(), brokerId: s.a.brokerId});
  assert.deepEqual(s.plan().suggestions, []);
  s.project.systems.pop(); s.b.baseTopic = 'x'.repeat(129); assert.deepEqual(s.plan().suggestions, []);
  assert.throws(() => systemLinkPlan(s.project, s.reader, s.a.id, s.a.id), /invalidRequest/);
  assert.throws(() => systemLinkPlan(s.project, s.reader, randomUUID(), s.b.id), /invalidRequest/);
});

test('endpoint aliases, IPv6, TLS and user-defined names cannot create a self bridge or config injection', () => {
  const s = setup(); Object.assign(s.project.brokers[1], {host: s.project.brokers[0].host.toUpperCase() + '.'});
  assert.equal(s.plan().topology, 'shared');
  Object.assign(s.project.brokers[1], {host: '2001:db8::2', port: 8883, tls: true});
  s.a.name = 'not a directive\nallow_anonymous true';
  const tls = s.plan().suggestions.find(item => item.kind === 'bridge').text;
  assert.match(tls, /address \[2001:db8::2\]:8883/);
  assert.match(tls, /^bridge_cafile REPLACE_REMOTE_CA_FILE$/m);
  assert.match(tls, /^bridge_insecure false$/m); assert.doesNotMatch(tls, /allow_anonymous|bridge_insecure true/);
  assert.equal(s.plan().suggestions.find(item => item.kind === 'bridge').brokerId, s.a.brokerId);
  s.project.brokers[1].host = 'not:an:ipv6';
  assert.equal(s.plan().checks.find(c => c.id === 'address').state, 'missing');
  assert.equal(s.plan().suggestions.filter(item => item.kind === 'bridge').length, 0);
});

test('explicit check reads both selected systems only on connected brokers, without connecting or writing', async () => {
  const s = setup(); s.connections.set(s.a.brokerId, 'connected');
  readSystemLink(s.project, s.reader, s.a.id, s.b.id); await Promise.resolve();
  assert.deepEqual(s.reads, [s.a.id]);
  s.connections.set(s.b.brokerId, 'connected'); s.reads.length = 0;
  s.reader.refresh = async id => { s.reads.push(id); throw new Error('timeout'); };
  readSystemLink(s.project, s.reader, s.a.id, s.b.id); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(s.reads, [s.a.id, s.b.id]);
  assert.throws(() => readSystemLink(s.project, s.reader, s.a.id, randomUUID()), /invalidRequest/);
});

test('link IPC accepts only two assigned identity fields and never server commands or credentials', () => {
  const s = setup();
  for (const action of ['linkPlan', 'linkCheck']) {
    assert.equal(validPayload('network', {action, id: s.a.id, peerId: s.b.id}), true);
    for (const fields of [{}, {peerId: 'broker.invalid'}, {peerId: s.a.id}, {peerId: s.b.id, host: 'broker.invalid'},
      {peerId: s.b.id, password: 'synthetic'}, {peerId: s.b.id, command: 'reload'}]) {
      assert.equal(validPayload('network', {action, id: s.a.id, ...fields}), false);
    }
  }
});

test('suggested partner lists preserve existing grants and never exceed the canonical eight-peer limit', () => {
  const s = setup(); s.a.configuration.mesh_peers = ['existing/one', 'existing/two'];
  let peers = s.plan().suggestions.find(item => item.kind === 'peers' && item.systemId === s.a.id).text;
  assert.match(peers, /"existing\/one"/); assert.match(peers, /"existing\/two"/); assert.match(peers, /"synthetic\/2"/);
  s.a.configuration.mesh_peers = Array.from({length: 8}, (_, index) => 'existing/' + index);
  assert.equal(s.plan().systems[0].checks.find(item => item.id === 'local').detail, 'peerLimit');
  assert.equal(s.plan().suggestions.some(item => item.kind === 'peers' && item.systemId === s.a.id), false);
  s.a.configuration.mesh_peers[0] = s.b.baseTopic;
  peers = s.plan().suggestions.find(item => item.kind === 'peers' && item.systemId === s.a.id).text;
  assert.equal(peers.split('\n').filter(line => line.startsWith('  - ')).length, 8);
});

test('link checks use real correlated MQTT reads only and cannot confirm another account or a mesh route', async t => {
  const s = setup();
  const peers = await Promise.all(s.project.systems.map(system => startPeer({systems: new Map([[system.baseTopic, remoteFixture()]])})));
  s.project.brokers.forEach((broker, index) => { broker.host = '127.0.0.1'; broker.port = peers[index].port; });
  const reader = new MqttReader({read: async () => null}, new Diagnostics(), async () => {}, undefined, 500);
  t.after(async () => { reader.close(); await Promise.all(peers.map(peer => peer.close())); });
  reader.reconcile(s.project, 1);
  const wait = async predicate => {
    for (let n = 0; n < 150; n++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
    throw new Error('Synthetic link read did not complete');
  };
  await Promise.all(s.project.brokers.map(broker => reader.connectBroker(broker.id)));
  await wait(() => reader.state().systems.every(system => system.fresh && !system.reading));
  const counts = peers.map(peer => peer.publications.length);
  const before = JSON.stringify(s.project);
  readSystemLink(s.project, reader, s.a.id, s.b.id);
  await wait(() => peers.every((peer, index) => peer.publications.length >= counts[index] + 3) && reader.state().systems.every(system => system.fresh && !system.reading));
  const plan = systemLinkPlan(s.project, reader, s.a.id, s.b.id);
  assert.ok(plan.systems.every(system => system.checks.find(check => check.id === 'read').state === 'ok'));
  assert.deepEqual(plan.external, {accounts: 'unknown', rights: 'unknown', bridge: 'unknown', roundTrip: 'unknown'});
  assert.equal(JSON.stringify(s.project), before);
  assert.ok(peers.every(peer => peer.publications.every(message => /\/request\/(status|editor)$/.test(message.topic) && !message.retain && message.qos === 0)));
  reader.disconnect(s.b.brokerId);
  assert.equal(systemLinkPlan(s.project, reader, s.a.id, s.b.id).systems[1].checks.find(check => check.id === 'stored').state, 'unknown');
});
