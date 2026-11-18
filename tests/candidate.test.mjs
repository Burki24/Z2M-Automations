import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {prepareCandidate} from '../scripts/prepare-candidate.mjs';

function fixture(t, platform) {
  const root = mkdtempSync(join(tmpdir(), 'z2ma-candidate-'));
  t.after(() => {
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !root.startsWith(join(tmpdir(), 'z2ma-candidate-'))) throw new Error('Unexpected fixture cleanup path.');
    rmSync(root, {recursive: true, force: true});
  });
  const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
  git('init', '--quiet'); git('config', 'user.name', 'Synthetic'); git('config', 'user.email', 'synthetic@example.invalid');
  writeFileSync(join(root, '.gitignore'), 'artifacts/\napps/desktop/out/\npackages/designer/dist/\n');
  writeFileSync(join(root, 'version.json'), JSON.stringify({version: '0.120.0', build: 42, date: 1800000000}) + '\n');
  git('add', '.'); git('commit', '--quiet', '-m', 'Synthetic candidate source');
  const sha = git('rev-parse', 'HEAD');
  for (const path of ['apps/desktop/out/make', 'packages/designer/dist', 'artifacts']) mkdirSync(join(root, path), {recursive: true});
  const filename = platform === 'win32' ? 'Z2M-Automations-0.120.0-Windows-x64-Setup.exe' : 'z2m-automations_0.120.0_amd64.deb';
  const installer = join(root, 'apps/desktop/out/make', filename);
  writeFileSync(installer, 'abc');
  writeFileSync(join(root, 'artifacts/z2ma-designer-0.120.0.tgz'), 'abc');
  writeFileSync(join(root, 'packages/designer/dist/manifest.json'), JSON.stringify({version: '0.120.0', content: 'a'.repeat(64)}));
  return {root, sha, version: '0.120.0', platform, arch: 'x64', installer};
}

for (const platform of ['win32', 'linux']) test('candidate identity binds the ' + platform + ' installer and designer to one checked version and commit', t => {
  const options = fixture(t, platform);
  const result = prepareCandidate(options);
  assert.equal(result.sha, options.sha); assert.equal(result.version, '0.120.0');
  assert.equal(result.build, 42); assert.equal(result.date, 1800000000);
  assert.equal(result.platform, platform); assert.equal(result.arch, 'x64'); assert.equal(result.signed, false);
  assert.equal(result.installer.bytes, 3);
  assert.equal(result.installer.sha256, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(result.designer.sha256, result.installer.sha256);
  assert.equal(result.designer.content, 'a'.repeat(64));
  const saved = JSON.parse(readFileSync(join(options.root, 'artifacts/candidate-' + (platform === 'win32' ? 'Windows' : 'Linux') + '.json'), 'utf8'));
  assert.deepEqual(saved, result);
});

test('candidate preparation rejects dirty source and mismatched version, commit or platform', t => {
  const options = fixture(t, 'win32');
  for (const change of [{sha: 'f'.repeat(40)}, {version: '0.121.0'}, {platform: 'darwin'}, {arch: 'arm64'}]) {
    assert.throws(() => prepareCandidate({...options, ...change}));
  }
  writeFileSync(join(options.root, 'new-source.js'), 'export const synthetic = true;\n');
  assert.throws(() => prepareCandidate(options), /untracked/);
  rmSync(join(options.root, 'new-source.js'));
  writeFileSync(join(options.root, 'version.json'), JSON.stringify({version: '0.120.0', build: 43, date: 1800000000}) + '\n');
  assert.throws(() => prepareCandidate(options), /uncommitted/);
});

test('candidate preparation rejects missing, duplicate, empty or foreign-version artifacts', t => {
  for (const failure of ['missing', 'duplicate', 'empty', 'version', 'designer']) {
    const options = fixture(t, 'linux');
    if (failure === 'missing') rmSync(options.installer);
    if (failure === 'duplicate') writeFileSync(join(options.root, 'apps/desktop/out/make/other.deb'), 'abc');
    if (failure === 'empty') writeFileSync(options.installer, '');
    if (failure === 'version') {
      rmSync(options.installer); writeFileSync(join(options.root, 'apps/desktop/out/make/z2m-automations_0.119.0_amd64.deb'), 'abc');
    }
    if (failure === 'designer') writeFileSync(join(options.root, 'packages/designer/dist/manifest.json'), JSON.stringify({version: '0.119.0', content: 'a'.repeat(64)}));
    assert.throws(() => prepareCandidate(options), undefined, failure);
  }
});
