import {spawnSync} from 'node:child_process';
import {access, appendFile, chmod, copyFile, mkdir, mkdtemp, readFile, realpath, stat, writeFile} from 'node:fs/promises';
import {constants, createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join, resolve, relative, isAbsolute} from 'node:path';
import {setTimeout as waitFor} from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const options = ['-o', 'Acquire::Retries=0', '-o', 'Acquire::http::Timeout=15', '-o', 'Acquire::https::Timeout=15',
  '-o', 'Acquire::Languages=none', '-o', 'Acquire::IndexTargets::deb::DEP-11::DefaultEnabled=false',
  '-o', 'Acquire::https::Verify-Peer=true', '-o', 'Acquire::https::Verify-Host=true',
  '-o', 'Acquire::AllowInsecureRepositories=false', '-o', 'Acquire::AllowDowngradeToInsecureRepositories=false',
  '-o', 'APT::Get::AllowUnauthenticated=false', '-o', 'Dpkg::Lock::Timeout=15', '-o', 'Dpkg::Use-Pty=0'];
const archiveKeyring = '/usr/share/keyrings/ubuntu-archive-keyring.gpg';
const suites = ['noble', 'noble-updates', 'noble-security'];
const repositories = {
  official: [['https://archive.ubuntu.com/ubuntu/', suites.slice(0, 2)], ['https://security.ubuntu.com/ubuntu/', suites.slice(2)]],
  kernel: [['https://mirrors.edge.kernel.org/ubuntu/', suites]],
  osuosl: [['https://ftp.osuosl.org/pub/ubuntu/', suites]]
};

function repositorySources(repository) {
  if (!Object.hasOwn(repositories, repository)) throw new Error('Unknown Ubuntu APT repository selection.');
  return repositories[repository];
}

export function ubuntuSources(osRelease, architecture, repository = 'official') {
  const field = name => new RegExp('^' + name + '=(?:"([^"\\n]*)"|([^\\s]+))$', 'm').exec(osRelease)?.slice(1).find(Boolean);
  if (field('ID') !== 'ubuntu' || field('VERSION_ID') !== '24.04' || field('VERSION_CODENAME') !== 'noble' || architecture !== 'x64') {
    throw new Error('Ubuntu APT fallback is limited to the Ubuntu 24.04 x64 CI target.');
  }
  return repositorySources(repository).map(([uri, selectedSuites]) =>
    'Types: deb\nURIs: ' + uri + '\nSuites: ' + selectedSuites.join(' ') + '\nComponents: main universe\n'
      + 'Architectures: amd64\nSigned-By: ' + archiveKeyring + '\n').join('\n');
}

const accessOptions = {encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL', maxBuffer: 65536, windowsHide: true};

export function assertAptAccess(path, flag, scope, {run = spawnSync, report = console.log} = {}) {
  const result = run('sudo', ['-n', '--user=_apt', '--', 'test', flag, path], accessOptions);
  const ready = !result.error && result.status === 0;
  report('UBUNTU_APT_ACCESS ' + JSON.stringify({scope, ready, exit: result.status ?? null}));
  if (!ready) throw new Error('Ubuntu APT sandbox access check failed (' + scope + '); no package operation was started.');
}

export async function createAptWorkspace({parent = '/tmp', run = spawnSync, report = console.log} = {}) {
  // RUNNER_TEMP/workspace ancestors can be private to runner. Never broaden home permissions.
  const directory = await mkdtemp(join(parent, 'z2ma-apt-'));
  await chmod(directory, 0o755);
  const lists = join(directory, 'lists'); const archives = join(directory, 'archives');
  for (const path of [lists, archives]) { await mkdir(path, {mode: 0o755}); await chmod(path, 0o755); }
  const partials = [join(lists, 'partial'), join(archives, 'partial')];
  const ownership = run('sudo', ['-n', '--', 'install', '-d', '-o', '_apt', '-g', 'root', '-m', '0700', ...partials], accessOptions);
  const ready = !ownership.error && ownership.status === 0;
  report('UBUNTU_APT_ACCESS ' + JSON.stringify({scope: 'partial-ownership', ready, exit: ownership.status ?? null}));
  if (!ready) throw new Error('Could not prepare Ubuntu APT sandbox directories.');
  assertAptAccess(directory, '-x', 'workspace', {run, report});
  for (let index = 0; index < partials.length; index++) {
    assertAptAccess(partials[index], '-w', index === 0 ? 'list-partial' : 'archive-partial', {run, report});
  }
  return {directory, lists, archives};
}

export async function prepareUbuntuSources(repository = 'official', workspace = undefined, {run = spawnSync, report = console.log} = {}) {
  const source = ubuntuSources(await readFile('/etc/os-release', 'utf8'), process.arch, repository);
  await access(archiveKeyring, constants.R_OK);
  const area = workspace ?? await createAptWorkspace({run, report});
  const file = join(area.directory, repository + '.sources');
  await writeFile(file, source, {mode: 0o644}); await chmod(file, 0o644);
  assertAptAccess(file, '-r', 'source-list', {run, report});
  assertAptAccess(archiveKeyring, '-r', 'archive-keyring', {run, report});
  return ['-o', 'Dir::Etc::sourcelist=' + file, '-o', 'Dir::Etc::sourceparts=-', '-o', 'Dir::State::lists=' + area.lists,
    '-o', 'Dir::Cache::archives=' + area.archives,
    '-o', 'Dir::Cache::pkgcache=', '-o', 'Dir::Cache::srcpkgcache='];
}

async function checksum(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function stageLocalPackage(file, workspace, {run = spawnSync, report = console.log} = {}) {
  const original = await checksum(file); const staged = join(workspace.directory, 'package.deb');
  await copyFile(file, staged, constants.COPYFILE_EXCL); await chmod(staged, 0o644);
  if (await checksum(staged) !== original || await checksum(file) !== original) throw new Error('Built Ubuntu package changed while staging.');
  assertAptAccess(staged, '-r', 'local-package', {run, report});
  report('UBUNTU_APT ' + JSON.stringify({phase: 'stage-package', identical: true}));
  return staged;
}

export function executeApt(args, timeoutMs, run = spawnSync) {
  // GNU timeout bounds the privileged process group, including apt's children.
  // The outer timeout also bounds a failed sudo/timeout launcher.
  return run('sudo', ['-n', '--', 'env', 'LC_ALL=C', 'DEBIAN_FRONTEND=noninteractive',
    'timeout', '--verbose', '--signal=TERM', '--kill-after=5s', Math.ceil(timeoutMs / 1000) + 's', 'apt-get', ...args],
  {encoding: 'utf8', timeout: timeoutMs + 10000, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024, windowsHide: true});
}

const hosts = ['azure.archive.ubuntu.com', 'archive.ubuntu.com', 'security.ubuntu.com', 'mirrors.edge.kernel.org',
  'ftp.osuosl.org', 'packages.microsoft.com', 'dl.google.com'];
export function aptDiagnostics(result) {
  const stdout = String(result.stdout ?? ''); const stderr = String(result.stderr ?? '');
  const output = stdout + '\n' + stderr;
  const recent = []; const counts = {Hit: 0, Get: 0, Ign: 0, Err: 0};
  for (const line of output.split(/\r?\n/)) {
    const entry = /^(Hit|Get|Ign|Err):\d+\s+(\S+)(.*)$/.exec(line);
    if (!entry) continue;
    counts[entry[1]]++;
    let host = 'other';
    try { const name = new URL(entry[2]).hostname; if (hosts.includes(name)) host = name; }
    catch { /* Non-HTTP mirror-list and local paths are not exposed. */ }
    const text = entry[3];
    recent.push({state: entry[1], host, suite: /\bnoble(?:-updates|-security|-backports)?\b/.exec(text)?.[0] ?? 'other',
      kind: /\b(?:InRelease|Release|Packages|Translation-en|Components|DEP-11)\b/.exec(text)?.[0] ?? 'other'});
    if (recent.length > 8) recent.shift();
  }
  const errors = ['dns', 'connection', 'tls', 'signature', 'hash', 'lock', 'permission', 'hook'].filter((_, index) => [
    /Temporary failure resolving|Could not resolve/i, /Could not connect|Connection (?:failed|timed out|reset)|Network is unreachable/i,
    /Certificate verification failed|Could not handshake/i, /NO_PUBKEY|BADSIG|EXPKEYSIG|invalid signature|not signed/i,
    /Hash Sum mismatch|unexpected size/i, /Could not get lock|Unable to acquire.*lock/i,
    /Permission denied|Operation not permitted|not accessible by user/i, /Problem executing scripts|Post-Invoke|Pre-Invoke/i
  ][index].test(output));
  const processCode = ['ENOENT', 'EACCES', 'ETIMEDOUT', 'ENOBUFS'].includes(result.error?.code) ? result.error.code : null;
  const sandboxFallback = /unsandboxed as root|(?:not accessible|couldn't be accessed) by user ['"]?_apt/i.test(output);
  return {stdoutBytes: Buffer.byteLength(stdout), stderrBytes: Buffer.byteLength(stderr), counts, recent, errors, sandboxFallback, processCode};
}

export function packagesInstalled(targets, run = spawnSync) {
  const result = run('dpkg-query', ['--show', '--showformat=${binary:Package}\t${db:Status-Status}\n', ...targets],
    {encoding: 'utf8', timeout: 5000, windowsHide: true, maxBuffer: 65536});
  if (result.error || result.status !== 0) return false;
  const installed = new Set(String(result.stdout).split('\n').flatMap(line => {
    const [name, status] = line.split('\t'); return status === 'installed' ? [name.split(':')[0]] : [];
  }));
  return targets.every(target => installed.has(target));
}

function executeProbe(command, args) {
  return spawnSync('sudo', ['-n', '--', 'env', 'LC_ALL=C', 'timeout', '--kill-after=2s', '10s', command, ...args],
    {encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', maxBuffer: 65536, windowsHide: true});
}

export function probeUbuntuMirrors({run = executeProbe, report = console.log, preferred = 'official'} = {}) {
  repositorySources(preferred);
  const dns = run('getent', ['ahostsv4', hosts[0]]);
  const azureDNS = !dns.error && dns.status === 0 && Boolean(String(dns.stdout ?? '').trim());
  report('UBUNTU_APT_PROBE ' + JSON.stringify({host: hosts[0], type: 'dns-ipv4', exit: dns.status ?? null, resolved: azureDNS}));
  const reached = [];
  for (const repository of [preferred, ...Object.keys(repositories).filter(id => id !== preferred)]) {
    let complete = true;
    for (const [base, selectedSuites] of repositorySources(repository)) {
      for (const suite of selectedSuites) {
        const uri = base + 'dists/' + suite + '/InRelease';
        const result = run('curl', ['--disable', '--ipv4', '--fail', '--silent', '--show-error', '--proto', '=https',
          '--connect-timeout', '3', '--max-time', '8', '--output', '/dev/null', '--write-out',
          '%{http_code} %{time_namelookup} %{time_connect} %{time_appconnect} %{time_total}', uri]);
        const values = /^(\d{3}) ((?:\d+\.?\d* ){3}\d+\.?\d*)$/.exec(String(result.stdout ?? '').trim());
        const status = values ? Number(values[1]) : null;
        const times = values ? values[2].split(' ').map(Number) : [null, null, null, null];
        report('UBUNTU_APT_PROBE ' + JSON.stringify({repository, host: new URL(base).hostname, suite, type: 'https-ipv4',
          exit: result.status ?? null, status, lookupSeconds: times[0], connectSeconds: times[1], tlsSeconds: times[2], totalSeconds: times[3]}));
        complete &&= !result.error && result.status === 0 && status === 200;
      }
    }
    if (complete) reached.push(repository);
    if (reached.length === 2) break;
  }
  // HTTPS reachability is only routing evidence. APT must still verify Ubuntu signatures and hashes.
  return {forceIPv4: reached.length > 0, repositories: reached};
}

function outcome(result, phase) {
  if (result.error || result.signal) return {ok: false, transient: false, reason: 'process'};
  const output = (result.stdout ?? '') + '\n' + (result.stderr ?? '');
  if (aptDiagnostics(result).sandboxFallback) return {ok: false, transient: false, reason: 'sandbox-access'};
  if (/NO_PUBKEY|BADSIG|EXPKEYSIG|not signed|signatures? (?:were )?invalid|signatures? (?:could not|couldn't) be verified|invalid signatures?|Hash Sum mismatch|hashes? (?:do not|did not) match|Certificate verification failed|does not have a Release file|Release file .* (?:expired|not valid)/i.test(output)) {
    return {ok: false, transient: false, reason: 'verification'};
  }
  const warning = phase === 'update' && /Failed to fetch|Some index files failed to download/i.test(output);
  if (result.status === 0 && !warning) return {ok: true, transient: false, reason: 'ok'};
  if (result.status === 124 || result.status === 137 && /timeout: sending signal KILL/.test(output)) {
    return {ok: false, transient: true, reason: 'timeout'};
  }
  const network = /Temporary failure resolving|Could not resolve|Could not connect|Connection (?:timed out|failed|reset)|Network is unreachable|Timeout was reached|(?:\b(?:408|429|500|502|503|504)\b[^\n]*(?:Request Timeout|Too Many Requests|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout))/i.test(output);
  return {ok: false, transient: network, reason: network ? 'network' : warning ? 'metadata' : 'package'};
}

function validateTargets(targets) {
  if (!Array.isArray(targets) || !targets.length || targets.some(target => typeof target !== 'string'
    || !(/^[a-z0-9][a-z0-9+.-]*(?::amd64)?$/.test(target) || isAbsolute(target) && target.endsWith('.deb') && !/[\r\n\0]/.test(target)))) {
    throw new Error('Invalid Ubuntu APT package targets.');
  }
}

export async function installUbuntuPackages(targets, {run = executeApt, fallback = prepareUbuntuSources, wait = waitFor,
  report = console.log, clock = Date.now, repositoryVerified = async () => {}, prepareTargets = targets => targets,
  installed = () => false, probe = probeUbuntuMirrors} = {}) {
  validateTargets(targets);
  if (targets.every(target => !isAbsolute(target)) && await installed(targets)) {
    report('UBUNTU_APT ' + JSON.stringify({phase: 'installed-check', ready: true, packages: targets.length}));
    return;
  }
  targets = await prepareTargets(targets); validateTargets(targets);
  const deadline = clock() + 360000;
  const route = await probe();
  if (!Array.isArray(route.repositories) || route.repositories.length > 2
      || new Set(route.repositories).size !== route.repositories.length) throw new Error('Invalid Ubuntu APT route.');
  route.repositories.forEach(repositorySources);
  const networkOptions = route.forceIPv4 ? ['-o', 'Acquire::ForceIPv4=true'] : [];
  report('UBUNTU_APT_ROUTE ' + JSON.stringify({forceIPv4: route.forceIPv4, repositories: route.repositories}));
  if (!route.repositories.length) throw new Error('No Ubuntu mirror passed the bounded HTTPS probes; no package operation was started.');
  const attempt = async (phase, mirror, sourceOptions, command, mirrorDeadline) => {
    for (let number = 1; number <= 2; number++) {
      const remaining = mirrorDeadline - clock();
      if (remaining < 1000) return false;
      const result = run([...options, ...networkOptions, ...sourceOptions, ...command], Math.min(180000, remaining));
      const status = outcome(result, phase);
      // Fixed diagnostics only: never echo proxy URLs, environment or process output.
      report('UBUNTU_APT ' + JSON.stringify({phase, mirror, attempt: number, exit: result.status ?? null, reason: status.reason,
        diagnostics: aptDiagnostics(result)}));
      if (status.ok) return true;
      if (!status.transient) throw new Error('Ubuntu APT ' + phase + ' failed (' + status.reason + ', exit ' + (result.status ?? 'unknown') + ').');
      if (number === 1) {
        if (mirrorDeadline - clock() < 2000) return false;
        await wait(1000);
      }
    }
    return false;
  };
  for (const [index, mirror] of route.repositories.entries()) {
    const now = clock(); const remaining = deadline - now;
    if (remaining < 1000) throw new Error('Ubuntu APT acquisition time budget exhausted.');
    // Reserve time for the independently hosted fallback even when a reachable mirror later stalls.
    const mirrorDeadline = now + Math.floor(remaining / (route.repositories.length - index));
    const sourceOptions = await fallback(mirror);
    // A successful strict update checks signed metadata before any download/install.
    if (!await attempt('update', mirror, sourceOptions, ['update', '--error-on=any'], mirrorDeadline)) continue;
    await repositoryVerified(mirror);
    if (!await attempt('download', mirror, sourceOptions, ['install', '--yes', '--download-only', ...targets], mirrorDeadline)) continue;
    const installation = run([...options, ...networkOptions, ...sourceOptions, 'install', '--yes', '--no-download', ...targets], 120000);
    const result = outcome(installation, 'install');
    report('UBUNTU_APT ' + JSON.stringify({phase: 'install', mirror, attempt: 1, exit: installation.status ?? null, reason: result.reason,
      diagnostics: aptDiagnostics(installation)}));
    if (!result.ok) throw new Error('Ubuntu APT offline installation failed (exit ' + (installation.status ?? 'unknown') + '); it will not be repeated.');
    return;
  }
  throw new Error('Ubuntu APT acquisition failed after the bounded mirror attempts; no installation was started.');
}

async function main() {
  if (process.platform !== 'linux' || process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_OS !== 'Linux' || !process.env.RUNNER_TEMP || !process.env.GITHUB_ENV) {
    throw new Error('Ubuntu APT helper may run only on the disposable GitHub Linux runner.');
  }
  const [mode, path, ...extra] = process.argv.slice(2);
  let targets;
  if (mode === 'prepare' && !path) targets = ['fakeroot', 'dpkg', 'xvfb', 'openssl'];
  else if (mode === 'install-deb' && path && !extra.length) {
    const file = await realpath(resolve(path)); const output = await realpath(join(root, 'apps/desktop/out/make'));
    const part = relative(output, file);
    if (!part || part.startsWith('..') || isAbsolute(part) || !file.endsWith('.deb') || !(await stat(file)).isFile()) throw new Error('Expected one built DEB inside desktop output.');
    targets = [file];
  } else throw new Error('Expected prepare or install-deb with one built package.');
  let workspace;
  const area = () => workspace ??= createAptWorkspace();
  await installUbuntuPackages(targets, {
    installed: mode === 'prepare' ? packagesInstalled : () => false,
    prepareTargets: async packages => mode === 'install-deb' ? [await stageLocalPackage(packages[0], await area())] : packages,
    fallback: async repository => prepareUbuntuSources(repository, await area()),
    probe: () => probeUbuntuMirrors({preferred: process.env.Z2MA_APT_REPOSITORY ?? 'official'}),
    repositoryVerified: async repository => appendFile(process.env.GITHUB_ENV, 'Z2MA_APT_REPOSITORY=' + repository + '\n')});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
