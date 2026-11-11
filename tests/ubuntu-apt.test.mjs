import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chmod, mkdtemp, readFile, rm, rmdir, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {load} from 'js-yaml';
import {installUbuntuPackages, ubuntuSources, executeApt, aptDiagnostics, packagesInstalled, probeUbuntuMirrors,
  assertAptAccess, createAptWorkspace, prepareUbuntuSources, stageLocalPackage} from '../scripts/ubuntu-apt.mjs';

const ok = {status: 0, stdout: '', stderr: ''};
const httpsOK = {status: 0, stdout: '200 0.010000 0.020000 0.040000 0.125000'};
const dns = {status: 100, stderr: "Temporary failure resolving 'archive.ubuntu.com'"};
const os = 'ID=ubuntu\nVERSION_ID="24.04"\nVERSION_CODENAME=noble\n';
const phase = args => args.includes('update') ? 'update' : args.includes('--download-only') ? 'download' : 'install';
const sourceOptions = repository => ['-o', 'Dir::Etc::sourcelist=/synthetic/' + repository + '.sources',
  '-o', 'Dir::Etc::sourceparts=-', '-o', 'Dir::State::lists=/synthetic/lists', '-o', 'Dir::Cache::archives=/synthetic/archives'];

function fixture(results, more = {}) {
  const calls = []; const waits = []; const events = []; const sources = []; const verified = [];
  return {calls, waits, events, sources, verified,
    options: {report: text => events.push(text), wait: async ms => waits.push(ms),
      probe: () => ({forceIPv4: true, repositories: ['official', 'kernel']}),
      fallback: async repository => { sources.push(repository); return sourceOptions(repository); },
      repositoryVerified: async repository => { verified.push(repository); },
      run: (args, timeout) => {
        const mirror = /\/([^/]+)\.sources$/.exec(args.find(arg => arg.startsWith('Dir::Etc::sourcelist=')))?.[1];
        calls.push({phase: phase(args), mirror, args, timeout});
        const result = results.shift(); assert.ok(result, 'unexpected extra privileged operation'); return result;
      }, ...more}};
}

test('APT success verifies isolated metadata and downloads before installing once without network access', async () => {
  const f = fixture([ok, ok, ok]); await installUbuntuPackages(['fakeroot', 'xvfb'], f.options);
  assert.deepEqual(f.calls.map(call => call.phase), ['update', 'download', 'install']);
  assert.ok(f.calls[0].args.includes('--error-on=any'));
  assert.ok(f.calls.every(call => call.args.includes('Acquire::Retries=0')));
  assert.ok(f.calls.every(call => call.args.includes('Acquire::https::Verify-Peer=true') && call.args.includes('Acquire::https::Verify-Host=true')));
  assert.ok(f.calls.every(call => call.args.includes('Acquire::AllowInsecureRepositories=false') && call.args.includes('APT::Get::AllowUnauthenticated=false')));
  assert.ok(f.calls.every(call => call.args.includes('Dir::Etc::sourceparts=-') && call.args.includes('Dir::Cache::archives=/synthetic/archives')));
  assert.ok(f.calls[2].args.includes('--no-download')); assert.deepEqual(f.sources, ['official']); assert.deepEqual(f.verified, ['official']);
  assert.deepEqual(f.waits, []); assert.ok(f.calls.every(call => call.timeout > 0 && call.timeout <= 180000));
});

test('APT DNS failures retry twice then verify an independently hosted mirror before downloading', async () => {
  const f = fixture([dns, dns, ok, ok, ok]); await installUbuntuPackages(['libnotify4'], f.options);
  assert.deepEqual(f.calls.map(call => [call.phase, call.mirror]), [['update', 'official'], ['update', 'official'],
    ['update', 'kernel'], ['download', 'kernel'], ['install', 'kernel']]);
  assert.deepEqual(f.waits, [1000]); assert.deepEqual(f.sources, ['official', 'kernel']); assert.deepEqual(f.verified, ['kernel']);
});

test('a successful retry keeps the selected repository without changing to a different mirror', async () => {
  const f = fixture([dns, ok, ok, ok]); await installUbuntuPackages(['dpkg'], f.options);
  assert.deepEqual(f.sources, ['official']); assert.deepEqual(f.waits, [1000]);
  assert.equal(f.calls.filter(call => call.phase === 'install').length, 1);
});

test('download failure refreshes fallback metadata rather than replaying installation', async () => {
  const f = fixture([ok, dns, dns, ok, ok, ok]); await installUbuntuPackages(['/synthetic/app.deb'], f.options);
  assert.deepEqual(f.calls.map(call => call.phase), ['update', 'download', 'download', 'update', 'download', 'install']);
  assert.equal(f.calls.filter(call => call.phase === 'install').length, 1);
  assert.ok(f.calls.at(-1).args.includes('/synthetic/app.deb')); assert.deepEqual(f.verified, ['official', 'kernel']);
});

test('zero exit with stale-index warnings is not accepted as an updated repository', async () => {
  const stale = {status: 0, stderr: "W: Failed to fetch mirror+file:/synthetic Temporary failure resolving 'archive.ubuntu.com'\nW: Some index files failed to download. They have been ignored, or old ones used instead."};
  const f = fixture([stale, stale, ok, ok, ok]); await installUbuntuPackages(['openssl'], f.options);
  assert.equal(f.calls.find(call => call.phase === 'download').mirror, 'kernel');
});

test('all acquisition attempts are bounded and failed mirrors cannot start installation', async () => {
  const f = fixture([dns, dns, dns, dns]);
  await assert.rejects(installUbuntuPackages(['xvfb'], f.options), /acquisition failed/);
  assert.equal(f.calls.length, 4); assert.deepEqual(f.waits, [1000, 1000]); assert.deepEqual(f.verified, []);
  assert.ok(f.calls.every(call => call.phase === 'update'));
});

test('a previously verified independent mirror is re-probed and preferred in the next job step', async () => {
  const probed = [];
  const route = probeUbuntuMirrors({preferred: 'osuosl', report: () => {}, run: (command, args) => {
    if (command === 'getent') return {status: 2};
    probed.push(new URL(args.at(-1)).hostname); return httpsOK;
  }});
  assert.deepEqual(route.repositories, ['osuosl', 'official']); assert.equal(probed[0], 'ftp.osuosl.org');
  const f = fixture([ok, ok, ok], {probe: () => route});
  await installUbuntuPackages(['/synthetic/app.deb'], f.options);
  assert.ok(f.calls.every(call => call.mirror === 'osuosl')); assert.deepEqual(f.verified, ['osuosl']);
});

test('signature, checksum, TLS, dependency and process failures are terminal rather than hidden by retries', async () => {
  for (const result of [{status: 100, stderr: 'NO_PUBKEY synthetic'}, {status: 100, stderr: 'Hash Sum mismatch'},
    {status: 100, stderr: "The following signatures couldn't be verified"}, {status: 100, stderr: 'At least one invalid signature was encountered'},
    {status: 100, stderr: 'Certificate verification failed'}, {status: 100, stderr: 'E: Unable to locate package synthetic'},
    {status: 100, stderr: 'Unmet dependencies'}, {status: null, error: {code: 'ENOENT'}},
    {status: 0, stderr: 'W: Some index files failed to download.'}]) {
    const f = fixture([result]); await assert.rejects(installUbuntuPackages(['xvfb'], f.options));
    assert.equal(f.calls.length, 1); assert.deepEqual(f.sources, ['official']); assert.deepEqual(f.waits, []);
  }
});

test('unverified fallback metadata prevents both download and the persisted mirror preference', async () => {
  const f = fixture([dns, dns, {status: 100, stderr: 'The repository is not signed.'}]);
  await assert.rejects(installUbuntuPackages(['openssl'], f.options), /verification/);
  assert.deepEqual(f.verified, []); assert.ok(f.calls.every(call => call.phase === 'update'));
});

test('offline installation failure is reported once without any retry or mirror change', async () => {
  for (const failure of [dns, {status: 1, stderr: 'dpkg: error processing package'}, {status: 124}]) {
    const f = fixture([ok, ok, failure]); await assert.rejects(installUbuntuPackages(['/synthetic/app.deb'], f.options), /will not be repeated/);
    assert.deepEqual(f.calls.map(call => call.phase), ['update', 'download', 'install']); assert.deepEqual(f.sources, ['official']);
  }
});

test('an unexpected root-download fallback is a permission failure even when APT exits successfully', async () => {
  const warning = {status: 0, stderr: "N: Download is performed unsandboxed as root as file '/synthetic/package.deb' couldn't be accessed by user '_apt'."};
  const f = fixture([ok, warning]);
  await assert.rejects(installUbuntuPackages(['/synthetic/app.deb'], f.options), /sandbox-access/);
  assert.deepEqual(f.calls.map(call => call.phase), ['update', 'download']); assert.deepEqual(f.sources, ['official']);
});

test('a stalled first mirror cannot consume the fallback share of the six-minute acquisition budget', async () => {
  let now = 0;
  const f = fixture([], {clock: () => now, wait: async ms => { now += ms; }});
  f.options.run = (args, timeout) => { f.calls.push({phase: phase(args), timeout}); now += timeout; return {status: 124}; };
  await assert.rejects(installUbuntuPackages(['xvfb'], f.options), /budget|acquisition failed/);
  assert.ok(now <= 360000); assert.ok(f.calls.length <= 4); assert.deepEqual(f.sources, ['official', 'kernel']);
  assert.ok(f.calls.every(call => call.timeout > 0 && call.timeout <= 180000));
});

test('APT diagnostics do not echo process output, credentials or local package paths', async () => {
  const secret = 'SYNTHETIC_PROXY_PASSWORD';
  const f = fixture([{status: 100, stderr: 'Could not connect to https://user:' + secret + '@proxy.invalid/?token=synthetic'}, ok, ok, ok]);
  await installUbuntuPackages(['/synthetic/private/app.deb'], f.options);
  assert.doesNotMatch(f.events.join('\n'), /SYNTHETIC_PROXY_PASSWORD|proxy\.invalid|\/synthetic\/private|token=|user:/);
});

test('every allowed mirror uses HTTPS and the installed Ubuntu signing key for all three required suites', () => {
  for (const repository of ['official', 'kernel', 'osuosl']) {
    const sources = ubuntuSources(os, 'x64', repository);
    for (const suite of ['noble', 'noble-updates', 'noble-security']) assert.ok(sources.includes(suite));
    assert.match(sources, /Components: main universe\n/); assert.match(sources, /Architectures: amd64\n/);
    assert.match(sources, /Signed-By: \/usr\/share\/keyrings\/ubuntu-archive-keyring\.gpg/);
    assert.doesNotMatch(sources, /trusted=yes|azure|mirror\+file|ppa|http:\/\/|restricted|multiverse|noble-backports/);
  }
  assert.match(ubuntuSources(os, 'x64', 'kernel'), /URIs: https:\/\/mirrors\.edge\.kernel\.org\/ubuntu\//);
  assert.match(ubuntuSources(os, 'x64', 'osuosl'), /URIs: https:\/\/ftp\.osuosl\.org\/pub\/ubuntu\//);
  for (const repository of ['private.invalid', 'https://user:secret@private.invalid/', '__proto__']) {
    assert.throws(() => ubuntuSources(os, 'x64', repository), /Unknown/);
  }
  for (const [release, architecture] of [[os.replace('ubuntu', 'debian'), 'x64'], [os, 'arm64'],
    [os.replace('noble', 'untrusted'), 'x64'], [os.replace('24.04', '26.04'), 'x64']]) {
    assert.throws(() => ubuntuSources(release, architecture), /limited/);
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

test('existing build packages skip staging and network access only after a complete installed-state check', async () => {
  const f = fixture([], {installed: targets => targets.length === 2, probe: () => assert.fail('No network probe for installed tools'),
    prepareTargets: () => assert.fail('No privileged staging for installed tools')});
  await installUbuntuPackages(['fakeroot', 'xvfb'], f.options);
  assert.equal(f.calls.length, 0); assert.deepEqual(f.sources, []);
  assert.ok(f.events.some(event => event.includes('installed-check')));
  const deb = fixture([ok, ok, ok], {installed: () => assert.fail('Never skip a built application installation'),
    prepareTargets: targets => { assert.deepEqual(targets, ['/synthetic/private/app.deb']); return ['/synthetic/public/package.deb']; }});
  await installUbuntuPackages(['/synthetic/private/app.deb'], deb.options);
  assert.ok(deb.calls.slice(1).every(call => call.args.includes('/synthetic/public/package.deb') && !call.args.includes('/synthetic/private/app.deb')));
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

test('mirror probes require all suites over verified HTTPS and report only bounded DNS/TCP/TLS timing fields', () => {
  const messages = []; let calls = 0;
  const route = probeUbuntuMirrors({report: text => messages.push(text), run: (command, args) => {
    calls++;
    if (command === 'getent') return {status: 124, stderr: 'SYNTHETIC_PRIVATE_VALUE'};
    assert.equal(command, 'curl'); assert.ok(args.includes('--ipv4')); assert.ok(args.includes('--max-time'));
    assert.ok(args.includes('=https')); assert.ok(args.at(-1).endsWith('/InRelease')); assert.ok(!args.includes('--insecure'));
    return httpsOK;
  }});
  assert.deepEqual(route, {forceIPv4: true, repositories: ['official', 'kernel']}); assert.equal(calls, 7);
  const event = JSON.parse(messages[1].slice('UBUNTU_APT_PROBE '.length));
  assert.equal(event.lookupSeconds, 0.01); assert.equal(event.connectSeconds, 0.02); assert.equal(event.tlsSeconds, 0.04);
  assert.equal(event.totalSeconds, 0.125); assert.equal(event.suite, 'noble');
  assert.doesNotMatch(messages.join('\n'), /SYNTHETIC_PRIVATE_VALUE/);
});

test('the observed Azure DNS timeout and failed ubuntu.com probes select independently hosted signed repositories', async () => {
  const route = probeUbuntuMirrors({report: () => {}, run: (command, args) => {
    if (command === 'getent') return {status: 124};
    return new URL(args.at(-1)).hostname.endsWith('ubuntu.com') ? {status: 28, stdout: '000 0 0 0 3.001'} : httpsOK;
  }});
  assert.deepEqual(route, {forceIPv4: true, repositories: ['kernel', 'osuosl']});
  const f = fixture([ok, ok, ok], {probe: () => route}); await installUbuntuPackages(['/synthetic/app.deb'], f.options);
  assert.deepEqual(f.calls.map(call => [call.phase, call.mirror]), [['update', 'kernel'], ['download', 'kernel'], ['install', 'kernel']]);
  assert.deepEqual(f.verified, ['kernel']); assert.ok(f.calls[0].args.includes('--error-on=any'));
});

test('an incomplete mirror is excluded and unreachable mirrors cause a bounded failure before APT', async () => {
  const partial = probeUbuntuMirrors({report: () => {}, run: (command, args) => command === 'getent' ? {status: 2}
    : args.at(-1).includes('noble-security') ? {status: 22, stdout: '404 0.01 0.02 0.04 0.1'} : httpsOK});
  assert.deepEqual(partial.repositories, []);
  let probes = 0;
  const unavailable = probeUbuntuMirrors({report: () => {}, run: () => { probes++; return {status: 6, stdout: '000 0 0 0 0.3'}; }});
  assert.equal(probes, 10); assert.deepEqual(unavailable, {forceIPv4: false, repositories: []});
  const f = fixture([], {probe: () => unavailable});
  await assert.rejects(installUbuntuPackages(['xvfb'], f.options), /No Ubuntu mirror/);
  assert.equal(f.calls.length, 0); assert.deepEqual(f.sources, []);
  for (const repositories of [['__proto__'], ['official', 'official'], ['official', 'kernel', 'osuosl']]) {
    const invalid = fixture([], {probe: () => ({forceIPv4: true, repositories})});
    await assert.rejects(installUbuntuPackages(['xvfb'], invalid.options), /Unknown|Invalid/);
    assert.equal(invalid.calls.length, 0);
  }
});

test('successful signature confirmation is not mistaken for failed verification', async () => {
  const f = fixture([{status: 0, stdout: 'Repository signatures verified\n'}, ok, ok]);
  await installUbuntuPackages(['dpkg'], f.options); assert.equal(f.calls.at(-1).phase, 'install');
});

test('a progressing cold index update gets enough time while preserving a fallback budget', async () => {
  const f = fixture([]);
  f.options.run = (args, timeout) => {
    f.calls.push({phase: phase(args), timeout});
    if (phase(args) === 'update' && timeout < 90000) return {status: 124, stdout: 'Get:1 https://archive.ubuntu.com/ubuntu noble InRelease [256 kB]'};
    return ok;
  };
  await installUbuntuPackages(['xvfb'], f.options);
  assert.deepEqual(f.calls.map(call => call.phase), ['update', 'download', 'install']); assert.ok(f.calls[0].timeout >= 90000);
});

test('bounded APT progress distinguishes sandbox fallback without echoing private paths or credentials', () => {
  const lines = Array.from({length: 20}, (_, index) => `Ign:${index + 1} https://user:SYNTHETIC_SECRET@archive.ubuntu.com/ubuntu?token=SECRET noble-updates/main amd64 Packages`);
  lines.push('Err:21 https://private.invalid/secret noble InRelease', "Temporary failure resolving 'private.invalid'",
    "N: Download is performed unsandboxed as root as file '/home/private/value.deb' couldn't be accessed by user '_apt'. - pkgAcquire::Run (13: Permission denied)");
  const info = aptDiagnostics({stdout: lines.join('\n'), stderr: 'timeout: sending signal TERM to command apt-get'});
  assert.equal(info.counts.Ign, 20); assert.equal(info.counts.Err, 1); assert.equal(info.recent.length, 8);
  assert.equal(info.recent[0].host, 'archive.ubuntu.com'); assert.equal(info.recent.at(-1).host, 'other');
  assert.deepEqual(info.errors, ['dns', 'permission']); assert.equal(info.sandboxFallback, true); assert.ok(info.stdoutBytes > 0);
  assert.doesNotMatch(JSON.stringify(info), /SYNTHETIC_SECRET|SECRET|token=|private\.invalid|\/home\/private/);
});

test('a real subprocess produces diagnosable partial APT progress instead of reducing everything to timeout', () => {
  const output = spawnSync(process.execPath, ['-e', "process.stdout.write('Get:1 https://mirrors.edge.kernel.org/ubuntu noble InRelease [256 kB]\\n'); process.stderr.write('Certificate verification failed\\n'); process.exitCode = 100;"],
    {encoding: 'utf8', timeout: 5000, windowsHide: true});
  const info = aptDiagnostics(output);
  assert.equal(output.status, 100); assert.equal(info.recent[0].host, 'mirrors.edge.kernel.org'); assert.equal(info.recent[0].kind, 'InRelease');
  assert.deepEqual(info.errors, ['tls']); assert.equal(info.sandboxFallback, false);
});

test('sandbox workspace requests scoped _apt access checks and stages an identical package', async t => {
  const parent = await mkdtemp(join(tmpdir(), 'z2ma-apt-test-')); t.after(() => rm(parent, {recursive: true, force: true}));
  const calls = []; const events = [];
  const options = {parent, report: text => events.push(text), run: (command, args, settings) => {
    assert.equal(command, 'sudo'); assert.equal(args[0], '-n'); assert.equal(settings.shell, undefined);
    assert.equal(settings.timeout, 10000); calls.push(args); return ok;
  }};
  const workspace = await createAptWorkspace(options);
  assert.ok(workspace.directory.startsWith(join(parent, 'z2ma-apt-')));
  assert.deepEqual(calls[0].slice(0, -2), ['-n', '--', 'install', '-d', '-o', '_apt', '-g', 'root', '-m', '0700']);
  assert.ok(calls[0].slice(-2).every(path => path.startsWith(workspace.directory)));
  assert.ok(calls.slice(1).every(args => args[1] === '--user=_apt' && args[3] === 'test'));
  const original = join(parent, 'original.deb'); const bytes = Buffer.from('synthetic public DEB bytes\n');
  await writeFile(original, bytes);
  const staged = await stageLocalPackage(original, workspace, options);
  assert.deepEqual(await readFile(original), bytes); assert.deepEqual(await readFile(staged), bytes);
  assert.notEqual(staged, original); assert.ok(staged.startsWith(workspace.directory));
  assert.deepEqual(calls.at(-1).slice(3, 5), ['test', '-r']);
  if (process.platform !== 'win32') assert.equal((await stat(staged)).mode & 0o777, 0o644);
  assert.doesNotMatch(events.join('\n'), /synthetic public|original\.deb|package\.deb|z2ma-apt-test-/);
  await assert.rejects(stageLocalPackage(original, workspace, options), {code: 'EEXIST'});
});

test('sandbox ownership and unreadable paths stop before package operations with bounded permission diagnostics', async t => {
  const parent = await mkdtemp(join(tmpdir(), 'z2ma-apt-denied-')); t.after(() => rm(parent, {recursive: true, force: true}));
  const events = []; const run = () => ({status: 1, stderr: 'Permission denied /private/SYNTHETIC_SECRET'});
  const options = {parent, run, report: text => events.push(text)};
  await assert.rejects(createAptWorkspace(options), /sandbox directories/);
  assert.throws(() => assertAptAccess('/private/SYNTHETIC_SECRET', '-r', 'local-package', options), /sandbox access check failed/);
  assert.ok(events.some(text => text.includes('"ready":false')));
  assert.doesNotMatch(events.join('\n'), /SYNTHETIC_SECRET|\/private/);
  const f = fixture([], {prepareTargets: () => { throw new Error('sandbox access check failed'); },
    probe: () => assert.fail('No probe after failed package staging')});
  await assert.rejects(installUbuntuPackages(['/synthetic/app.deb'], f.options), /sandbox access/); assert.equal(f.calls.length, 0);
});

const nativeSandbox = process.platform === 'linux' && process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_OS === 'Linux';
test('native CI _apt access rejects a private ancestor and accepts isolated sources, caches and staged DEB', {skip: !nativeSandbox}, async t => {
  const privateDirectory = await mkdtemp(join(process.env.RUNNER_TEMP, 'z2ma-apt-private-'));
  await chmod(privateDirectory, 0o700);
  let workspace;
  t.after(async () => {
    // The _apt-owned partial directories are empty; remove them through their owned parents.
    if (workspace) {
      await rmdir(join(workspace.lists, 'partial')); await rmdir(join(workspace.archives, 'partial'));
      await rm(workspace.directory, {recursive: true, force: true});
    }
    await rm(privateDirectory, {recursive: true, force: true});
  });
  const file = join(privateDirectory, 'synthetic.deb'); await writeFile(file, 'synthetic public package\n', {mode: 0o644});
  assert.throws(() => assertAptAccess(file, '-r', 'private-ancestor'), /sandbox access/);
  workspace = await createAptWorkspace(); assert.ok(workspace.directory.startsWith('/tmp/z2ma-apt-'));
  const sources = await prepareUbuntuSources('kernel', workspace);
  assert.ok(sources.includes('Dir::Cache::archives=' + workspace.archives));
  const sourceFile = sources.find(value => value.startsWith('Dir::Etc::sourcelist=')).split('=')[1];
  assert.match(await readFile(sourceFile, 'utf8'), /mirrors\.edge\.kernel\.org/);
  const staged = await stageLocalPackage(file, workspace);
  assert.deepEqual(await readFile(staged), await readFile(file));
  assert.equal((await stat(privateDirectory)).mode & 0o777, 0o700);
  assertAptAccess(staged, '-r', 'local-package');
  for (const directory of [workspace.lists, workspace.archives]) {
    const destination = join(directory, 'partial', 'access-probe');
    try {
      const copied = spawnSync('sudo', ['-n', '--user=_apt', '--', 'cp', '--', staged, destination], {encoding: 'utf8', timeout: 10000});
      assert.equal(copied.status, 0, '_apt must actually read the staged DEB and write each partial directory');
    } finally {
      const removed = spawnSync('sudo', ['-n', '--user=_apt', '--', 'rm', '-f', '--', destination], {encoding: 'utf8', timeout: 10000});
      assert.equal(removed.status, 0, 'remove the synthetic probe as its owner');
    }
  }
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
