import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID, createHash} from 'node:crypto';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {remoteFixture} from './support/mqtt-peer.mjs';
const require = createRequire(import.meta.url);
const {ProjectService} = require('../apps/desktop/.build/project-service.js');
const {Diagnostics} = require('../apps/desktop/.build/diagnostics.js');
const {parseProject} = require('../apps/desktop/.build/project.js');
const {DraftEditor} = require('../apps/desktop/.build/draft-editor.js');
const {DraftExchange, exportDraft} = require('../apps/desktop/.build/draft-exchange.js');
const {editorData} = require('../apps/desktop/.build/mqtt-protocol.js');
const {createDraftFile, fileDrafts} = require('../apps/desktop/.build/draft-merge.js');
async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), 'z2ma-reconcile-')); t.after(() => rm(directory, {recursive: true, force: true}));
  const path = join(directory, 'project.z2map');
  const service = new ProjectService({status: async () => 'none', protectedAvailable: async () => false, clearSession() {}}, {
    chooseOpen: async () => path, chooseSave: async () => path, confirmDiscard: async () => true, confirmRestore: async () => true, confirmDelete: async () => true
  }, new Diagnostics(), join(directory, 'recovery'));
  await service.command({action: 'new'});
  const broker = {id: randomUUID(), name: 'Synthetic', host: 'broker.invalid', port: 1883, tls: false};
  await service.command({action: 'broker', broker}); const id = randomUUID();
  await service.command({action: 'system', system: {id, name: 'Synthetic', brokerId: broker.id, baseTopic: 'synthetic'}});
  const original = editorData(remoteFixture().editor).configuration;
  const configuration = (...ids) => ({...structuredClone(original), automations: ids.map(id => ({...structuredClone(original.automations[0]), id, name: id}))});
  const stored = configuration => { const yaml = exportDraft(configuration).toString(); return {revision: configuration.revision, checksum: createHash('sha256').update(yaml).digest('hex'), configuration, yaml}; };
  const system = () => service.data().systems.find(item => item.id === id);
  const sync = data => service.reconcileStored(service.data().id, service.generation(), id, stored(data));
  return {service, id, directory, path, system, configuration, stored, sync};
}
test('connection reads merge drafts, persist the actual base, create a recoverable backup and preserve remote flags', async t => {
  const s = await setup(t); const local = s.configuration('new'); local.automations[0].enabled = false;
  s.service.replaceDraft(s.id, local); const remote = s.configuration('existing'); remote.automations[0].enabled = true;
  await s.sync(remote);
  assert.deepEqual(s.system().configuration.automations.map(item => [item.id, item.enabled]), [['new', false], ['existing', true]]);
  assert.deepEqual(s.system().baseline.configuration, remote);
  const backup = parseProject(await readFile(join(s.directory, 'recovery', s.service.data().id + '.' + s.id + '.z2map')));
  assert.deepEqual(backup.systems[0].configuration, local);
  await s.service.command({action: 'save'}); await s.service.command({action: 'open'});
  assert.deepEqual(s.system().baseline.configuration, remote);
  const next = s.configuration('existing', 'remote-new'); next.revision++;
  await s.sync(next);
  assert.deepEqual(s.system().configuration.automations.map(item => item.id), ['new', 'existing', 'remote-new']);
  const job = s.service.draftSync(s.id);
  await s.service.resolveDraftSync(s.id, job.operation, 'restore');
  assert.deepEqual(s.system().configuration.automations.map(item => item.id), ['new', 'existing']);
});
test('conflict choices are bound to a fresh remote read and stale or foreign resolutions cannot apply', async t => {
  const s = await setup(t); assert.throws(() => s.service.assertDraftSynchronized(s.id), /draftSyncRequired/);
  const base = s.configuration('existing'); await s.sync(base); assert.doesNotThrow(() => s.service.assertDraftSynchronized(s.id));
  const local = structuredClone(s.system().configuration); local.automations[0].name = 'Local'; s.service.replaceDraft(s.id, local);
  const remote = structuredClone(base); remote.revision++; remote.automations[0].name = 'Remote'; await s.sync(remote);
  const job = s.service.draftSync(s.id); assert.equal(job.phase, 'conflict'); assert.equal(s.system().configuration.automations[0].name, 'Local');
  assert.throws(() => s.service.assertDraftSynchronized(s.id), /draftSyncRequired/, 'A conflict cannot be bypassed by checking or storing the unmerged draft');
  await assert.rejects(s.service.resolveDraftSync(s.id, 'foreign', 'merge', {'automations:existing': 'remote'}));
  await s.service.resolveDraftSync(s.id, job.operation, 'merge', {'automations:existing': 'remote'});
  assert.equal(s.system().configuration.automations[0].name, 'Local', 'Choosing does not commit an unverified cached read');
  await s.sync(remote); assert.equal(s.system().configuration.automations[0].name, 'Remote');
});
test('open input and interrupted connection evidence cannot be overwritten by automatic reconciliation', async t => {
  const s = await setup(t); const local = s.configuration('local'); s.service.replaceDraft(s.id, local);
  s.service.editorState(true); await s.sync(s.configuration('remote')); assert.deepEqual(s.system().configuration, local);
  s.service.editorState(false);
  await assert.rejects(s.service.reconcileStored(s.service.data().id, s.service.generation(), s.id, s.stored(s.configuration('remote')), {}, () => false));
  assert.deepEqual(s.system().configuration, local);
});
test('unfinished working rules survive reads and draft-file saves while runtime validation remains separate', async t => {
  const s = await setup(t); const partial = s.configuration('unfinished'); partial.automations[0].triggers = []; partial.automations[0].actions = [];
  s.service.replaceDraft(s.id, partial); await s.sync(s.configuration('existing'));
  assert.deepEqual(s.system().configuration.automations.map(item => item.id), ['unfinished', 'existing']);
  assert.throws(() => exportDraft(s.system().configuration), /draftSchema/, 'Full runtime YAML validation still rejects incomplete rules');
  const reader = {current: () => null, connected: () => false, source: () => 'draft', reconcile() {}, view() {}};
  const editor = new DraftEditor(s.service, reader); const path = join(s.directory, 'unfinished.z2mad');
  const exchange = new DraftExchange(s.service, editor, {chooseImport: async () => null, chooseExport: async () => null, chooseBackup: async () => null,
    chooseDraftExport: async () => path, confirm: async () => true});
  const file = createDraftFile(s.system(), s.system().configuration);
  await exchange.fileCommand({route: 'draft-files', systemId: s.id, generation: s.service.generation() + 1, fingerprint: editor.context(s.system()), payload: {requestId: randomUUID(), action: 'save', file}});
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')).configuration, s.system().configuration);
});
test('draft files add selected rules without grants or enablement and legacy projects remain readable', async t => {
  const s = await setup(t); await s.sync(s.configuration('existing'));
  let source = 'stored';
  const reader = {current: () => null, connected: () => false, source: () => source, reconcile() {}, view(_id, value) { source = value; }};
  const editor = new DraftEditor(s.service, reader);
  const exchange = new DraftExchange(s.service, editor, {chooseImport: async () => null, chooseExport: async () => null, chooseBackup: async () => null, confirm: async () => true});
  const incoming = s.configuration('new'); incoming.mesh_peers = ['unapproved']; incoming.automations[0].enabled = true;
  const file = createDraftFile(s.system(), incoming);
  const command = payload => ({route: 'draft-files', systemId: s.id, generation: s.service.generation() + 1, fingerprint: editor.context(s.system()), payload: {requestId: randomUUID(), ...payload}});
  const result = await exchange.fileCommand(command({action: 'import', file, choices: {}}));
  assert.equal(source, 'draft', 'Adding a portable file opens the local draft even when the stored view was selected');
  assert.equal(result.applied, true); assert.deepEqual(s.system().configuration.mesh_peers, []);
  assert.deepEqual(s.system().configuration.automations.map(item => [item.id, item.enabled]), [['existing', true], ['new', false]]);
  assert.equal(fileDrafts({format: 'z2m-automations-workspace', version: 1, systems: [file]}).length, 1);
  await s.service.command({action: 'save'});
  const legacy = join(s.directory, 'legacy.z2ma'); const bytes = await readFile(s.path);
  const old = JSON.parse(bytes); old.version = 1; delete old.systems[0].baseline.configuration;
  await writeFile(legacy, JSON.stringify(old));
  const upgraded = parseProject(await readFile(legacy));
  assert.equal(upgraded.version, 2); assert.deepEqual(upgraded.systems[0].configuration, s.system().configuration);
  const job = s.service.draftSync(s.id); await s.service.resolveDraftSync(s.id, job.operation, 'restore');
  assert.deepEqual(s.system().configuration.automations.map(item => item.id), ['existing']);
});
