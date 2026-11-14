import test from 'node:test';
import assert from 'node:assert/strict';
import {draftSyncRequest} from '../packages/designer/dist/assets/draft-sync.js';

const context = {systemId: 'synthetic-system', generation: 3, fingerprint: 'a'.repeat(64)};
const view = {systemId: context.systemId, generation: 3, fingerprint: context.fingerprint, operation: 'b'.repeat(32),
  phase: 'conflict', pending: false, canStart: true, canReplace: true, canRestore: false,
  baseRevision: 69, remoteRevision: 74, counts: {added: 2, changed: 1, removed: 1}, permissionsChanged: false, error: ''};
const data = {workspaceContext: context, draftSync: view};
const options = {token: 'private-token', base: 'http://127.0.0.1/view/index.html#private-token', requestId: '11111111-1111-4111-8111-111111111111'};

test('draft sync explicitly addresses the selected system and keeps polling read-only', async () => {
  for (const action of ['refresh', 'status', 'replace', 'restore']) {
    const requests = [];
    const expected = action === 'refresh' ? {...view, operation: options.requestId.replaceAll('-', '')} : view;
    const result = await draftSyncRequest(data, action, {...options, request: async (url, init) => {
      requests.push({url, init}); return {ok: true, text: async () => JSON.stringify({ok: true, draftSync: expected})};
    }});
    assert.deepEqual(result, expected);
    const {url, init} = requests[0];
    assert.equal(url.hash, '');
    assert.equal(url.pathname, action === 'status' ? '/view/draft-sync-status' : '/view/draft-sync');
    assert.equal(init.headers['X-Z2MA-System-ID'], context.systemId);
    assert.equal(init.headers['X-Z2MA-Generation'], '3');
    assert.equal(init.headers['X-Z2MA-Fingerprint'], context.fingerprint);
    assert.equal(init.method, action === 'status' ? 'GET' : 'POST');
    assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error');
    assert.equal(init.headers['X-Z2MA-Read-Token'], 'private-token');
    if (action === 'status') assert.equal(init.body, undefined);
    else assert.deepEqual(JSON.parse(init.body), {requestId: options.requestId, action, operation: action === 'refresh' ? '' : view.operation});
    assert.equal(requests.length, 1);
  }
});

test('draft sync rejects foreign, superseded, malformed and oversized responses', async () => {
  for (const invalid of [ {...view, systemId: 'other'}, {...view, generation: 4}, {...view, operation: 'c'.repeat(32)},
    {...view, phase: 'activated'}, {...view, remoteRevision: -1}, {...view, canReplace: 'yes'}, {...view, counts: {added: 201, changed: 0, removed: 0}},
    {...view, fingerprint: 'invalid'}]) {
    await assert.rejects(draftSyncRequest(data, 'replace', {...options, request: async () => ({ok: true, text: async () => JSON.stringify({ok: true, draftSync: invalid})})}));
  }
  await assert.rejects(draftSyncRequest(data, 'refresh', {...options, request: async () => ({ok: true, text: async () => ' '.repeat(16385)})}));
});

test('ambiguous draft update failures are never retried', async () => {
  let calls = 0;
  await assert.rejects(draftSyncRequest(data, 'refresh', {...options, request: async () => { calls++; throw new Error('lost response'); }}));
  assert.equal(calls, 1);
  await assert.rejects(draftSyncRequest(data, 'activate', {...options, request: async () => { calls++; }}));
  assert.equal(calls, 1, 'unsupported commands do not reach the transport');
});
