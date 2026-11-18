import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {smokeDeadline, watchSmokeProcess} from '../scripts/smoke-deadline.mjs';

test('smoke deadlines retain the CI default and reject unbounded or malformed overrides', () => {
  assert.equal(smokeDeadline(), 30000);
  assert.equal(smokeDeadline('90000'), 90000);
  for (const value of ['0', '29999', '120001', 'Infinity', '-1', '90000x', '']) assert.throws(() => smokeDeadline(value));
});
test('a smoke child that declines graceful termination is still reaped after the deadline', async t => {
  const child = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000);console.log('READY');"], {windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  await once(child.stdout, 'data');
  let expired = false; const exit = once(child, 'exit');
  watchSmokeProcess(child, 30, () => { expired = true; }, 50);
  let timer;
  try { await Promise.race([exit, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Smoke child was not terminated')), 3000); })]); }
  finally { clearTimeout(timer); }
  assert.equal(expired, true);
  assert.ok(child.signalCode || child.exitCode !== null);
});
