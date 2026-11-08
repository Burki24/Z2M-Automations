import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const require = createRequire(import.meta.url);
const {assetPath, entryURL, trustedSender, rendererPreferences, validPayload} = require('../apps/desktop/.build/security.js');
const {Diagnostics} = require('../apps/desktop/.build/diagnostics.js');
const {OfflineWorkspace} = require('../apps/desktop/.build/offline-workspace.js');
const {configureSmokeRendering} = require('../apps/desktop/.build/smoke-rendering.js');

test('software rendering is confined to explicit Linux CI smoke and never normal launches', () => {
  for (const platform of ['linux', 'win32', 'darwin']) for (const smoke of [false, true]) for (const ci of [false, true]) {
    let calls = 0;
    const configured = configureSmokeRendering({disableHardwareAcceleration: () => calls++}, {platform, smoke, ci});
    const expected = platform === 'linux' && smoke && ci;
    assert.equal(configured, expected);
    assert.equal(calls, expected ? 1 : 0);
  }
});

test('Forge reuses the same explicit Electron download cache as tool setup', () => {
  const original = process.env.electron_config_cache;
  const config = require.resolve('../apps/desktop/forge.config.cjs');
  try {
    process.env.electron_config_cache = join(tmpdir(), 'z2ma-synthetic-download-cache');
    delete require.cache[config];
    const forge = require(config);
    assert.equal(forge.packagerConfig.download.cacheRoot, process.env.electron_config_cache);
    assert.deepEqual(forge.packagerConfig.download.checksums, require('electron/checksums.json'));
    assert.equal(forge.packagerConfig.download.unsafelyDisableChecksums, undefined);
    assert.equal(forge.packagerConfig.download.mirrorOptions, undefined);
  } finally {
    if (original === undefined) delete process.env.electron_config_cache;
    else process.env.electron_config_cache = original;
    delete require.cache[config];
  }
});

test('Forge uses canonical application metadata for every maker without editing source manifests', async () => {
  const forge = require('../apps/desktop/forge.config.cjs');
  const metadata = JSON.parse(readFileSync(new URL('../version.json', import.meta.url), 'utf8'));
  const source = {name: 'fixture', version: '0.0.0'};
  const staged = await forge.hooks.readPackageJson(forge, source);
  assert.equal(staged.version, metadata.version);
  assert.equal(forge.packagerConfig.appVersion, metadata.version);
  assert.equal(source.version, '0.0.0');
  const deb = forge.makers.find(maker => maker.name === '@electron-forge/maker-deb');
  assert.equal(deb.config.options.bin, forge.packagerConfig.executableName, 'Linux binary path is case-sensitive');
});

test('Windows installer offers a per-user directory wizard and packages the canonical version', async () => {
  const forge = require('../apps/desktop/forge.config.cjs');
  const maker = forge.makers.find(maker => maker.name === 'nsis');
  await maker.prepareConfig('x64');
  const options = maker.getBuildOptions({dir: join(tmpdir(), 'synthetic-app'), targetArch: 'x64', appName: 'Z2M-Automations', forgeConfig: forge});
  assert.equal(options.config.nsis.oneClick, false);
  assert.equal(options.config.nsis.allowToChangeInstallationDirectory, true);
  assert.equal(options.config.nsis.perMachine, false);
  assert.equal(options.config.nsis.allowElevation, false);
  assert.equal(options.config.nsis.deleteAppDataOnUninstall, false);
  assert.deepEqual(options.config.nsis.installerLanguages, ['de_DE', 'en_US']);
  assert.equal(options.config.extraMetadata.version, JSON.parse(readFileSync(new URL('../version.json', import.meta.url))).version);
  assert.equal(options.config.executableName, 'Z2M-Automations');
  assert.equal(options.config.publish, null);
});

test('IPC accepts only the owned window main frame at its exact local entry', () => {
  assert.equal(trustedSender(1, 1, true, entryURL), true);
  for (const args of [[1, 2, true, entryURL], [1, 1, false, entryURL], [1, 1, true, entryURL + '#foreign'], [1, 1, true, 'https://app/index.html']]) assert.equal(trustedSender(...args), false);
  assert.equal(rendererPreferences.nodeIntegration, false);
  assert.equal(rendererPreferences.sandbox, true);
  assert.equal(rendererPreferences.contextIsolation, true);
});
test('asset protocol serves only fixed local names and never filesystem URLs or write requests', () => {
  const assets = new Set(['index.html', 'reader.js', 'locales/en.json']);
  assert.equal(assetPath(entryURL, 'GET', assets), 'index.html');
  assert.equal(assetPath('z2ma://app/locales/en.json', 'HEAD', assets), 'locales/en.json');
  for (const url of ['invalid URL', 'file:///etc/passwd', 'https://app/reader.js', 'z2ma://other/reader.js', 'z2ma://user@app/reader.js', 'z2ma://app/private.json', 'z2ma://app/%2e%2e/private.json', 'z2ma://app/locales%2fen.json', entryURL + '?path=secret']) assert.equal(assetPath(url, 'GET', assets), null);
  assert.equal(assetPath(entryURL, 'POST', assets), null);
});
test('fixed payload schemas reject extra fields, private content and unsupported operations', () => {
  assert.equal(validPayload('select-system', 'example-a'), true);
  assert.equal(validPayload('select-system', 'mqtt://private.invalid'), false);
  assert.equal(validPayload('snapshot', {path: 'private'}), false);
  assert.equal(validPayload('language', {language: 'en', previousLanguage: 'de', openEditor: false}), true);
  for (const value of [{language: ['en'], previousLanguage: 'de', openEditor: false}, {language: 'fr', previousLanguage: 'de', openEditor: false}, {language: 'en', previousLanguage: 'de', openEditor: false, content: 'PRIVATE'}, null, ['en']]) assert.equal(validPayload('language', value), false);
  assert.equal(validPayload('recording', 'publish'), false);
});
test('debug is opt-in, bounded, sanitized and expires without extending its end', () => {
  let now = 1000;
  const debug = new Diagnostics(() => now);
  debug.record('ready'); assert.deepEqual(debug.read().events, []);
  const originalEnd = debug.control('start').end;
  for (let n = 0; n < 250; n++) debug.record('snapshotRead', 'private password', 'PRIVATE');
  assert.equal(debug.read().events.length, 200);
  assert.equal(JSON.stringify(debug.read()).includes('PRIVATE'), false);
  now += 10000;
  assert.equal(debug.control('start').end, originalEnd);
  assert.equal(debug.read().end, originalEnd);
  now = originalEnd;
  debug.record('ready');
  assert.equal(debug.read().active, false);
  assert.equal(debug.read().expired, true);
  assert.equal(debug.read().events.length, 200);
  assert.equal(debug.control('stop').expired, false);
});
test('system selection and language diagnostics cannot mutate either example configuration', () => {
  const debug = new Diagnostics(); debug.control('start');
  const workspace = new OfflineWorkspace(debug, 'linux', '0.2.0');
  const first = workspace.snapshot();
  assert.equal(first.configuration.automations[0].enabled, false);
  first.configuration.automations[0].name = 'changed externally';
  workspace.select('example-b');
  const second = workspace.snapshot();
  assert.notEqual(second.devices[0].target.id, first.devices[0].target.id);
  assert.notEqual(second.configuration.automations[0].id, first.configuration.automations[0].id);
  assert.throws(() => workspace.select('unknown'));
  assert.equal(workspace.snapshot().workspaceContext.systemId, 'example-b');
  workspace.select('example-a');
  assert.equal(workspace.snapshot().configuration.automations[0].name, 'Hall light on motion');
  assert.equal(debug.read().events.filter(event => event.code === 'systemSelected').length, 2);
});
