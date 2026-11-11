import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough, Writable} from 'node:stream';
import {withWindowsFileLock} from './support/windows-lock.mjs';

const flush = () => new Promise(resolve => setImmediate(resolve));
function harness({release = 'clean', killCloses = true} = {}) {
  let now = 0; let next = 0; const timers = new Map();
  const clock = {now: () => now, setTimeout: (callback, delay) => { const id = ++next; timers.set(id, {callback, at: now + delay}); return id; }, clearTimeout: id => timers.delete(id)};
  const child = new EventEmitter(); child.pid = 123; child.stdout = new PassThrough(); child.stderr = new PassThrough();
  const close = (code, signal = null) => { child.exitCode = code; child.emit('close', code, signal); };
  child.stdin = new Writable({write(_chunk, _encoding, done) { done(); }, final(done) {
    if (release !== 'hang') {
      if (release === 'clean') child.stdout.write('LOCK_RELEASED\n');
      queueMicrotask(() => close(0));
    }
    done();
  }});
  let kills = 0; let unrefs = 0;
  child.kill = () => { kills++; if (killCloses) queueMicrotask(() => close(null, 'SIGTERM')); return killCloses; };
  child.unref = () => { unrefs++; };
  const reports = [];
  return {child, close, reports, timers, kills: () => kills, unrefs: () => unrefs, options: {clock, spawnProcess: () => {
    queueMicrotask(() => child.emit('spawn')); return child;
  }, report: state => reports.push(state)}, advance: async milliseconds => {
    now += milliseconds;
    for (const [id, entry] of [...timers]) if (entry.at <= now) { timers.delete(id); entry.callback(); }
    await flush();
  }};
}

test('a delayed lock startup beyond the former ten-second limit waits for the full readiness signal', async () => {
  const h = harness(); let calls = 0;
  const result = withWindowsFileLock('synthetic', async () => { calls++; return 42; }, h.options);
  await flush(); h.child.stdout.write('LOCK_STARTING\n');
  await h.advance(12000);
  assert.equal(calls, 0); assert.equal(h.kills(), 0);
  h.child.stdout.write('LOCK_RE'); await flush(); assert.equal(calls, 0);
  h.child.stdout.write('ADY\r\n');
  assert.equal(await result, 42); assert.equal(calls, 1);
  assert.equal(h.reports[0].elapsedMs, 12000); assert.equal(h.reports.at(-1).released, true);
  assert.equal(h.reports.at(-1).closed, true); assert.equal(h.timers.size, 0);
});

test('early exit reports its code and safe exception metadata without raw process output', async () => {
  const h = harness();
  const result = withWindowsFileLock('synthetic', () => assert.fail('Lock was never ready'), h.options);
  const rejected = assert.rejects(result, error => {
    assert.match(error.message, /earlyExit.*"exitCode":17/);
    assert.match(error.message, /"exception":"IOException"/);
    assert.match(error.message, /"hresult":-2147024864/);
    assert.doesNotMatch(error.message, /PRIVATE_PROCESS_OUTPUT/); return true;
  });
  await flush(); h.child.stderr.write('PRIVATE_PROCESS_OUTPUT\nLOCK_ERROR IOException -2147024864\n'); h.close(17);
  await rejected; assert.equal(h.kills(), 0); assert.equal(h.timers.size, 0);
});

test('spawn failures reject immediately with an error code and cannot invoke the save assertion', async () => {
  const h = harness();
  const result = withWindowsFileLock('synthetic', () => assert.fail('No process was started'), h.options);
  const rejected = assert.rejects(result, /spawnError.*ENOENT/);
  await flush(); h.child.emit('error', Object.assign(new Error('PRIVATE_SPAWN_ERROR'), {code: 'ENOENT'})); h.close(-2);
  await rejected; assert.equal(h.reports.at(-1).exitCode, -2); assert.equal(h.timers.size, 0);
});

test('startup timeout terminates and awaits the helper before returning failure', async () => {
  const h = harness();
  const result = withWindowsFileLock('synthetic', () => assert.fail('No lock was acquired'), h.options);
  const rejected = assert.rejects(result, /startupTimeout/);
  await flush(); await h.advance(30000); await rejected;
  assert.equal(h.kills(), 1); assert.equal(h.reports.at(-1).closed, true); assert.equal(h.timers.size, 0);
});

test('a helper that exits immediately after readiness cannot run the save assertion', async () => {
  const h = harness();
  const result = withWindowsFileLock('synthetic', () => assert.fail('The lock holder has exited'), h.options);
  const rejected = assert.rejects(result, /exitedBeforeAssertion/);
  await flush(); h.child.stdout.write('LOCK_READY\n'); h.child.stdout.write('LOCK_RELEASED\n'); h.close(0);
  await rejected; assert.equal(h.timers.size, 0);
});

test('a failed save assertion still releases and awaits the helper', async () => {
  const h = harness(); const original = new Error('Synthetic assertion failure');
  const result = withWindowsFileLock('synthetic', () => { throw original; }, h.options);
  const rejected = assert.rejects(result, error => error === original);
  await flush(); h.child.stdout.write('LOCK_READY\n'); await rejected;
  assert.equal(h.reports.at(-1).released, true); assert.equal(h.reports.at(-1).closed, true);
  assert.equal(h.kills(), 0); assert.equal(h.timers.size, 0);
});

test('a hung shutdown is bounded, terminated and reported instead of passing', async () => {
  const h = harness({release: 'hang'});
  const result = withWindowsFileLock('synthetic', () => {}, h.options);
  const rejected = assert.rejects(result, /shutdownTimeout/);
  await flush(); h.child.stdout.write('LOCK_READY\n'); await flush();
  await h.advance(5000); await rejected;
  assert.equal(h.kills(), 1); assert.equal(h.reports.at(-1).closed, true); assert.equal(h.timers.size, 0);
});

test('a clean exit without confirming lock release is not accepted', async () => {
  const h = harness({release: 'noMarker'});
  const result = withWindowsFileLock('synthetic', () => {}, h.options);
  const rejected = assert.rejects(result, /uncleanExit/);
  await flush(); h.child.stdout.write('LOCK_READY\n'); await rejected;
  assert.equal(h.timers.size, 0);
});

test('repeated termination errors cannot hang cleanup or hide the original startup failure', async () => {
  const h = harness({killCloses: false});
  const kill = h.child.kill;
  h.child.kill = () => { const killed = kill(); h.child.emit('error', Object.assign(new Error('PRIVATE_KILL_ERROR'), {code: 'EPERM'})); return killed; };
  const result = withWindowsFileLock('synthetic', () => assert.fail('No lock was acquired'), h.options);
  const rejected = assert.rejects(result, error => {
    assert.ok(error instanceof AggregateError);
    assert.match(error.errors[0].message, /startupTimeout/); assert.match(error.errors[1].message, /killTimeout/);
    assert.doesNotMatch(error.message, /PRIVATE_KILL_ERROR/); return true;
  });
  await flush(); await h.advance(30000); await h.advance(5000); await h.advance(5000); await rejected;
  assert.equal(h.kills(), 2); assert.equal(h.unrefs(), 1); assert.equal(h.timers.size, 0);
});
