import test from 'node:test';
import assert from 'node:assert/strict';
import {operationTargets, operationState, activationRuleNames} from '../packages/designer/dist/assets/operation-readiness.js';

const source = {name: 'Source', binding: {systemId: 'source', baseTopic: 'synthetic/source'}, runtimeConfirmed: true, executing: true};
const target = {name: 'Destination', binding: {systemId: 'target', baseTopic: 'synthetic/target'}, runtimeConfirmed: true, executing: false};
const data = () => ({workspaceContext: {systemId: 'source'}, workspace: {systems: [structuredClone(source), structuredClone(target)]},
  module: {baseTopic: 'synthetic/source'}, configuration: {sequences: [{id: 'sequence', actions: [
    {type: 'set', target: {type: 'device', id: 'same-device', system: 'synthetic/target'}}]}]}});
const remote = {id: 'rule', name: 'Synthetic light', conditions: [], actions: [{type: 'sequence', sequence_id: 'sequence'}]};

test('remote actions in reusable sequences identify the stopped receiver and stable system to open', () => {
  assert.deepEqual(operationTargets(data(), [remote]), [{topic: 'synthetic/target', systemId: 'target', name: 'Destination', state: 'stopped', rules: ['Synthetic light']}]);
});

test('remote conditions and actions share one network row while local targets need no partner start', () => {
  const rule = {...remote, conditions: [{type: 'device_value', system: 'synthetic/target'}], actions: [
    {type: 'set', target: {system: 'synthetic/source'}}, {type: 'scene', target: {system: 'synthetic/target'}}]};
  const rows = operationTargets(data(), [rule, {...rule, id: 'second', name: 'Second rule'}]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].rules, ['Synthetic light', 'Second rule']);
});

test('unconfirmed, absent and ambiguous receivers remain unknown and cannot select an arbitrary system', () => {
  for (const systems of [[{...target, runtimeConfirmed: false}], [], [target, {...target, binding: {...target.binding, systemId: 'duplicate'}}]]) {
    const model = data(); model.workspace.systems = [source, ...systems];
    const row = operationTargets(model, [remote])[0];
    assert.equal(row.state, 'unknown');
    assert.equal(Boolean(row.systemId), systems.length === 1);
  }
});

test('a running receiver is confirmed only by operating status, independently of its stored revision', () => {
  const model = data(); Object.assign(model.workspace.systems[1], {runtimeConfirmed: true, executing: true, activeRevision: null});
  assert.equal(operationTargets(model, [remote])[0].state, 'active');
  model.workspace.systems[1].runtimeConfirmed = false;
  assert.equal(operationTargets(model, [remote])[0].state, 'unknown');
});

test('selected runtime readback takes precedence over an older overview without mixing another system', () => {
  const model = data(); model.runtime = {confirmed: true, executing: false};
  assert.equal(operationState(model, model.workspace.systems[0]), 'stopped');
  assert.equal(operationState(model, model.workspace.systems[1]), 'stopped');
  model.runtime = {confirmed: false, executing: true};
  assert.equal(operationState(model, model.workspace.systems[0]), 'unknown');
  model.runtime = {confirmed: true, executing: true, pending: true};
  assert.equal(operationState(model, model.workspace.systems[0]), 'unknown');
});

test('activation previews use explicitly released saved rule names and preserve names as text', () => {
  assert.deepEqual(activationRuleNames({releasedRules: [{id: 'a', name: '<b>Saved light</b>'}]}), ['<b>Saved light</b>']);
  assert.deepEqual(activationRuleNames({rules: {a: {name: 'Enabled', enabled: true}, b: {name: 'Disabled', enabled: false}}}), ['Enabled']);
  assert.deepEqual(activationRuleNames({rules: {a: {name: 'Unknown'}}}), []);
});
