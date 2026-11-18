import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {renderManual, inlineManual} from '../scripts/build-help.mjs';
const require = createRequire(import.meta.url);
const {validHelpRequest, helpURL, helpSections, allowedHelpNavigation} = require('../apps/desktop/.build/help.js');
const {validPayload, trustedSender} = require('../apps/desktop/.build/security.js');

test('help IPC accepts only fixed languages and handbook chapters, without file or control authority', () => {
  for (const language of ['de', 'en']) for (const section of helpSections) {
    assert.equal(validPayload('help', {language, section}), true);
    assert.equal(helpURL({language, section}), `z2ma://app/help/${language}.html#${section}`);
  }
  for (const value of [null, {}, ['en'], {language: 'fr', section: 'project'}, {language: 'en', section: '../private'},
    {language: 'en', section: 'store'}, {language: 'en', section: 'project', url: 'file:///private'}, {language: 'en', section: '<script>'}]) {
    assert.equal(validHelpRequest(value), false);
    assert.equal(validPayload('help', value), false);
    assert.throws(() => helpURL(value));
  }
  for (const url of ['https://app/help/en.html', 'z2ma://evil/help/en.html', 'file:///help/en.html', 'z2ma://app/index.html', 'z2ma://app/help/en.html?command=store', 'z2ma://name@app/help/de.html']) assert.equal(allowedHelpNavigation(url), false);
  assert.equal(allowedHelpNavigation('z2ma://app/help/de.html#project'), true);
  assert.equal(trustedSender(1, 1, true, 'z2ma://app/help/en.html'), false);
});
test('offline manuals retain all chapters, localized image paths and exact packaged image bytes', () => {
  const directory = new URL('../apps/desktop/.build/renderer/help/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'));
  for (const language of ['de', 'en']) {
    const html = readFileSync(new URL(language + '.html', directory), 'utf8');
    assert.ok(html.includes(`<html lang="${language}">`));
    for (const chapter of helpSections) assert.ok(html.includes(`id="${chapter}"`), chapter);
    const images = [...html.matchAll(/<img [^>]*src="([^"]+)"/g)].map(match => match[1]);
    assert.equal(images.length, 16);
    assert.ok(images.every(image => image.startsWith('images/' + language + '/')));
    assert.ok(!/https?:|file:|<iframe|<script[^>]*>(?!<\/script>)/.test(html));
  }
  for (const asset of manifest.assets) {
    const bytes = readFileSync(new URL(asset.file, directory));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    if (asset.file.startsWith('images/')) assert.ok(bytes.equals(readFileSync(new URL('../docs/' + asset.file, import.meta.url))));
  }
});
test('manual conversion escapes raw HTML, forbids active or foreign links and preserves list continuation numbers', () => {
  assert.equal(inlineManual('**English | [Deutsch](USER_GUIDE_DE.md)**'), '<strong>English | <a href="de.html">Deutsch</a></strong>');
  assert.ok(renderManual('<script>alert(1)</script>').includes('&lt;script&gt;'));
  for (const source of ['[Run](javascript:alert)', '[Remote](https://example.invalid)', '![Private](../private.png)']) assert.throws(() => inlineManual(source));
  const html = renderManual('4. Continue **safely**\n   with `values`.\n\n~~~sh\n<command>\n~~~\n\n| Name | Value |\n| --- | --- |\n| Test | Yes |');
  assert.ok(html.includes('<ol start="4">'));
  assert.ok(html.includes('<strong>safely</strong> with <code>values</code>'));
  assert.ok(html.includes('&lt;command&gt;'));
  assert.ok(html.includes('<th scope="col">Name</th>'));
});
