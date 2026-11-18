import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const require = createRequire(import.meta.url);
const {stageRuntimeDependencies} = require('../apps/desktop/runtime-dependencies.cjs');

test('packaging matchers support modern filters while legacy ASAR callers retain their function API', () => {
  const builder = createRequire(require.resolve('app-builder-lib'));
  const universal = createRequire(builder.resolve('@electron/universal'));
  for (const consumer of [builder, universal]) {
    const {Minimatch, minimatch} = consumer('minimatch');
    const filter = new Minimatch('**/*.{js,json}', {dot: true});
    assert.equal(filter.match('resources/.settings/config.json'), true);
    assert.equal(filter.match('resources/Daten/Grüße.js'), true);
    assert.equal(filter.match('resources/config.png'), false);
    assert.equal(minimatch('native/addon.node', '*.node', {matchBase: true}), true);
    assert.equal(minimatch('native/addon.txt', '*.node', {matchBase: true}), false);
  }
  const legacyAsar = createRequire(builder.resolve('@electron/asar'));
  const legacyMatcher = legacyAsar('minimatch');
  assert.equal(typeof legacyMatcher, 'function', 'the security override must not replace the older callable API');
  assert.equal(legacyMatcher('resources/config.json', '**/*.json'), true);
});

test('Electron rebuild can find native build files and verify cached headers', async t => {
  const builder = createRequire(require.resolve('app-builder-lib'));
  const rebuild = createRequire(builder.resolve('@electron/rebuild'));
  const gyp = createRequire(rebuild.resolve('node-gyp'));
  const runner = rebuild('node-gyp')();
  runner.parseArgv(['node', 'node-gyp', 'rebuild', '--target=42.0.0']);
  assert.deepEqual(runner.todo.map(command => command.name), ['rebuild']);

  const directory = await mkdtemp(join(tmpdir(), 'z2ma-rebuild-test-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  await mkdir(join(directory, 'build'));
  await writeFile(join(directory, 'build', 'addon.sln'), '');
  await writeFile(join(directory, 'build', 'addon.mk'), '');
  const {glob} = gyp('glob');
  assert.deepEqual(await glob('build/*.sln', {cwd: directory}), [join('build', 'addon.sln')]);

  const fetch = createRequire(gyp.resolve('make-fetch-happen'));
  const cache = fetch('cacache');
  const storage = join(directory, 'headers');
  await cache.put(storage, 'synthetic-headers', 'header data');
  assert.equal((await cache.verify(storage)).verifiedContent, 1);
  assert.equal((await cache.get(storage, 'synthetic-headers')).data.toString(), 'header data');
});

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
