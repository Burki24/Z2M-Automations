import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {load} from 'js-yaml';
import {captureVersionedBuild, verifyBuildCheckout} from '../scripts/ci-build-ref.mjs';

const workflow = name => load(readFileSync(new URL('../.github/workflows/' + name, import.meta.url), 'utf8'));

test('desktop packaging waits for application versioning and checks out its exact commit', () => {
  const desktop = workflow('desktop.yml');
  assert.ok(desktop.jobs.version, 'dev builds need a versioning prerequisite instead of a parallel push workflow');
  assert.equal(desktop.jobs.version.uses, './.github/workflows/update-application-metadata.yml');
  assert.deepEqual(desktop.jobs.desktop.needs, ['version']);
  const checkout = desktop.jobs.desktop.steps.find(step => step.uses === 'actions/checkout@v6');
  assert.equal(checkout.with.ref, '${{ needs.version.outputs.sha || github.sha }}');
  assert.ok(desktop.jobs.desktop.steps.find(step => step.run === 'node scripts/ci-build-ref.mjs verify'));
  const steps = desktop.jobs.desktop.steps;
  assert.ok(steps.findIndex(step => step.run === 'node scripts/ci-build-ref.mjs verify') < steps.findIndex(step => step.run === 'npm run make'));
  assert.deepEqual(desktop.jobs.desktop.strategy.matrix.os, ['windows-2025', 'ubuntu-24.04']);
});

test('metadata is called by the build workflow and hands off its committed version and SHA', () => {
  const metadata = workflow('update-application-metadata.yml');
  assert.ok(metadata.on.workflow_call, 'metadata generation must finish in the same dependency graph');
  assert.equal(metadata.on.push, undefined, 'a second independent push workflow must not race packaging');
  assert.ok(metadata.on.workflow_call.outputs.sha);
  assert.ok(metadata.on.workflow_call.outputs.version);
  const steps = metadata.jobs['update-application-metadata'].steps;
  const commit = steps.findIndex(step => step.name === 'Commit and push metadata only');
  const handoff = steps.findIndex(step => step.run === 'node scripts/ci-build-ref.mjs capture');
  assert.ok(commit >= 0 && handoff > commit, 'the immutable handoff is resolved after the metadata push succeeds');
  assert.deepEqual(workflow('desktop.yml').on.push['paths-ignore'], ['version.json'], 'the metadata-only push must not start duplicate packaging');
});

const evaluate = (expression, context) => runInNewContext(`Boolean(${expression.replace(/^\s*\$\{\{/, '').replace(/\}\}\s*$/, '')})`, context, {timeout: 100});
test('dev pushes and manual builds version first while pull requests and main stay read-only', () => {
  const condition = workflow('desktop.yml').jobs.version.if;
  for (const [event_name, ref, expected] of [['push', 'refs/heads/dev', true], ['workflow_dispatch', 'refs/heads/dev', true],
    ['push', 'refs/heads/main', false], ['workflow_dispatch', 'refs/heads/main', false], ['pull_request', 'refs/pull/1/merge', false],
    ['pull_request', 'refs/heads/dev', false]]) assert.equal(evaluate(condition, {github: {event_name, ref}}), expected);
  assert.deepEqual(workflow('desktop.yml').jobs.version.secrets,
    {HELPER_SYNC_APP_PRIVATE_KEY: '${{ secrets.HELPER_SYNC_APP_PRIVATE_KEY }}'});
});

test('failed, cancelled or superseded versioning cannot reach the packaging matrix', () => {
  const condition = workflow('desktop.yml').jobs.desktop.if;
  for (const [ref, result, sha, cancelled, expected] of [
    ['dev', 'success', 'a'.repeat(40), false, true], ['dev', 'failure', '', false, false],
    ['dev', 'cancelled', '', false, false], ['dev', 'success', '', false, false], ['dev', 'skipped', '', false, false],
    ['main', 'skipped', '', false, true], ['pull/1/merge', 'skipped', '', false, true],
    ['dev', 'success', 'a'.repeat(40), true, false]]) {
    assert.equal(evaluate(condition, {cancelled: () => cancelled, github: {ref: ref === 'pull/1/merge' ? 'refs/' + ref : 'refs/heads/' + ref},
      needs: {version: {result, outputs: {sha}}}}), expected);
  }
});

const git = (root, ...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'z2ma-ci-version-'));
  t.after(() => {
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !root.startsWith(join(tmpdir(), 'z2ma-ci-version-'))) throw new Error('Unexpected fixture cleanup path.');
    rmSync(root, {recursive: true, force: true});
  });
  git(root, 'init', '-b', 'dev');
  git(root, 'config', 'user.name', 'Versioning fixture');
  git(root, 'config', 'user.email', 'fixture@example.invalid');
  const commit = message => { git(root, 'add', 'version.json', 'source.txt'); git(root, 'commit', '-m', message); return git(root, 'rev-parse', 'HEAD'); };
  writeFileSync(join(root, 'version.json'), JSON.stringify({version: '0.1.0', build: 0, date: 0}) + '\n');
  writeFileSync(join(root, 'source.txt'), 'Synthetic source\n');
  const sourceSha = commit('Update synthetic source');
  const metadata = (version, source = sourceSha) => {
    writeFileSync(join(root, 'version.json'), JSON.stringify({version, build: parseInt(source.slice(0, 7), 16), date: Number(git(root, 'show', '-s', '--format=%ct', source))}) + '\n');
    return commit('CHORE: Update application metadata to v' + version);
  };
  return {root, sourceSha, commit, metadata};
}

test('metadata capture and reruns hand off the committed version instead of the original source', t => {
  const f = fixture(t); const sha = f.metadata('0.2.0');
  const selected = captureVersionedBuild({...f, version: '0.2.0'});
  assert.deepEqual(selected, {sha, version: '0.2.0'});
  assert.notEqual(selected.sha, f.sourceSha);
  assert.deepEqual(captureVersionedBuild({...f, version: '0.2.0'}), selected, 'retry reuses the same metadata commit');
  assert.deepEqual(captureVersionedBuild({...f, sourceSha: sha, skipped: 'metadata-only', version: '0.2.0'}), selected, 'manual run on an already versioned branch');
  assert.deepEqual(captureVersionedBuild({...f, skipped: 'superseded', version: '0.2.0'}), {sha: '', version: ''});
});

test('both platform checkouts retain the selected version even after the branch advances', t => {
  const f = fixture(t); const sha = f.metadata('0.2.0');
  const selected = captureVersionedBuild({...f, version: '0.2.0'});
  writeFileSync(join(f.root, 'source.txt'), 'Newer synthetic source\n');
  const laterSource = f.commit('Newer synthetic source'); f.metadata('0.3.0', laterSource);
  for (const platform of ['windows', 'ubuntu']) {
    const checkout = join(f.root, platform);
    git(f.root, 'clone', '--quiet', '--no-hardlinks', f.root, checkout);
    git(checkout, 'checkout', '--quiet', '--detach', sha);
    assert.deepEqual(verifyBuildCheckout({root: checkout, ...selected}), selected);
  }
});

test('mismatched commits, versions, uncommitted metadata and later source changes are rejected', t => {
  const f = fixture(t); const sha = f.metadata('0.2.0');
  assert.throws(() => verifyBuildCheckout({root: f.root, sha: f.sourceSha, version: '0.2.0'}), /selected commit/);
  assert.throws(() => verifyBuildCheckout({root: f.root, sha, version: '0.3.0'}), /Build version/);
  writeFileSync(join(f.root, 'version.json'), JSON.stringify({version: '0.3.0', build: 1, date: 1}) + '\n');
  assert.throws(() => captureVersionedBuild({...f, version: '0.3.0'}), /uncommitted/);
  f.commit('Newer source with a manual version');
  assert.throws(() => captureVersionedBuild({...f, version: '0.3.0'}), /newer source/);
  assert.throws(() => captureVersionedBuild({...f, sourceSha: 'dev', version: '0.3.0'}), /Invalid metadata/);
});

test('CLI exports the exact SHA and version for dependent jobs and verifies that checkout', t => {
  const f = fixture(t); const sha = f.metadata('0.2.0');
  const script = fileURLToPath(new URL('../scripts/ci-build-ref.mjs', import.meta.url));
  const output = join(f.root, 'job-outputs.txt');
  const env = {...process.env, GITHUB_OUTPUT: output, Z2MA_SOURCE_SHA: f.sourceSha, Z2MA_BUILD_VERSION: '0.2.0', Z2MA_METADATA_SKIPPED: ''};
  execFileSync(process.execPath, [script, 'capture'], {cwd: f.root, env});
  assert.equal(readFileSync(output, 'utf8'), `sha=${sha}\nversion=0.2.0\n`);
  const result = execFileSync(process.execPath, [script, 'verify'], {cwd: f.root, encoding: 'utf8', env: {...env, Z2MA_BUILD_SHA: sha}});
  assert.match(result, /CI_VERSIONED_CHECKOUT.*"version":"0.2.0"/);
});
