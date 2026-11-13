import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require = createRequire(import.meta.url);
const {partnerOverview} = require('../apps/desktop/.build/partner-overview.js');
const {emptyConfiguration, newProject} = require('../apps/desktop/.build/project.js');

function setup() {
  const project = newProject('Synthetic project');
  project.brokers = ['A', 'B'].map(name => ({id: randomUUID(), name: 'Broker ' + name, host: 'broker-' + name.toLowerCase() + '.invalid', port: 1883, tls: false}));
  project.systems = project.brokers.map((broker, index) => ({id: randomUUID(), name: 'System ' + (index + 1), brokerId: broker.id,
    baseTopic: 'synthetic/' + (index + 1), baseline: null, configuration: emptyConfiguration()}));
  const remotes = new Map(); const reader = {current: id => remotes.get(id) ?? null};
  const [a, b] = project.systems;
  const observe = (system, peers, fresh = true, executing = false, activeMatches = false) => remotes.set(system.id,
    {fresh, configuration: {...emptyConfiguration(), mesh_peers: peers}, status: {executing, activeMatches}});
  return {project, reader, remotes, a, b, observe};
}

test('partner overview preserves each receiving direction and does not infer reciprocal grants', () => {
  const s = setup(); assert.deepEqual(partnerOverview(s.project, s.reader), []);
  s.a.configuration.mesh_peers = [s.b.baseTopic];
  const [row] = partnerOverview(s.project, s.reader);
  assert.equal(row.source, s.b.name); assert.equal(row.receiver, s.a.name);
  assert.equal(row.sourceBroker, 'Broker B'); assert.equal(row.receiverBroker, 'Broker A');
  assert.equal(row.configured, true); assert.equal(row.reciprocal, false);
  assert.equal(row.stored, null); assert.equal(row.confirmed, false); assert.equal(row.active, null);
  s.b.configuration.mesh_peers = [s.a.baseTopic];
  assert.ok(partnerOverview(s.project, s.reader).every(row => row.reciprocal));
});

test('local additions and removals remain distinct from freshly stored grants and active operation', () => {
  const s = setup(); s.a.configuration.mesh_peers = [s.b.baseTopic];
  s.observe(s.a, [], true); s.observe(s.b, [s.a.baseTopic], true, true, true);
  const rows = partnerOverview(s.project, s.reader);
  const added = rows.find(row => row.receiverId === s.a.id);
  const removed = rows.find(row => row.receiverId === s.b.id);
  assert.equal(added.configured, true); assert.equal(added.stored, false); assert.equal(added.confirmed, true);
  assert.equal(removed.configured, false); assert.equal(removed.stored, true); assert.equal(removed.active, true);
  s.observe(s.b, [s.a.baseTopic], true, true, false);
  assert.equal(partnerOverview(s.project, s.reader).find(row => row.receiverId === s.b.id).active, null);
});

test('cached grants never establish current permission or operation and unassigned topics remain visible', () => {
  const s = setup(); s.a.configuration.mesh_peers = [s.b.baseTopic, 'external/peer'];
  s.a.stored = {configuration: {...emptyConfiguration(), mesh_peers: [s.b.baseTopic]}};
  s.observe(s.a, [], false, true, true);
  const rows = partnerOverview(s.project, s.reader);
  assert.equal(rows.find(row => row.sourceTopic === s.b.baseTopic).stored, true, 'Persisted observations take precedence over an older disconnected cache');
  assert.ok(rows.every(row => !row.confirmed && row.active === null));
  const external = rows.find(row => row.sourceTopic === 'external/peer');
  assert.equal(external.assigned, false); assert.equal(external.source, 'external/peer');
  s.project.systems.push({...structuredClone(s.b), id: randomUUID()});
  assert.equal(partnerOverview(s.project, s.reader).find(row => row.sourceTopic === s.b.baseTopic).assigned, false);
});
