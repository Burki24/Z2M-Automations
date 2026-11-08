import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareTools} from '../scripts/setup-tools.mjs';

test('tool setup retries transient Electron download failures with a bounded delay', async () => {
  const calls = []; const waits = []; const messages = [];
  await prepareTools({platform: 'linux', report: text => messages.push(text), wait: async ms => waits.push(ms),
    run: (command, args, options) => {
      calls.push({command, args, options});
      return calls.length < 3 ? {status: 1, stderr: 'HTTPError: Response code 504 (Gateway Time-out)'} : {status: 0};
    }});
  assert.equal(calls.length, 3);
  assert.deepEqual(waits, [1000, 3000]);
  assert.ok(calls.every(call => call.command === process.execPath && call.args[0].replaceAll('\\', '/').endsWith('electron/install.js')));
  assert.ok(calls.every(call => call.options.timeout === 180000 && !call.options.shell));
  assert.ok(messages.some(text => text.includes('attempt 3/3')));
});

test('persistent download failure fails setup after exactly three attempts', async () => {
  let calls = 0; const waits = [];
  await assert.rejects(prepareTools({platform: 'win32', report: () => {}, wait: async ms => waits.push(ms),
    run: () => { calls++; return {status: 1, stderr: 'HTTPError: Response code 503 (Service Unavailable)'}; }}), /Electron.*failed/);
  assert.equal(calls, 3);
  assert.deepEqual(waits, [1000, 3000]);
});

test('permanent, integrity and spawn failures are never retried or ignored', async () => {
  for (const failure of [{status: 1, stderr: 'Checksum mismatch'}, {status: 1, stderr: 'HTTPError: Response code 404 (Not Found)'},
    {status: 1, stderr: 'MODULE_NOT_FOUND'}, {status: null, error: new Error('spawn failed')}]) {
    let calls = 0;
    await assert.rejects(prepareTools({platform: 'linux', report: () => {}, wait: async () => assert.fail('Unexpected retry'),
      run: () => { calls++; return failure; }}));
    assert.equal(calls, 1);
  }
});

test('Windows prepares the reviewed installer helper only after Electron succeeds', async () => {
  const scripts = [];
  await prepareTools({platform: 'win32', report: () => {}, run: (_command, args) => { scripts.push(args[0].replaceAll('\\', '/')); return {status: 0}; }});
  assert.equal(scripts.length, 2);
  assert.ok(scripts[0].endsWith('/electron/install.js'));
  assert.ok(scripts[1].endsWith('/electron-winstaller/script/select-7z-arch.js'));
});

test('local Windows installer helper failures do not trigger download retries', async () => {
  let calls = 0;
  await assert.rejects(prepareTools({platform: 'win32', report: () => {}, wait: async () => assert.fail('Unexpected local helper retry'),
    run: () => (++calls === 1 ? {status: 0} : {status: 1, stderr: 'HTTPError: Response code 504'})}), /Windows installer helper.*failed/);
  assert.equal(calls, 2);
});
