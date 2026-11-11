import {spawnSync} from 'node:child_process';
import {access, appendFile, chmod, mkdir, mkdtemp, readFile, realpath, stat, writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
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

export function officialUbuntuSources(osRelease, architecture) {
  const field = name => new RegExp('^' + name + '=(?:"([^"\\n]*)"|([^\\s]+))$', 'm').exec(osRelease)?.slice(1).find(Boolean);
  if (field('ID') !== 'ubuntu' || field('VERSION_ID') !== '24.04' || field('VERSION_CODENAME') !== 'noble' || architecture !== 'x64') {
    throw new Error('Ubuntu APT fallback is limited to the Ubuntu 24.04 x64 CI target.');
  }
  return [['https://archive.ubuntu.com/ubuntu/', 'noble noble-updates'],
    ['https://security.ubuntu.com/ubuntu/', 'noble-security']].map(([uri, suites]) =>
    'Types: deb\nURIs: ' + uri + '\nSuites: ' + suites + '\nComponents: main universe\n'
      + 'Architectures: amd64\nSigned-By: ' + archiveKeyring + '\n').join('\n');
}

export async function prepareOfficialSources() {
  const source = officialUbuntuSources(await readFile('/etc/os-release', 'utf8'), process.arch);
  await access(archiveKeyring, constants.R_OK);
  // Isolated files avoid editing system sources, mirror lists or third-party repos.
  const directory = await mkdtemp(join(process.env.RUNNER_TEMP, 'z2ma-apt-'));
  await chmod(directory, 0o755);
  const file = join(directory, 'ubuntu.sources');
  await writeFile(file, source, {mode: 0o644});
  await mkdir(join(directory, 'lists'), {mode: 0o755});
  return ['-o', 'Dir::Etc::sourcelist=' + file, '-o', 'Dir::Etc::sourceparts=-', '-o', 'Dir::State::lists=' + join(directory, 'lists'),
    '-o', 'Dir::Cache::pkgcache=', '-o', 'Dir::Cache::srcpkgcache='];
}

export function executeApt(args, timeoutMs, run = spawnSync) {
  // GNU timeout bounds the privileged process group, including apt's children.
  // The outer timeout also bounds a failed sudo/timeout launcher.
  return run('sudo', ['-n', '--', 'env', 'LC_ALL=C', 'DEBIAN_FRONTEND=noninteractive',
    'timeout', '--verbose', '--signal=TERM', '--kill-after=5s', Math.ceil(timeoutMs / 1000) + 's', 'apt-get', ...args],
  {encoding: 'utf8', timeout: timeoutMs + 10000, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024, windowsHide: true});
}

const hosts = ['azure.archive.ubuntu.com', 'archive.ubuntu.com', 'security.ubuntu.com', 'packages.microsoft.com', 'dl.google.com'];
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
  return {stdoutBytes: Buffer.byteLength(stdout), stderrBytes: Buffer.byteLength(stderr), counts, recent, errors, processCode};
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

export function probeUbuntuMirrors({run = executeProbe, report = console.log} = {}) {
  const dns = run('getent', ['ahostsv4', hosts[0]]);
  const azureDNS = !dns.error && dns.status === 0 && Boolean(String(dns.stdout ?? '').trim());
  report('UBUNTU_APT_PROBE ' + JSON.stringify({host: hosts[0], type: 'dns-ipv4', exit: dns.status ?? null, resolved: azureDNS}));
  const reached = hosts.slice(1, 3).map(host => {
    const uri = 'https://' + host + '/ubuntu/dists/' + (host === hosts[1] ? 'noble' : 'noble-security') + '/InRelease';
    const result = run('curl', ['--disable', '--ipv4', '--fail', '--silent', '--show-error', '--proto', '=https',
      '--connect-timeout', '3', '--max-time', '8', '--output', '/dev/null', '--write-out', '%{http_code} %{time_total}', uri]);
    const values = /^(\d{3}) (\d+(?:\.\d+)?)$/.exec(String(result.stdout ?? '').trim());
    const status = values ? Number(values[1]) : null;
    report('UBUNTU_APT_PROBE ' + JSON.stringify({host, type: 'https-ipv4', exit: result.status ?? null, status,
      seconds: values ? Number(values[2]) : null}));
    return !result.error && result.status === 0 && status === 200;
  });
  const forceIPv4 = reached.every(Boolean);
  return {forceIPv4, preferOfficial: !azureDNS && forceIPv4};
}

function outcome(result, phase) {
  if (result.error || result.signal) return {ok: false, transient: false, reason: 'process'};
  const output = (result.stdout ?? '') + '\n' + (result.stderr ?? '');
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

export async function installUbuntuPackages(targets, {run = executeApt, fallback = prepareOfficialSources, wait = waitFor,
  report = console.log, clock = Date.now, preferOfficial = false, officialVerified = async () => {},
  installed = () => false, probe = () => ({forceIPv4: false, preferOfficial: false})} = {}) {
  if (!Array.isArray(targets) || !targets.length || targets.some(target => typeof target !== 'string'
    || !(/^[a-z0-9][a-z0-9+.-]*(?::amd64)?$/.test(target) || isAbsolute(target) && target.endsWith('.deb') && !/[\r\n\0]/.test(target)))) {
    throw new Error('Invalid Ubuntu APT package targets.');
  }
  if (targets.every(target => !isAbsolute(target)) && await installed(targets)) {
    report('UBUNTU_APT ' + JSON.stringify({phase: 'installed-check', ready: true, packages: targets.length}));
    return;
  }
  const route = await probe();
  preferOfficial ||= route.preferOfficial;
  const networkOptions = route.forceIPv4 ? ['-o', 'Acquire::ForceIPv4=true'] : [];
  report('UBUNTU_APT_ROUTE ' + JSON.stringify({forceIPv4: route.forceIPv4, preferOfficial}));
  const deadline = clock() + 360000;
  const attempt = async (phase, mirror, sourceOptions, command) => {
    for (let number = 1; number <= 2; number++) {
      const remaining = deadline - clock();
      if (remaining < 1000) throw new Error('Ubuntu APT acquisition time budget exhausted.');
      const limit = mirror === 'runner' ? 30000 : 180000;
      const result = run([...options, ...networkOptions, ...sourceOptions, ...command], Math.min(limit, remaining));
      const status = outcome(result, phase);
      // Fixed diagnostics only: never echo proxy URLs, environment or process output.
      report('UBUNTU_APT ' + JSON.stringify({phase, mirror, attempt: number, exit: result.status ?? null, reason: status.reason,
        diagnostics: aptDiagnostics(result)}));
      if (status.ok) return true;
      if (!status.transient) throw new Error('Ubuntu APT ' + phase + ' failed (' + status.reason + ', exit ' + (result.status ?? 'unknown') + ').');
      if (number === 1) {
        if (deadline - clock() < 2000) throw new Error('Ubuntu APT acquisition time budget exhausted.');
        await wait(1000);
      }
    }
    return false;
  };
  for (const mirror of preferOfficial ? ['official'] : ['runner', 'official']) {
    const sourceOptions = mirror === 'official' ? await fallback() : [];
    // A successful strict update checks signed metadata before any download/install.
    if (!await attempt('update', mirror, sourceOptions, ['update', '--error-on=any'])) continue;
    if (mirror === 'official') await officialVerified();
    if (!await attempt('download', mirror, sourceOptions, ['install', '--yes', '--download-only', ...targets])) continue;
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
  await installUbuntuPackages(targets, {preferOfficial: process.env.Z2MA_APT_USE_OFFICIAL === 'true',
    installed: mode === 'prepare' ? packagesInstalled : () => false,
    probe: () => probeUbuntuMirrors(),
    officialVerified: async () => appendFile(process.env.GITHUB_ENV, 'Z2MA_APT_USE_OFFICIAL=true\n')});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
