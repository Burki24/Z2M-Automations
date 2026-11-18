import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeConfigurations, createDraftFile, readDraftFile} from '../packages/designer/src/draft-merge.js';

const rule = (id, name = id) => ({id, name, enabled: false, triggers: [], conditions: [], actions: []});
const config = (...rules) => ({schema_version: 1, revision: 1, automations: rules, sequences: [], mesh_peers: []});
test('first connection combines remote rules and unsent drafts without mutating either source', () => {
  const local = config(rule('new')); const remote = config(rule('old'));
  remote.automations[0].enabled = true;
  const before = structuredClone({local, remote});
  const result = mergeConfigurations(local, remote);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.configuration.automations.map(r => [r.id, r.enabled]), [['new', false], ['old', true]]);
  assert.deepEqual({local, remote}, before);
});
test('the common content distinguishes one-sided edits and deletions from conflicting changes', () => {
  const base = config(rule('one'), rule('two'), rule('three'));
  const local = config(rule('one', 'Local'), rule('three'));
  const remote = config(rule('one'), rule('two'), rule('three', 'Remote'), rule('four'));
  const result = mergeConfigurations(local, remote, base);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.configuration.automations.map(r => [r.id, r.name]), [['one', 'Local'], ['three', 'Remote'], ['four', 'four']]);
  const conflict = mergeConfigurations(config(rule('one', 'Local')), config(rule('one', 'Remote')), config(rule('one')));
  assert.equal(conflict.conflicts[0].key, 'automations:one');
  assert.equal(mergeConfigurations(config(rule('one', 'Local')), config(rule('one', 'Remote')), config(rule('one')), {'automations:one': 'remote'}).configuration.automations[0].name, 'Remote');
  assert.equal(mergeConfigurations(config(), config(rule('one', 'Remote')), config(rule('one'))).conflicts.length, 1);
});
test('unknown historical bases and incompatible permissions require decisions, equal names never identify rules', () => {
  assert.equal(mergeConfigurations(config(rule('one', 'Local')), config(rule('one', 'Remote'))).conflicts.length, 1);
  assert.equal(mergeConfigurations(config(rule('one', 'Same')), config(rule('two', 'Same'))).configuration.automations.length, 2);
  assert.equal(mergeConfigurations({...config(), mesh_peers: ['a']}, {...config(), mesh_peers: ['b']}).conflicts[0].kind, 'permissions');
});
test('portable drafts retain ownership and only required sequences for a selection', () => {
  const value = config({...rule('one'), actions: [{type: 'sequence', sequence_id: 'used'}]}, rule('two'));
  value.sequences = [{id: 'used', name: 'Used', actions: []}, {id: 'unused', name: 'Unused', actions: []}];
  const file = createDraftFile({id: 'system', name: 'Synthetic', baseTopic: 'synthetic'}, value, null, ['one']);
  assert.deepEqual(readDraftFile(JSON.parse(JSON.stringify(file))), file);
  assert.deepEqual(file.configuration.automations.map(r => r.id), ['one']);
  assert.deepEqual(file.configuration.sequences.map(r => r.id), ['used']);
  assert.throws(() => readDraftFile({...file, password: 'secret'}));
});
test('a deleted sequence needed by a retained rule is an explicit dependency conflict', () => {
  const base = {...config(), sequences: [{id: 'needed', name: 'Needed', actions: []}]};
  const local = {...structuredClone(base), automations: [{...rule('new'), actions: [{type: 'sequence', sequence_id: 'needed'}]}]};
  const remote = config();
  const plan = mergeConfigurations(local, remote, base);
  assert.equal(plan.conflicts.length, 1); assert.equal(plan.conflicts[0].key, 'sequences:needed'); assert.equal(plan.conflicts[0].dependency, true);
  assert.equal(mergeConfigurations(local, remote, base, {'sequences:needed': 'local'}).configuration.sequences.length, 1);
  assert.equal(mergeConfigurations(local, remote, base, {'sequences:needed': 'remote'}).configuration.sequences.length, 0);
});
