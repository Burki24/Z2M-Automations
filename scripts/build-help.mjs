import {readFileSync, writeFileSync, mkdirSync, copyFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {createHash} from 'node:crypto';

const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function target(value, image) {
  if (image) {
    if (!/^images\/(?:de|en)\/[\w-]+\.png$/.test(value)) throw new Error('Unsupported manual image.');
    return value;
  }
  if (/^#[a-z0-9-]+$/.test(value)) return value;
  if (value === 'USER_GUIDE.md') return 'en.html';
  if (value === 'USER_GUIDE_DE.md') return 'de.html';
  throw new Error('Unsupported offline manual link: ' + value);
}
export function inlineManual(value) {
  const pattern = /(`[^`]+`|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]*)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*)/g;
  let html = ''; let last = 0;
  for (const match of value.matchAll(pattern)) {
    html += escape(value.slice(last, match.index));
    if (match[0].startsWith('`')) html += '<code>' + escape(match[0].slice(1, -1)) + '</code>';
    else if (match[2] !== undefined) html += '<img loading="lazy" alt="' + escape(match[2]) + '" src="' + target(match[3], true) + '">';
    else if (match[4] !== undefined) html += '<a href="' + target(match[5], false) + '">' + escape(match[4]) + '</a>';
    else html += '<strong>' + inlineManual(match[6]) + '</strong>';
    last = match.index + match[0].length;
  }
  return html + escape(value.slice(last));
}
// Deliberately limited to the committed handbook syntax; no raw HTML execution.
export function renderManual(source) {
  const lines = source.replaceAll('\r', '').split('\n'); let html = ''; let index = 0;
  const block = line => !line.trim() || /^(?:#{1,6} |<a id=|~~~|```|\||\s*(?:\d+\.|-) )/.test(line);
  while (index < lines.length) {
    const line = lines[index++];
    if (!line.trim()) continue;
    const anchor = /^<a id="([a-z0-9-]+)"><\/a>$/.exec(line);
    if (anchor) { html += '<span class="chapter-anchor" id="' + anchor[1] + '"></span>\n'; continue; }
    const heading = /^(#{1,6}) (.+)$/.exec(line);
    if (heading) {
      const id = heading[2].toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-');
      html += '<h' + heading[1].length + ' id="' + id + '">' + inlineManual(heading[2]) + '</h' + heading[1].length + '>\n'; continue;
    }
    if (/^(~~~|```)/.test(line)) {
      const code = [];
      while (index < lines.length && !lines[index].startsWith(line.slice(0, 3))) code.push(lines[index++]);
      if (index === lines.length) throw new Error('Unclosed manual code block.');
      index++; html += '<pre><code>' + escape(code.join('\n')) + '</code></pre>\n'; continue;
    }
    if (line.startsWith('|')) {
      const row = value => value.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
      html += '<div class="table-scroll"><table><thead><tr>' + row(line).map(cell => '<th scope="col">' + inlineManual(cell) + '</th>').join('') + '</tr></thead><tbody>';
      if (!/^\|[\s:|-]+$/.test(lines[index] ?? '')) throw new Error('Invalid manual table.');
      index++;
      while (index < lines.length && lines[index].startsWith('|')) html += '<tr>' + row(lines[index++]).map(cell => '<td>' + inlineManual(cell) + '</td>').join('') + '</tr>';
      html += '</tbody></table></div>\n'; continue;
    }
    const list = /^\s*(?:(\d+)\.|(-)) (.+)$/.exec(line);
    if (list) {
      const ordered = !!list[1]; const tag = ordered ? 'ol' : 'ul';
      html += '<' + tag + (ordered ? ' start="' + Number(list[1]) + '"' : '') + '>';
      let current = line;
      while (true) {
        const match = /^\s*(?:\d+\.|-) (.+)$/.exec(current); let content = match[1];
        while (index < lines.length && lines[index].trim() && !block(lines[index])) content += ' ' + lines[index++].trim();
        html += '<li>' + inlineManual(content) + '</li>';
        if (index >= lines.length || !(ordered ? /^\s*\d+\. / : /^\s*- /).test(lines[index])) break;
        current = lines[index++];
      }
      html += '</' + tag + '>\n'; continue;
    }
    let paragraph = line;
    while (index < lines.length && !block(lines[index])) paragraph += ' ' + lines[index++].trim();
    html += '<p>' + inlineManual(paragraph) + '</p>\n';
  }
  return html;
}
export function buildHelp(root, renderer) {
  const directory = join(renderer, 'help'); mkdirSync(directory, {recursive: true});
  const manifest = JSON.parse(readFileSync(join(root, 'docs/images/manifest.json'), 'utf8'));
  const assets = [];
  for (const language of ['en', 'de']) {
    const catalog = JSON.parse(readFileSync(join(root, 'packages/designer/src/locales', language + '.json'), 'utf8'));
    const t = key => { if (!catalog['desktop.help.' + key]) throw new Error('Missing help translation: ' + key); return catalog['desktop.help.' + key]; };
    const source = readFileSync(join(root, 'docs', language === 'de' ? 'USER_GUIDE_DE.md' : 'USER_GUIDE.md'), 'utf8');
    const body = renderManual(source);
    const chapters = [...source.matchAll(/^<a id="([a-z0-9-]+)"><\/a>$/gm)].map(match => match[1]);
    if (chapters.length !== 20) throw new Error('The offline manual must contain all 20 chapters.');
    const other = language === 'en' ? 'de' : 'en';
    const html = '<!doctype html>\n<html lang="' + language + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
      + '<title>' + escape(t('title')) + '</title><link rel="stylesheet" href="../desktop-palette.css"><link rel="stylesheet" href="manual.css"><script type="module" src="manual.js"></script></head>'
      + '<body data-image-label="' + escape(t('image')) + '" data-close="' + escape(t('close')) + '" data-matches="' + escape(t('matches')) + '" data-no-matches="' + escape(t('noMatches')) + '"><header><strong>' + escape(t('title')) + '</strong>'
      + '<a id="help-contents" href="#' + (language === 'en' ? 'contents' : 'inhalt') + '">' + escape(t('contents')) + '</a><a id="help-language" lang="' + other + '" href="' + other + '.html">' + (other === 'en' ? 'English' : 'Deutsch') + '</a>'
      + '<form id="help-search"><label for="help-query">' + escape(t('search')) + '</label><input id="help-query" type="search" maxlength="120"><button>' + escape(t('next')) + '</button><span id="help-search-status" role="status"></span></form></header>'
      + '<main id="manual">' + body + '</main></body></html>\n';
    writeFileSync(join(directory, language + '.html'), html);
    assets.push({file: language + '.html', sha256: createHash('sha256').update(html).digest('hex'), chapters});
  }
  for (const image of manifest.screenshots) {
    const source = join(root, 'docs', image.file); const bytes = readFileSync(source);
    if (bytes.length !== image.bytes) throw new Error('Stale handbook image: ' + image.file);
    const destination = join(directory, image.file); mkdirSync(dirname(destination), {recursive: true}); copyFileSync(source, destination);
    assets.push({file: image.file, sha256: createHash('sha256').update(bytes).digest('hex')});
  }
  for (const file of ['manual.css', 'manual.js']) {
    const bytes = readFileSync(join(root, 'apps/desktop/help', file)); copyFileSync(join(root, 'apps/desktop/help', file), join(directory, file));
    assets.push({file, sha256: createHash('sha256').update(bytes).digest('hex')});
  }
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify({format: 1, captureVersion: manifest.version, assets}, null, 2) + '\n');
  console.log('Offline DE/EN handbooks staged with ' + manifest.screenshots.length + ' matching images.');
}
