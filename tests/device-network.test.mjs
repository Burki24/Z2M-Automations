import test from 'node:test';
import assert from 'node:assert/strict';
import * as workspace from '../packages/designer/dist/assets/workspace.js';

const data = {module: {name: 'Automation centre', baseTopic: 'local-topic'}, desktop: {systemName: 'Local network'},
  workspaceContext: {systemId: 'local-id'}, workspace: {systems: [
    {name: 'Remote network', binding: {systemId: 'remote-id', baseTopic: 'remote-topic'}},
    {name: 'Local network', binding: {systemId: 'local-id', baseTopic: 'local-topic'}}
  ]}};

test('device network names resolve the owning system independently of catalog order', () => {
  assert.equal(typeof workspace.deviceSystemName, 'function', 'The reader needs a shared device-network label.');
  assert.equal(workspace.deviceSystemName(data), 'Local network · local-topic');
  assert.equal(workspace.deviceSystemName(data, 'remote-topic'), 'Remote network · remote-topic');
  assert.equal(workspace.deviceSystemName({...data, desktop: undefined}), 'Local network · local-topic');
});

test('unassigned or ambiguous remote topics never acquire another system name', () => {
  assert.equal(workspace.deviceSystemName(data, 'unassigned/topic'), 'unassigned/topic');
  const ambiguous = structuredClone(data);
  ambiguous.workspace.systems.push({name: 'Another network', binding: {systemId: 'third-id', baseTopic: 'remote-topic'}});
  assert.equal(workspace.deviceSystemName(ambiguous, 'remote-topic'), 'remote-topic');
  ambiguous.workspace.systems[0].binding.baseTopic = 'local-topic';
  assert.equal(workspace.deviceSystemName(ambiguous), 'Local network · local-topic', 'Local ownership follows the selected ID.');
});

test('legacy views retain their base topic and matching names are not repeated', () => {
  assert.equal(workspace.deviceSystemName({module: {name: 'Automation centre', baseTopic: 'legacy/topic'}}), 'legacy/topic');
  const equal = structuredClone(data); equal.desktop.systemName = 'local-topic';
  assert.equal(workspace.deviceSystemName(equal), 'local-topic');
});
