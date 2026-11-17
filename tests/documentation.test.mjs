import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {dirname, join, relative, resolve} from 'node:path';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'z2ma-docs-'));
  const withinTemp = relative(resolve(tmpdir()), root);
  assert.ok(withinTemp.startsWith('z2ma-docs-') && !withinTemp.includes('..'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const write = (file, text) => {
    mkdirSync(dirname(join(root, file)), {recursive: true});
    writeFileSync(join(root, file), text);
  };
  write('scripts/check-documentation.mjs', readFileSync(new URL('../scripts/check-documentation.mjs', import.meta.url)));
  write('README.md', '# Reference\n\n**English | [Deutsch](README_DE.md)**\n\n## Usage\n\n[Manual](docs/USER_GUIDE.md#usage)\n');
  write('README_DE.md', '# Referenz\n\n**Deutsch | [English](README.md)**\n\n<a id="usage"></a>\n## Benutzung\n\n[Handbuch](docs/USER_GUIDE_DE.md#usage)\n');
  const manifest = {screenshots: []};
  for (const language of ['en', 'de']) {
    const name = language === 'en' ? 'USER_GUIDE.md' : 'USER_GUIDE_DE.md';
    const nav = language === 'en' ? '**English | [Deutsch](USER_GUIDE_DE.md)**' : '**Deutsch | [English](USER_GUIDE.md)**';
    const file = `images/${language}/04-systems.png`;
    write(`docs/${name}`, `# Manual\n\n${nav}\n\n<a id="usage"></a>\n## Usage\n\n![Systems](${file})\n`);
    // Reuse an existing authorized image; the checker and test never capture a screen.
    const original = new URL(`../docs/${file}`, import.meta.url);
    const bytes = readFileSync(original);
    mkdirSync(join(root, `docs/images/${language}`), {recursive: true});
    copyFileSync(original, join(root, `docs/${file}`));
    manifest.screenshots.push({language, file, bytes: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)});
  }
  write('docs/images/manifest.json', JSON.stringify(manifest));
  return {
    write,
    remove: file => rmSync(join(root, file)),
    replace: (file, from, to) => write(file, readFileSync(join(root, file), 'utf8').replace(from, to)),
    check: () => execFileSync(process.execPath, [join(root, 'scripts/check-documentation.mjs')], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']})
  };
}

test('documentation check accepts complete linked pairs and reused language-specific images without capture', t => {
  assert.match(fixture(t).check(), /2 language pairs.*1 matching screenshots per language; no capture/);
});

for (const [name, mutate, reason] of [
  ['a missing translation', f => f.remove('README_DE.md'), /Missing documentation companion/],
  ['a hidden language link', f => f.replace('README_DE.md', '**Deutsch | [English](README.md)**', ''), /Missing prominent language link/],
  ['an omitted translated section', f => f.replace('README_DE.md', '## Benutzung', 'Benutzung'), /heading structure differs/],
  ['wrong filename case even on Windows', f => f.replace('README.md', 'docs/USER_GUIDE.md#usage', 'docs/user_guide.md#usage'), /incorrectly cased link/],
  ['a broken chapter anchor', f => f.replace('README.md', '#usage)', '#missing)'), /Unknown documentation anchor/],
  ['unintentional English navigation in German', f => f.replace('README_DE.md', 'docs/USER_GUIDE_DE.md#usage', 'docs/USER_GUIDE.md#usage'), /German navigation points to English/],
  ['the wrong screenshot language', f => f.replace('docs/USER_GUIDE_DE.md', 'images/de/', 'images/en/'), /screenshot language\/mapping mismatch/],
  ['stale screenshot metadata', f => f.replace('docs/images/manifest.json', /"width":\d+/, '"width":0'), /dimensions\/size do not match/]
]) {
  test(`documentation check rejects ${name}`, t => {
    const f = fixture(t);
    mutate(f);
    assert.throws(f.check, error => reason.test(error.stderr?.toString() ?? ''));
  });
}
