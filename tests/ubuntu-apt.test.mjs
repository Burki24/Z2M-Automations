import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {load} from 'js-yaml';
import {installUbuntuPackages, officialUbuntuSources, executeApt} from '../scripts/ubuntu-apt.mjs';

const ok = {status: 0, stdout: '', stderr: ''};
const dns = {status: 100, stderr: "Temporary failure resolving 'azure.archive.ubuntu.com'"};
const official = ['-o', 'Dir::Etc::sourcelist=/synthetic/ubuntu.sources', '-o', 'Dir::Etc::sourceparts=-',
  '-o', 'Dir::State::lists=/synthetic/lists'];
const phase = args => args.includes('update') ? 'update' : args.includes('--download-only') ? 'download' : 'install';

function fixture(results, more = {}) {
  const calls = []; const waits = []; const events = []; let fallbacks = 0; let verified = 0;
  return {calls, waits, events, get fallbacks() { return fallbacks; }, get verified() { return verified; },
    options: {report: text => events.push(text), wait: async ms => waits.push(ms),
      fallback: async () => { fallbacks++; return official; }, officialVerified: async () => { verified++; },
      run: (args, timeout) => {
        calls.push({phase: phase(args), mirror: args.includes('Dir::Etc::sourceparts=-') ? 'official' : 'runner', args, timeout});
        const result = results.shift(); assert.ok(result, 'unexpected extra privileged operation'); return result;
      }, ...more}};
}

test('APT success verifies metadata and downloads before installing once without network access', async () => {
  const f = fixture([ok, ok, ok]); await installUbuntuPackages(['fakeroot', 'xvfb'], f.options);
  assert.deepEqual(f.calls.map(call => call.phase), ['update', 'download', 'install']);
  assert.ok(f.calls[0].args.includes('--error-on=any'));
  assert.ok(f.calls.every(call => call.args.includes('Acquire::Retries=0')));
  assert.ok(f.calls.every(call => call.args.includes('Acquire::https::Verify-Peer=true') && call.args.includes('Acquire::https::Verify-Host=true')));
  assert.ok(f.calls.every(call => call.args.includes('Acquire::AllowInsecureRepositories=false') && call.args.includes('APT::Get::AllowUnauthenticated=false')));
  assert.ok(f.calls[2].args.includes('--no-download')); assert.equal(f.fallbacks, 0); assert.equal(f.verified, 0);
  assert.deepEqual(f.waits, []); assert.ok(f.calls.every(call => call.timeout > 0 && call.timeout <= 120000));
});

test('APT DNS failures retry twice then validate isolated official indexes before downloading', async () => {
  const f = fixture([dns, dns, ok, ok, ok]); await installUbuntuPackages(['libnotify4'], f.options);
  assert.deepEqual(f.calls.map(call => [call.phase, call.mirror]), [['update', 'runner'], ['update', 'runner'],
    ['update', 'official'], ['download', 'official'], ['install', 'official']]);
  assert.deepEqual(f.waits, [1000]); assert.equal(f.fallbacks, 1); assert.equal(f.verified, 1);
  for (const call of f.calls.filter(call => call.mirror === 'official')) {
    assert.ok(call.args.includes('Dir::Etc::sourceparts=-')); assert.ok(call.args.includes('Dir::State::lists=/synthetic/lists'));
  }
});

test('a successful retry keeps the runner sources and does not invoke fallback', async () => {
  const f = fixture([dns, ok, ok, ok]); await installUbuntuPackages(['dpkg'], f.options);
  assert.equal(f.fallbacks, 0); assert.deepEqual(f.waits, [1000]); assert.equal(f.calls.filter(call => call.phase === 'install').length, 1);
});

test('download failure switches mirrors and refreshes signed metadata instead of replaying installation', async () => {
  const f = fixture([ok, dns, dns, ok, ok, ok]); await installUbuntuPackages(['/synthetic/app.deb'], f.options);
  assert.deepEqual(f.calls.map(call => call.phase), ['update', 'download', 'download', 'update', 'download', 'install']);
  assert.equal(f.calls.filter(call => call.phase === 'install').length, 1);
  assert.ok(f.calls.at(-1).args.includes('/synthetic/app.deb'));
});

test('zero exit with stale-index warnings is not accepted as an updated repository', async () => {
  const stale = {status: 0, stderr: "W: Failed to fetch mirror+file:/synthetic Temporary failure resolving 'azure.archive.ubuntu.com'\nW: Some index files failed to download. They have been ignored, or old ones used instead."};
  const f = fixture([stale, stale, ok, ok, ok]); await installUbuntuPackages(['openssl'], f.options);
  assert.equal(f.calls.find(call => call.phase === 'download').mirror, 'official'); assert.equal(f.fallbacks, 1);
});

test('all acquisition attempts are bounded and a failed fallback cannot start installation', async () => {
  const f = fixture([dns, dns, dns, dns]);
  await assert.rejects(installUbuntuPackages(['xvfb'], f.options), /acquisition failed/);
  assert.equal(f.calls.length, 4); assert.deepEqual(f.waits, [1000, 1000]); assert.equal(f.verified, 0);
  assert.ok(f.calls.every(call => call.phase === 'update'));
});

test('a previously verified official selection is reused without contacting the broken runner mirror', async () => {
  const f = fixture([ok, ok, ok], {preferOfficial: true}); await installUbuntuPackages(['/synthetic/app.deb'], f.options);
  assert.ok(f.calls.every(call => call.mirror === 'official')); assert.equal(f.fallbacks, 1); assert.equal(f.verified, 1);
});

test('signature, checksum, TLS, dependency and process failures are terminal rather than hidden by retries', async () => {
  for (const result of [{status: 100, stderr: 'NO_PUBKEY synthetic'}, {status: 100, stderr: 'Hash Sum mismatch'},
    {status: 100, stderr: 'Certificate verification failed'}, {status: 100, stderr: 'E: Unable to locate package synthetic'},
    {status: 100, stderr: 'Unmet dependencies'}, {status: null, error: {code: 'ENOENT'}},
    {status: 0, stderr: 'W: Some index files failed to download.'}]) {
    const f = fixture([result]); await assert.rejects(installUbuntuPackages(['xvfb'], f.options));
    assert.equal(f.calls.length, 1); assert.equal(f.fallbacks, 0); assert.deepEqual(f.waits, []);
  }
});

test('official metadata verification failure prevents both download and the sticky mirror preference', async () => {
  const f = fixture([dns, dns, {status: 100, stderr: 'The repository is not signed.'}]);
  await assert.rejects(installUbuntuPackages(['openssl'], f.options), /verification/);
  assert.equal(f.verified, 0); assert.ok(f.calls.every(call => call.phase === 'update'));
});

test('offline installation failure is reported once without any retry or mirror change', async () => {
  for (const failure of [dns, {status: 1, stderr: 'dpkg: error processing package'}, {status: 124}]) {
    const f = fixture([ok, ok, failure]); await assert.rejects(installUbuntuPackages(['/synthetic/app.deb'], f.options), /will not be repeated/);
    assert.deepEqual(f.calls.map(call => call.phase), ['update', 'download', 'install']); assert.equal(f.fallbacks, 0);
  }
});

test('acquisition timeouts consume a shared four-minute budget and cannot run indefinitely', async () => {
  let now = 0;
  const f = fixture([], {clock: () => now, wait: async ms => { now += ms; }});
  f.options.run = (args, timeout) => { f.calls.push({phase: phase(args), timeout}); now += timeout; return {status: 124}; };
  await assert.rejects(installUbuntuPackages(['xvfb'], f.options), /budget|acquisition failed/);
  assert.ok(now <= 240000); assert.ok(f.calls.length <= 4); assert.ok(f.calls.every(call => call.timeout <= 60000));
});

test('APT diagnostics do not echo process output, credentials or local package paths', async () => {
  const secret = 'SYNTHETIC_PROXY_PASSWORD';
  const f = fixture([{status: 100, stderr: 'Could not connect to https://user:' + secret + '@proxy.invalid/?token=synthetic'}, ok, ok, ok]);
  await installUbuntuPackages(['/synthetic/private/app.deb'], f.options);
  assert.doesNotMatch(f.events.join('\n'), /SYNTHETIC_PROXY_PASSWORD|proxy\.invalid|\/synthetic\/private|token=|user:/);
});

test('official sources use HTTPS and the installed Ubuntu signing key without Azure, PPAs or stale indexes', () => {
  const os = 'ID=ubuntu\nVERSION_ID="24.04"\nVERSION_CODENAME=noble\n';
  const sources = officialUbuntuSources(os, 'x64');
  assert.match(sources, /URIs: https:\/\/archive\.ubuntu\.com\/ubuntu\//);
  assert.match(sources, /URIs: https:\/\/security\.ubuntu\.com\/ubuntu\//);
  assert.match(sources, /Suites: noble noble-updates noble-backports/); assert.match(sources, /Suites: noble-security/);
  assert.match(sources, /Signed-By: \/usr\/share\/keyrings\/ubuntu-archive-keyring\.gpg/);
  assert.doesNotMatch(sources, /trusted=yes|azure|mirror\+file|ppa|http:\/\//);
  for (const [release, architecture] of [[os.replace('ubuntu', 'debian'), 'x64'], [os, 'arm64'],
    [os.replace('noble', 'untrusted'), 'x64'], [os.replace('24.04', '26.04'), 'x64']]) {
    assert.throws(() => officialUbuntuSources(release, architecture), /limited/);
  }
});

test('invalid package arguments and non-CI execution cannot reach privileged package operations', async () => {
  for (const targets of [[], ['--allow-unauthenticated'], ['xvfb; command'], ['../relative.deb'], ['bad\npackage']]) {
    const f = fixture([]); await assert.rejects(installUbuntuPackages(targets, f.options), /Invalid/); assert.equal(f.calls.length, 0);
  }
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/ubuntu-apt.mjs', import.meta.url)), 'prepare'],
    {encoding: 'utf8', env: {...process.env, GITHUB_ACTIONS: 'false'}, timeout: 5000, windowsHide: true});
  assert.equal(result.status, 1); assert.match(result.stderr, /only on the disposable/);
});

test('privileged APT launcher bounds its process group without a shell or interactive sudo', () => {
  let called = false;
  executeApt(['update', '--error-on=any'], 60000, (command, args, options) => {
    called = true; assert.equal(command, 'sudo'); assert.equal(args[0], '-n');
    assert.ok(args.includes('timeout')); assert.ok(args.includes('--kill-after=5s')); assert.ok(args.includes('60s'));
    assert.ok(args.includes('LC_ALL=C')); assert.ok(args.includes('DEBIAN_FRONTEND=noninteractive'));
    assert.deepEqual(args.slice(-3), ['apt-get', 'update', '--error-on=any']);
    assert.equal(options.shell, undefined); assert.equal(options.timeout, 70000); assert.equal(options.killSignal, 'SIGKILL');
    return ok;
  });
  assert.ok(called);
});

test('workflow protects both APT entry points while keeping installed smoke, removal and artifact gates', () => {
  const workflow = load(readFileSync(new URL('../.github/workflows/desktop.yml', import.meta.url), 'utf8'));
  const steps = workflow.jobs.desktop.steps;
  const prepare = steps.find(step => step.name === 'Install Linux build and display tools');
  const installed = steps.find(step => step.name === 'Verify installed Ubuntu package');
  assert.match(prepare.run, /node scripts\/ubuntu-apt\.mjs prepare/);
  assert.match(installed.run, /node scripts\/ubuntu-apt\.mjs install-deb/);
  assert.match(installed.run, /Z2MA_SMOKE_BINARY=.*npm run smoke/);
  assert.match(installed.run, /sudo apt-get remove --yes z2m-automations/);
  assert.match(installed.run, /test ! -e "\$binary"/);
  assert.equal(installed['continue-on-error'], undefined);
  const upload = steps.find(step => step.with?.name === 'desktop-${{ runner.os }}');
  assert.ok(upload); assert.equal(upload.if, undefined);
});
