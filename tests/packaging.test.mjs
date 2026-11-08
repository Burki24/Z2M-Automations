import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const require = createRequire(import.meta.url);
const {stageRuntimeDependencies} = require('../apps/desktop/runtime-dependencies.cjs');

test('native workspace packaging stages its production dependency closure and licenses without development tools', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'z2ma-package-test-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const count = stageRuntimeDependencies(directory); assert.ok(count > 1);
  const staged = createRequire(join(directory, 'package.json'));
  assert.ok(staged.resolve('mqtt').startsWith(directory));
  assert.equal(typeof staged('mqtt').connect, 'function');
  assert.equal(existsSync(join(directory, 'node_modules/typescript')), false);
  assert.equal(existsSync(join(directory, 'node_modules/@electron-forge')), false);
  const manifest = JSON.parse(await readFile(join(directory, 'node_modules/mqtt/package.json'), 'utf8'));
  assert.equal(manifest.version, '5.16.1');
  const original = await readFile(new URL('../node_modules/mqtt/LICENSE.md', import.meta.url));
  assert.deepEqual(await readFile(join(directory, 'node_modules/mqtt/LICENSE.md')), original);
});
