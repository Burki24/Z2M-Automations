import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, readFile, writeFile, rm, readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID, createCipheriv, createDecipheriv, randomBytes} from 'node:crypto';
import {withWindowsFileLock} from './support/windows-lock.mjs';
const require = createRequire(import.meta.url);
const {newProject, emptyConfiguration, parseProject, projectBytes, validProject} = require('../apps/desktop/.build/project.js');
const {ProjectFile, atomicWrite} = require('../apps/desktop/.build/project-files.js');
const {Credentials, readCredentialFile} = require('../apps/desktop/.build/credentials.js');
const {ProjectService} = require('../apps/desktop/.build/project-service.js');
const {Diagnostics} = require('../apps/desktop/.build/diagnostics.js');
const {validPayload} = require('../apps/desktop/.build/security.js');
const {osProtection} = require('../apps/desktop/.build/os-protection.js');
function fixture() {
  const project = newProject('Synthetic project');
  const broker = {id: randomUUID(), name: 'Synthetic broker', host: 'broker.invalid', port: 8883, tls: true};
  project.brokers.push(broker);
  project.systems.push({id: randomUUID(), name: 'Synthetic system', brokerId: broker.id, baseTopic: 'synthetic', baseline: {revision: 12, checksum: 'a'.repeat(64)}, configuration: emptyConfiguration()});
  return project;
}
async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'z2ma-project-test-')); t.after(() => rm(path, {recursive: true, force: true})); return path;
}
function protector({available = true, backend = 'gnome_libsecret', fail = false} = {}) {
  const key = randomBytes(32);
  return {isAsyncEncryptionAvailable: async () => available, getSelectedStorageBackend: () => backend,
    async encryptStringAsync(value) {
      if (fail) throw new Error('PRIVATE_PROVIDER_ERROR');
      const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    },
    async decryptStringAsync(bytes) { const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12)); decipher.setAuthTag(bytes.subarray(12, 28)); return {result: Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'), shouldReEncrypt: false}; }
  };
}
test('portable format preserves stable ownership, base revisions and disabled drafts across round trips', () => {
  const project = fixture(); const second = structuredClone(project.systems[0]); second.id = randomUUID(); second.baseTopic = 'other';
  project.systems.push(second);
  for (const system of project.systems) {
    system.configuration.mesh_peers = ['synthetic-peer'];
    system.configuration.automations.push({id: 'same-rule-id', name: 'Synthetic draft', enabled: false, triggers: [], conditions: [], actions: []});
  }
  assert.deepEqual(parseProject(projectBytes(project)), project);
  assert.equal(project.systems[0].baseline.revision, 12);
  const bytes = projectBytes(project).toString();
  for (const field of ['password', 'username', 'session', 'privateKey', 'instanceId']) assert.equal(bytes.includes('"' + field + '"'), false);
});
test('reject unsupported versions, secret fields, bad references, duplicate bindings and excessive systems without mutation', () => {
  const source = fixture();
  const eight = structuredClone(source);
  eight.systems = Array.from({length: 8}, (_, index) => ({...structuredClone(source.systems[0]), id: randomUUID(), baseTopic: 'system' + index}));
  assert.equal(validProject(eight), true);
  for (const mutate of [p => p.version = 2, p => p.password = 'PRIVATE', p => p.brokers[0].username = 'PRIVATE',
    p => p.systems[0].brokerId = randomUUID(), p => p.brokers[0].host = 'mqtt://user:password@host',
    p => p.systems.push({...p.systems[0], id: randomUUID()}), p => p.systems[0].configuration.session = 'PRIVATE',
    p => p.systems[0].baseTopic = 'invalid/#', p => p.systems = Array.from({length: 9}, (_, i) => ({...p.systems[0], id: randomUUID(), baseTopic: 'topic' + i}))]) {
    const invalid = structuredClone(source); mutate(invalid);
    assert.equal(validProject(invalid), false); assert.throws(() => parseProject(Buffer.from(JSON.stringify(invalid))), /invalidProject/);
  }
  assert.throws(() => parseProject(Buffer.alloc(2097153)), /invalidProject/);
  assert.throws(() => parseProject(Buffer.from([0xff])), /invalidProject/);
  assert.equal(source.systems.length, 1);
});
test('atomic save creates restorable backup; conflicts preserve both existing files and memory', async t => {
  const dir = await directory(t); const path = join(dir, 'project.z2ma'); const file = new ProjectFile(); const project = fixture();
  await file.save(project, path); const original = await readFile(path);
  project.name = 'Changed draft'; await file.save(project);
  assert.deepEqual(await readFile(path + '.bak'), original);
  assert.equal((await file.restore()).name, 'Synthetic project');
  const external = {...project, name: 'External editor'}; await writeFile(path, projectBytes(external));
  await assert.rejects(file.save(project), /fileConflict/);
  assert.equal(parseProject(await readFile(path)).name, 'External editor');
  assert.deepEqual(await readFile(path + '.bak'), original);
  assert.equal(project.name, 'Changed draft');
  assert.equal((await readdir(dir)).some(name => name.endsWith('.tmp')), false);
});
test('locked destination failure preserves draft and existing file and removes temporary output', async t => {
  const dir = await directory(t); const project = fixture(); const path = join(dir, 'project.z2ma');
  const file = new ProjectFile(); await file.save(project, path);
  // A directory at the target deterministically rejects replacement on both platforms.
  await assert.rejects(atomicWrite(dir, projectBytes(project)));
  assert.deepEqual(parseProject(await readFile(path)), project);
  assert.equal((await readdir(dir)).some(name => name.endsWith('.tmp')), false);
});
test('a real Windows exclusive file lock rejects save without losing the draft', {skip: process.platform !== 'win32'}, async t => {
  const dir = await directory(t); const path = join(dir, 'locked.z2ma'); const file = new ProjectFile(); const project = fixture();
  await file.save(project, path); const original = await readFile(path); project.name = 'Unsaved while locked';
  await withWindowsFileLock(path, async () => {
    await assert.rejects(file.save(project), error => ['EACCES', 'EPERM', 'EBUSY'].includes(error.code));
    assert.equal(project.name, 'Unsaved while locked');
  }, {report: state => t.diagnostic('LOCK_HELPER_DIAGNOSTICS ' + JSON.stringify(state))});
  assert.deepEqual(await readFile(path), original);
  assert.equal((await readdir(dir)).some(name => name.endsWith('.tmp')), false);
  await file.save(project);
  assert.equal(parseProject(await readFile(path)).name, 'Unsaved while locked');
  assert.deepEqual(await readFile(path + '.bak'), original);
});
test('export is independent of the open path and cannot bypass its conflict check', async t => {
  const dir = await directory(t); const path = join(dir, 'source.z2ma'); const output = join(dir, 'export.z2ma');
  const file = new ProjectFile(); const project = fixture(); await file.save(project, path);
  await assert.rejects(file.export(project, path), /fileConflict/);
  if (process.platform === 'win32') await assert.rejects(file.export(project, path.toUpperCase()), /fileConflict/);
  await file.export(project, output); assert.deepEqual(parseProject(await readFile(output)), project);
  project.name = 'Only the original changes'; await file.save(project);
  assert.equal(parseProject(await readFile(output)).name, 'Synthetic project');
});
test('protected credentials never enter project/state/logs; bind to project, broker and endpoint', async t => {
  const dir = await directory(t); const project = fixture(); const broker = project.brokers[0]; const provider = protector();
  const vault = new Credentials(dir, provider, 'linux');
  await vault.store(project.id, broker, {brokerId: broker.id, username: 'SYNTHETIC_USER', password: 'SYNTHETIC_SECRET', mode: 'protected'});
  const reopened = new Credentials(dir, provider, 'linux');
  assert.equal((await reopened.read(project.id, broker)).password, 'SYNTHETIC_SECRET');
  assert.equal(await reopened.status(project.id, broker), 'protected');
  assert.equal(await reopened.read(randomUUID(), broker), null);
  assert.equal(await reopened.read(project.id, {...broker, host: 'other.invalid'}), null);
  const bytes = await readFile(join(dir, (await readdir(dir))[0])); assert.equal(bytes.includes('SYNTHETIC_SECRET'), false);
  assert.equal(bytes.includes('SYNTHETIC_USER'), false);
  assert.equal(projectBytes(project).includes('SYNTHETIC_SECRET'), false);
});
test('Linux basic_text, unknown, absent and locked stores never persist secrets; session choice is explicit', async t => {
  const dir = await directory(t); const project = fixture(); const broker = project.brokers[0];
  for (const options of [{backend: 'basic_text'}, {backend: 'unknown'}, {available: false}, {fail: true}]) {
    const vault = new Credentials(dir, protector(options), 'linux');
    await assert.rejects(vault.store(project.id, broker, {brokerId: broker.id, username: 'user', password: 'PRIVATE', mode: 'protected'}), /protectionUnavailable/);
    assert.deepEqual(await readdir(dir), []);
    await vault.store(project.id, broker, {brokerId: broker.id, username: 'user', password: 'PRIVATE', mode: 'session'});
    assert.equal(await vault.status(project.id, broker), 'session');
    assert.equal(await new Credentials(dir, protector(), 'linux').read(project.id, broker), null);
    vault.clearSession(); assert.equal(await vault.read(project.id, broker), null);
  }
});
test('Linux checks the actual keyring-backed API even when async availability reports true for fallback', async t => {
  const dir = await directory(t); const project = fixture(); const broker = project.brokers[0];
  let encryptions = 0;
  const adapter = osProtection({...protector(), isEncryptionAvailable: () => false,
    encryptString() { encryptions++; return Buffer.from('UNPROTECTED'); }, decryptString: () => ''}, 'linux');
  const vault = new Credentials(dir, adapter, 'linux');
  assert.equal(await vault.protectedAvailable(), false);
  await assert.rejects(vault.store(project.id, broker, {brokerId: broker.id, username: '', password: 'PRIVATE', mode: 'protected'}), /protectionUnavailable/);
  assert.equal(encryptions, 0); assert.deepEqual(await readdir(dir), []);
});
test('choosing session removes older protected credentials and removal clears both stores', async t => {
  const dir = await directory(t); const project = fixture(); const broker = project.brokers[0]; const vault = new Credentials(dir, protector(), 'win32');
  await vault.store(project.id, broker, {brokerId: broker.id, username: '', password: 'OLD', mode: 'protected'});
  await vault.store(project.id, broker, {brokerId: broker.id, username: '', password: 'NEW', mode: 'session'});
  assert.deepEqual(await readdir(dir), []); assert.equal((await vault.read(project.id, broker)).password, 'NEW');
  await vault.remove(project.id, broker); assert.equal(await vault.read(project.id, broker), null);
});
test('a locked service reports protected credentials unavailable without overwriting them', async t => {
  const dir = await directory(t); const project = fixture(); const broker = project.brokers[0]; const provider = protector();
  const vault = new Credentials(dir, provider, 'linux');
  await vault.store(project.id, broker, {brokerId: broker.id, username: '', password: 'PRIVATE', mode: 'protected'});
  const file = join(dir, (await readdir(dir))[0]); const original = await readFile(file);
  const locked = new Credentials(dir, {...provider, isAsyncEncryptionAvailable: async () => false}, 'linux');
  assert.equal(await locked.status(project.id, broker), 'locked');
  await assert.rejects(locked.read(project.id, broker), /protectionUnavailable/);
  await assert.rejects(locked.store(project.id, broker, {brokerId: broker.id, username: '', password: 'NEW', mode: 'protected'}), /protectionUnavailable/);
  assert.deepEqual(await readFile(file), original);
});
test('IPC rejects paths, credential reads, unknown fields and unsupported operations', () => {
  for (const payload of [{action: 'open', path: '/private'}, {action: 'execute'}, {action: 'save', project: fixture()}, {action: 'rename', name: ''}]) assert.equal(validPayload('project', payload), false);
  for (const payload of [{brokerId: randomUUID(), mode: 'read'}, {brokerId: randomUUID(), mode: 'session', username: 'user', password: 'PRIVATE', path: '/private'}]) assert.equal(validPayload('credential', payload), false);
  assert.equal(validPayload('credential', {brokerId: randomUUID(), mode: 'protected', username: 'user', password: 'PRIVATE'}), false);
  assert.equal(validPayload('credential', {brokerId: randomUUID(), mode: 'protected'}), true);
  assert.equal(validPayload('credential', {brokerId: randomUUID(), mode: 'session', source: 'manual'}), true);
  assert.equal(validPayload('credential', {brokerId: randomUUID(), mode: 'remove', source: 'manual'}), false);
  assert.equal(validPayload('credential', {brokerId: randomUUID(), mode: 'session', source: 'manual', password: 'PRIVATE'}), false);
});
test('credential files are bounded and parsed only by the main service, with generic errors', async t => {
  const dir = await directory(t); const path = join(dir, 'synthetic-credentials.json');
  await writeFile(path, JSON.stringify({username: 'SYNTHETIC_USER', password: 'PRIVATE'}));
  assert.deepEqual(await readCredentialFile(path), {username: 'SYNTHETIC_USER', password: 'PRIVATE'});
  for (const contents of ['{broken', JSON.stringify({username: 'u', password: 'PRIVATE', token: 'PRIVATE'}), JSON.stringify({username: 'u', password: ''}), 'x'.repeat(16385)]) {
    await writeFile(path, contents); await assert.rejects(readCredentialFile(path), error => error.message === 'invalidCredentials');
  }
});
test('project service cancels safely, rejects malformed opens and restores backup only to dirty local memory', async t => {
  const dir = await directory(t); const path = join(dir, 'input.z2ma'); const project = fixture(); await writeFile(path, projectBytes(project));
  let allow = false; let chosen = path;
  const debug = new Diagnostics(); debug.control('start');
  const service = new ProjectService(new Credentials(join(dir, 'secrets'), protector(), 'linux'), {
    chooseOpen: async () => chosen, chooseSave: async () => path, confirmDiscard: async () => allow, confirmRestore: async () => allow, confirmDelete: async () => allow, chooseCredentials: async () => null
  }, debug);
  await service.command({action: 'open'}); const original = service.data();
  await service.command({action: 'rename', name: 'Unsaved'});
  await service.command({action: 'new'}); assert.equal(service.data().name, 'Unsaved');
  allow = true; chosen = join(dir, 'invalid.z2ma'); await writeFile(chosen, '{broken');
  await assert.rejects(service.command({action: 'open'}), /invalidProject/); assert.equal(service.data().name, 'Unsaved');
  await service.command({action: 'save'}); assert.equal(service.isDirty(), false);
  await service.command({action: 'restore'}); assert.deepEqual(service.data(), original); assert.equal(service.isDirty(), true);
  assert.equal(parseProject(await readFile(path)).name, 'Unsaved');
  const systemId = service.data().systems[0].id;
  await service.command({action: 'draft', systemId, operation: 'new', name: 'Local draft', ruleId: ''});
  const rule = service.data().systems[0].configuration.automations[0]; assert.equal(rule.enabled, false);
  await service.command({action: 'draft', systemId, operation: 'copy', name: 'Copy', ruleId: rule.id});
  const copied = service.data().systems[0].configuration.automations[1]; assert.equal(copied.enabled, false); assert.notEqual(copied.id, rule.id);
  await service.command({action: 'editing'}); await assert.rejects(service.command({action: 'save'}), /applyFirst/);
  const state = JSON.stringify(await service.state());
  assert.equal(state.includes(path), false);
  assert.equal(JSON.stringify(debug.read()).includes('Unsaved'), false);
});
test('broker changes invalidate associated baselines while preserving drafts and system identity', async t => {
  const dir = await directory(t); const path = join(dir, 'project.z2ma'); const project = fixture();
  project.systems[0].configuration.automations.push({id: 'existing-rule', name: 'Existing enabled rule', enabled: true, triggers: [], conditions: [], actions: []});
  await writeFile(path, projectBytes(project));
  const service = new ProjectService(new Credentials(join(dir, 'vault'), protector(), 'linux'), {
    chooseOpen: async () => path, chooseSave: async () => null, confirmDiscard: async () => false, confirmRestore: async () => false, confirmDelete: async () => false, chooseCredentials: async () => null
  }, new Diagnostics());
  await service.command({action: 'open'});
  await service.command({action: 'broker', broker: {...project.brokers[0], host: 'changed.invalid'}});
  assert.equal(service.data().systems[0].baseline, null);
  assert.equal(service.data().systems[0].id, project.systems[0].id);
  assert.deepEqual(service.data().systems[0].configuration, project.systems[0].configuration);
  await service.command({action: 'draft', systemId: project.systems[0].id, operation: 'copy', name: 'Disabled copy', ruleId: 'existing-rule'});
  assert.equal(service.data().systems[0].configuration.automations[0].enabled, true);
  assert.equal(service.data().systems[0].configuration.automations[1].enabled, false);
  await service.command({action: 'editing'});
  await service.command({action: 'new'}); assert.equal(service.data().systems.length, 1);
  assert.equal(service.isDirty(), true);
});
