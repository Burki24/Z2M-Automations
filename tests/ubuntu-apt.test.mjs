import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {load} from 'js-yaml';
import {installUbuntuPackages, officialUbuntuSources, executeApt, aptDiagnostics, packagesInstalled, probeUbuntuMirrors} from '../scripts/ubuntu-apt.mjs';

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
    {status: 100, stderr: "The following signatures couldn't be verified"}, {status: 100, stderr: 'At least one invalid signature was encountered'},
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

test('acquisition timeouts consume a shared six-minute budget with separate runner and official limits', async () => {
  let now = 0;
  const f = fixture([], {clock: () => now, wait: async ms => { now += ms; }});
  f.options.run = (args, timeout) => { f.calls.push({phase: phase(args), timeout, official: args.includes('Dir::Etc::sourceparts=-')}); now += timeout; return {status: 124}; };
  await assert.rejects(installUbuntuPackages(['xvfb'], f.options), /budget|acquisition failed/);
  assert.ok(now <= 360000); assert.ok(f.calls.length <= 4);
  assert.ok(f.calls.every(call => call.timeout <= (call.official ? 180000 : 30000)));
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
  assert.match(sources, /Suites: noble noble-updates\n/); assert.match(sources, /Suites: noble-security/);
  assert.match(sources, /Components: main universe\n/); assert.doesNotMatch(sources, /restricted|multiverse|noble-backports/);
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

test('existing build packages skip repository traffic only after a complete installed-state check', async () => {
  const f = fixture([], {installed: targets => targets.length === 2, probe: () => assert.fail('No network probe for installed tools')});
  await installUbuntuPackages(['fakeroot', 'xvfb'], f.options);
  assert.equal(f.calls.length, 0); assert.equal(f.fallbacks, 0);
  assert.ok(f.events.some(event => event.includes('installed-check')));
  const deb = fixture([ok, ok, ok], {installed: () => assert.fail('Never skip a built application installation')});
  await installUbuntuPackages(['/synthetic/app.deb'], deb.options);
  assert.equal(deb.calls.filter(call => call.phase === 'install').length, 1);
});

test('dpkg readiness requires installed status for every package, not unpacked or partial output', () => {
  const invoke = stdout => (command, args, options) => {
    assert.equal(command, 'dpkg-query'); assert.ok(args.includes('--showformat=${binary:Package}\t${db:Status-Status}\n'));
    assert.equal(options.shell, undefined); assert.equal(options.timeout, 5000);
    return {status: 0, stdout};
  };
  assert.equal(packagesInstalled(['fakeroot', 'xvfb'], invoke('fakeroot:amd64\tinstalled\nxvfb\tinstalled\n')), true);
  assert.equal(packagesInstalled(['fakeroot', 'xvfb'], invoke('fakeroot\tinstalled\nxvfb\tunpacked\n')), false);
  assert.equal(packagesInstalled(['fakeroot', 'xvfb'], invoke('fakeroot\tinstalled\n')), false);
  assert.equal(packagesInstalled(['fakeroot'], () => ({status: 1, stdout: 'fakeroot\tinstalled\n'})), false);
});

test('mirror probes use verified HTTPS and select IPv4 only after both official endpoints respond', () => {
  const messages = []; let calls = 0;
  const route = probeUbuntuMirrors({report: text => messages.push(text), run: (command, args) => {
    calls++;
    if (command === 'getent') return {status: 2, stderr: 'SYNTHETIC_PRIVATE_VALUE'};
    assert.equal(command, 'curl'); assert.ok(args.includes('--ipv4')); assert.ok(args.includes('--max-time'));
    assert.ok(args.includes('=https')); assert.ok(args.at(-1).endsWith('/InRelease')); assert.ok(!args.includes('--insecure'));
    return {status: 0, stdout: '200 0.125000'};
  }});
  assert.deepEqual(route, {forceIPv4: true, preferOfficial: true}); assert.equal(calls, 3);
  assert.ok(!messages.join('\n').includes('SYNTHETIC_PRIVATE_VALUE'));
  const unavailable = probeUbuntuMirrors({report: () => {}, run: command => command === 'getent'
    ? {status: 0, stdout: '192.0.2.10 STREAM synthetic\n'} : {status: 60, stdout: '000 0.3'}});
  assert.deepEqual(unavailable, {forceIPv4: false, preferOfficial: false});
  let endpoints = 0;
  const partial = probeUbuntuMirrors({report: () => {}, run: command => command === 'getent' ? {status: 2} : ++endpoints === 1
    ? {status: 0, stdout: '200 0.01'} : {status: 6, stdout: '000 0.02'}});
  assert.deepEqual(partial, {forceIPv4: false, preferOfficial: false});
});

test('successful signature confirmation is not mistaken for failed verification', async () => {
  const f = fixture([{status: 0, stdout: 'Repository signatures verified\n'}, ok, ok]);
  await installUbuntuPackages(['dpkg'], f.options);
  assert.equal(f.calls.at(-1).phase, 'install');
});

test('a measured IPv4 route bypasses unresolved Azure without bypassing signed metadata or installation checks', async () => {
  const f = fixture([ok, ok, ok], {probe: () => ({forceIPv4: true, preferOfficial: true})});
  await installUbuntuPackages(['libsecret-1-0'], f.options);
  assert.ok(f.calls.every(call => call.mirror === 'official' && call.args.includes('Acquire::ForceIPv4=true')));
  assert.ok(f.calls[0].args.includes('--error-on=any')); assert.equal(f.verified, 1);
  assert.equal(f.calls.filter(call => call.phase === 'install').length, 1);
});

test('a progressing cold official index update gets enough time instead of being cut off after sixty seconds', async () => {
  const f = fixture([], {probe: () => ({forceIPv4: true, preferOfficial: true})});
  f.options.run = (args, timeout) => {
    f.calls.push({phase: phase(args), timeout});
    if (phase(args) === 'update' && timeout < 90000) return {status: 124, stdout: 'Get:1 https://archive.ubuntu.com/ubuntu noble InRelease [256 kB]'};
    return ok;
  };
  await installUbuntuPackages(['xvfb'], f.options);
  assert.deepEqual(f.calls.map(call => call.phase), ['update', 'download', 'install']); assert.equal(f.calls[0].timeout, 180000);
});

test('bounded APT progress diagnostics show the actual mirror and error category without echoing private text', () => {
  const lines = Array.from({length: 20}, (_, index) => `Ign:${index + 1} https://user:SYNTHETIC_SECRET@archive.ubuntu.com/ubuntu?token=SECRET noble-updates/main amd64 Packages`);
  lines.push('Err:21 https://private.invalid/secret noble InRelease', "Temporary failure resolving 'private.invalid'", 'Permission denied: /home/private/value');
  const info = aptDiagnostics({stdout: lines.join('\n'), stderr: 'timeout: sending signal TERM to command apt-get'});
  assert.equal(info.counts.Ign, 20); assert.equal(info.counts.Err, 1); assert.equal(info.recent.length, 8);
  assert.equal(info.recent[0].host, 'archive.ubuntu.com'); assert.equal(info.recent.at(-1).host, 'other');
  assert.deepEqual(info.errors, ['dns', 'permission']); assert.ok(info.stdoutBytes > 0);
  assert.doesNotMatch(JSON.stringify(info), /SYNTHETIC_SECRET|SECRET|token=|private\.invalid|\/home\/private/);
});

test('a real subprocess produces diagnosable partial APT progress instead of reducing everything to timeout', () => {
  const output = spawnSync(process.execPath, ['-e', "process.stdout.write('Get:1 https://archive.ubuntu.com/ubuntu noble InRelease [256 kB]\\n'); process.stderr.write('Certificate verification failed\\n'); process.exitCode = 100;"],
    {encoding: 'utf8', timeout: 5000, windowsHide: true});
  const info = aptDiagnostics(output);
  assert.equal(output.status, 100); assert.equal(info.recent[0].host, 'archive.ubuntu.com'); assert.equal(info.recent[0].kind, 'InRelease');
  assert.deepEqual(info.errors, ['tls']);
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
