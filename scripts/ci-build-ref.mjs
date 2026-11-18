import {execFileSync} from 'node:child_process';
import {appendFileSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const shaPattern = /^[a-f0-9]{40}$/;
const metadataPrefix = 'CHORE: Update application metadata';
const git = (root, ...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8', timeout: 10000}).trim();

function checkedVersion(root, expected) {
  const metadata = JSON.parse(readFileSync(resolve(root, 'version.json'), 'utf8'));
  if (!/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(metadata.version)
      || !Number.isSafeInteger(metadata.build) || metadata.build < 0 || !Number.isSafeInteger(metadata.date) || metadata.date < 0
      || (expected && metadata.version !== expected)) throw new Error('Build version does not match the checked metadata.');
  if (git(root, 'status', '--porcelain', '--untracked-files=no')) throw new Error('Build checkout has uncommitted tracked changes.');
  return metadata.version;
}

export function captureVersionedBuild({root, sourceSha, skipped = '', version}) {
  if (!shaPattern.test(sourceSha) || !['', 'metadata-only', 'superseded'].includes(skipped)) throw new Error('Invalid metadata handoff.');
  if (skipped === 'superseded') return {sha: '', version: ''};
  if (!version) throw new Error('Metadata did not provide a build version.');
  const sha = git(root, 'rev-parse', 'HEAD');
  if (!shaPattern.test(sha)) throw new Error('Invalid checkout commit.');
  if (sha !== sourceSha) {
    git(root, 'merge-base', '--is-ancestor', sourceSha, sha);
    const files = git(root, 'diff', '--name-only', sourceSha, sha);
    const subjects = git(root, 'log', '--format=%s', `${sourceSha}..${sha}`).split('\n');
    if (files !== 'version.json' || subjects.some(subject => !subject.startsWith(metadataPrefix)))
      throw new Error('A newer source change cannot be used for this build.');
  }
  return {sha, version: checkedVersion(root, version)};
}

export function verifyBuildCheckout({root, sha, version = ''}) {
  if (!shaPattern.test(sha) || git(root, 'rev-parse', 'HEAD') !== sha) throw new Error('Build checkout does not match the selected commit.');
  return {sha, version: checkedVersion(root, version)};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = process.cwd();
  const mode = process.argv[2];
  if (mode === 'capture') {
    const selected = captureVersionedBuild({root, sourceSha: process.env.Z2MA_SOURCE_SHA,
      skipped: process.env.Z2MA_METADATA_SKIPPED ?? '', version: process.env.Z2MA_BUILD_VERSION});
    if (!process.env.GITHUB_OUTPUT) throw new Error('GitHub output file is required for the build handoff.');
    appendFileSync(process.env.GITHUB_OUTPUT, `sha=${selected.sha}\nversion=${selected.version}\n`);
    console.log('CI_VERSIONED_BUILD ' + JSON.stringify(selected));
  } else if (mode === 'verify') {
    console.log('CI_VERSIONED_CHECKOUT ' + JSON.stringify(verifyBuildCheckout({root,
      sha: process.env.Z2MA_BUILD_SHA, version: process.env.Z2MA_BUILD_VERSION ?? ''})));
  } else throw new Error('Expected capture or verify mode.');
}
