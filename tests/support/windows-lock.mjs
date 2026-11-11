import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {basename, join} from 'node:path';

const nativeClock = {now: () => performance.now(), setTimeout, clearTimeout};
function powerShell() {
  const modern = join(process.env.ProgramFiles ?? 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe');
  return existsSync(modern) ? modern : 'powershell.exe';
}

const script = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::WriteLine('LOCK_STARTING')
[Console]::Out.Flush()
$stream = $null
try {
  $stream = [System.IO.File]::Open($env:Z2MA_LOCK_FILE, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
  [Console]::WriteLine('LOCK_READY')
  [Console]::Out.Flush()
  [Console]::ReadLine() | Out-Null
} catch {
  $failure = $_.Exception
  while ($null -ne $failure.InnerException) { $failure = $failure.InnerException }
  [Console]::Error.WriteLine('LOCK_ERROR ' + $failure.GetType().Name + ' ' + $failure.HResult)
  exit 1
} finally {
  if ($null -ne $stream) {
    $stream.Dispose()
    [Console]::WriteLine('LOCK_RELEASED')
    [Console]::Out.Flush()
  }
}
`;

// Test-only lifecycle. Diagnostics allow fixed process metadata, never raw output or file paths.
export async function withWindowsFileLock(path, action, {spawnProcess = spawn, clock = nativeClock,
  executable = powerShell(), startupTimeout = 30000, shutdownTimeout = 5000, report = () => {}} = {}) {
  const began = clock.now();
  const state = {shell: basename(executable), pid: null, phase: 'spawn', ready: false, released: false, closed: false,
    exitCode: null, signal: null, spawnError: null, stdinError: null, exception: null, hresult: null,
    stdoutBytes: 0, stderrBytes: 0, killRequests: 0};
  const diagnostic = () => ({...state, elapsedMs: Math.round(clock.now() - began)});
  const failure = reason => new Error('Windows lock helper ' + reason + ': ' + JSON.stringify(diagnostic()));
  const errorCode = error => /^[A-Z][A-Z0-9_]{0,31}$/.test(error?.code) ? error.code : 'UNKNOWN';
  const ready = Promise.withResolvers(); const closed = Promise.withResolvers();
  const wait = (promise, milliseconds, reason) => {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => {
      timer = clock.setTimeout(() => reject(failure(reason)), milliseconds);
    })]).finally(() => clock.clearTimeout(timer));
  };
  const emit = () => { try { report(diagnostic()); } catch { /* Reporting cannot alter locking. */ } };
  let child;
  try {
    child = spawnProcess(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      {windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: {...process.env, Z2MA_LOCK_FILE: path,
        POWERSHELL_TELEMETRY_OPTOUT: '1', POWERSHELL_UPDATECHECK: 'Off'}});
  } catch (error) { state.spawnError = errorCode(error); throw failure('spawnError'); }
  child.once('spawn', () => { state.pid = child.pid ?? null; state.phase = 'starting'; });
  child.on('error', error => { state.spawnError = errorCode(error); ready.reject(failure('spawnError')); });
  child.once('close', (code, signal) => {
    state.closed = true; state.exitCode = code; state.signal = signal;
    closed.resolve();
    if (!state.ready) ready.reject(failure('earlyExit'));
  });
  child.stdin.on('error', error => { state.stdinError = errorCode(error); });
  for (const channel of ['stdout', 'stderr']) {
    let partial = '';
    child[channel].on('data', data => {
      state[channel + 'Bytes'] = Math.min(1000000000, state[channel + 'Bytes'] + Buffer.byteLength(data));
      const lines = (partial + data.toString('utf8')).split(/\r?\n/); partial = lines.pop().slice(-2048);
      for (const line of lines) {
        if (channel === 'stdout' && line === 'LOCK_STARTING') state.phase = 'acquiring';
        if (channel === 'stdout' && line === 'LOCK_READY') { state.phase = 'locked'; state.ready = true; ready.resolve(); }
        if (channel === 'stdout' && line === 'LOCK_RELEASED') { state.phase = 'released'; state.released = true; }
        const match = channel === 'stderr' && /^LOCK_ERROR ([A-Za-z][A-Za-z0-9]{0,63}) (-?\d{1,11})$/.exec(line);
        if (match) { state.exception = match[1]; state.hresult = Number(match[2]); }
      }
    });
  }
  let result; let actionError;
  try {
    await wait(ready.promise, startupTimeout, 'startupTimeout');
    if (state.closed) throw failure('exitedBeforeAssertion');
    emit(); result = await action();
  } catch (error) { actionError = error; }
  try {
    if (!state.closed) {
      if (state.ready) child.stdin.end('\n');
      else { state.killRequests++; child.kill(); }
      try { await wait(closed.promise, shutdownTimeout, 'shutdownTimeout'); }
      catch (error) {
        state.killRequests++; child.kill();
        try { await wait(closed.promise, shutdownTimeout, 'killTimeout'); }
        catch (killError) { child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy(); child.unref(); throw killError; }
        throw error;
      }
    }
    if (state.ready && (!state.released || state.exitCode !== 0 || state.stdinError)) throw failure('uncleanExit');
  } catch (error) {
    if (actionError) throw new AggregateError([actionError, error], failure('cleanupFailed').message);
    throw error;
  } finally { emit(); }
  if (actionError) throw actionError;
  return result;
}
