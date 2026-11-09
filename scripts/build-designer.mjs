import {readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

export const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'packages/designer/src');
const target = join(root, 'packages/designer/dist');
const catalogs = Object.fromEntries(['de', 'en'].map(language => [language, JSON.parse(readFileSync(join(source, 'locales', language + '.json'), 'utf8'))]));
assert.deepEqual(Object.keys(catalogs.de).sort(), Object.keys(catalogs.en).sort());
const parameters = text => [...text.matchAll(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g)].map(match => match[1]).sort();
for (const [key, text] of Object.entries(catalogs.en)) {
  assert.match(key, /^[a-z][a-zA-Z0-9_.]*$/);
  assert.equal(typeof text, 'string');
  assert.equal(typeof catalogs.de[key], 'string');
  assert.ok(text.trim() && catalogs.de[key].trim());
  assert.deepEqual(parameters(text), parameters(catalogs.de[key]), key);
  assert.doesNotMatch(text + catalogs.de[key], /<\/?[a-z][^>]*>/i, key);
}
const checking = process.argv.includes('--check');
const write = (file, value) => checking ? assert.deepEqual(readFileSync(file), Buffer.from(value), file + ': stale generated asset') : writeFileSync(file, value);
const copy = (from, to) => write(to, readFileSync(from));
if (!checking) {
  rmSync(target, {recursive: true, force: true});
  mkdirSync(join(target, 'assets/locales'), {recursive: true});
}
const files = readdirSync(source).filter(name => /\.(js|css|html)$/.test(name)).sort();
for (const name of files) {
  const content = readFileSync(join(source, name), 'utf8');
  for (const match of content.matchAll(/\bt\(["']([^"']+)["']|data-i18n(?:-title|-placeholder|-aria-label)?="([^"]+)"/g)) {
    const key = match[1] ?? match[2];
    assert.ok(Object.hasOwn(catalogs.en, key) || Object.hasOwn(catalogs.en, key + '.other'), name + ': ' + key);
  }
  copy(join(source, name), join(target, 'assets', name));
}
for (const language of ['de', 'en']) copy(join(source, 'locales', language + '.json'), join(target, 'assets/locales', language + '.json'));
write(join(target, 'assets/locales.js'), '/* Generated from local JSON catalogs. */\nexport const catalogs = ' + JSON.stringify(catalogs) + ';\n');
const messages = JSON.parse(readFileSync(join(source, 'native-messages.json'), 'utf8'));
for (const [key, text] of Object.entries(catalogs.de)) if (!key.startsWith('server.')) messages[key] = [text, catalogs.en[key]];
write(join(target, 'assets/locales/messages.json'), JSON.stringify(messages, null, 4) + '\n');
const hash = file => createHash('sha256').update(readFileSync(join(target, 'assets', file))).digest('hex');
const names = [...files, 'locales.js', 'locales/de.json', 'locales/en.json', 'locales/messages.json'].sort();
const assets = Object.fromEntries(names.map(name => [name, hash(name)]));
const manifest = {format: 1, name: '@z2ma/designer', version: JSON.parse(readFileSync(join(root, 'version.json'), 'utf8')).version,
  source: 'https://github.com/Burki24/Z2M-Automations', origin: {repository: 'https://github.com/Burki24/Symcon_Z2MAutomations', commit: 'cd5cfc33c921365c69814078238444c3ea7d5ac5'},
  license: 'PolyForm-Noncommercial-1.0.0', content: createHash('sha256').update(JSON.stringify(assets)).digest('hex'), assets};
write(join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
copy(join(root, 'packages/designer/LICENSE'), join(target, 'LICENSE'));
write(join(target, 'package.json'), JSON.stringify({name: manifest.name, version: manifest.version, license: manifest.license, private: true}, null, 2) + '\n');
console.log('Shared designer built: ' + names.length + ' assets; ' + manifest.content.slice(0, 12));
