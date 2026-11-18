import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {basename, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {verifyBuildCheckout} from './ci-build-ref.mjs';

function files(directory) {
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    if (entry.isSymbolicLink()) throw new Error('Candidate artifacts must not contain symbolic links.');
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : entry.isFile() ? [path] : [];
  });
}

export function prepareCandidate({root, sha, version, platform = process.platform, arch = process.arch}) {
  if (!['win32', 'linux'].includes(platform) || arch !== 'x64') throw new Error('Unsupported candidate platform.');
  root = resolve(root);
  const checked = verifyBuildCheckout({root, sha, version});
  if (execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {cwd: root, encoding: 'utf8', timeout: 10000}).trim()) {
    throw new Error('Candidate source must not contain untracked files.');
  }
  const metadata = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8'));
  const extension = platform === 'win32' ? '.exe' : '.deb';
  const installers = files(join(root, 'apps/desktop/out/make')).filter(file => file.endsWith(extension));
  const expected = platform === 'win32' ? `Z2M-Automations-${checked.version}-Windows-x64-Setup.exe`
    : `z2m-automations_${checked.version}_amd64.deb`;
  if (installers.length !== 1 || basename(installers[0]) !== expected) throw new Error('Expected one installer matching the checked version and architecture.');
  const artifact = path => {
    const bytes = readFileSync(path);
    if (!bytes.length) throw new Error('Candidate artifacts must not be empty.');
    return {file: relative(root, path).split(sep).join('/'), bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex')};
  };
  const designer = JSON.parse(readFileSync(join(root, 'packages/designer/dist/manifest.json'), 'utf8'));
  if (designer.version !== checked.version || !/^[a-f0-9]{64}$/.test(designer.content)) throw new Error('Designer identity does not match the candidate.');
  const edition = platform === 'win32' ? 'Windows' : 'Linux';
  const manifest = {format: 1, channel: 'candidate', product: 'Z2M-Automations for ' + edition,
    ...checked, build: metadata.build, date: metadata.date, platform, arch, signed: false,
    installer: artifact(installers[0]),
    designer: {...artifact(join(root, `artifacts/z2ma-designer-${checked.version}.tgz`)), content: designer.content}};
  const destination = join(root, 'artifacts', `candidate-${edition}.json`);
  mkdirSync(join(root, 'artifacts'), {recursive: true});
  writeFileSync(destination, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const manifest = prepareCandidate({root: fileURLToPath(new URL('../', import.meta.url)),
    sha: process.env.Z2MA_BUILD_SHA, version: process.env.Z2MA_BUILD_VERSION});
  console.log('CANDIDATE_PREPARED ' + JSON.stringify(manifest));
}
