import {readFileSync, readdirSync} from 'node:fs';
import {dirname, join, posix, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const excluded = new Set(['.git', '.cache', 'node_modules', 'vendor', 'private', 'local-data', 'backups', 'out', 'dist', 'coverage', '.build', 'artifacts', 'test-results']);
const files = new Set();
function scan(directory, prefix = '') {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    if (entry.isSymbolicLink()) continue;
    const name = prefix + entry.name;
    if (entry.isDirectory()) {
      if (!excluded.has(entry.name)) scan(join(directory, entry.name), `${name}/`);
    } else files.add(name);
  }
}
scan(root);

// Check repository Markdown syntax only; code examples are never link targets.
function prose(source) {
  let fence;
  return source.split('\n').map(line => {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker && !fence) { fence = marker; return ''; }
    if (fence) {
      if (marker?.[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      return '';
    }
    return line;
  }).join('\n');
}
function headings(text) {
  return [...text.matchAll(/^(#{1,6}) (.+)$/gm)];
}
function anchors(text) {
  const result = new Set([...text.matchAll(/<a\s+id="([^"]+)"/g)].map(match => match[1]));
  const used = new Map();
  for (const [, , title] of headings(text)) {
    const slug = title.toLowerCase().replace(/<[^>]*>/g, '')
      .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-');
    const count = used.get(slug) ?? 0;
    used.set(slug, count + 1);
    result.add(count ? `${slug}-${count}` : slug);
  }
  return result;
}
function links(text) {
  return [...text.matchAll(/(!?)\[([^\]\n]*)\]\(([^)\s]+)\)/g)]
    .map(([, image, label, target]) => ({image: !!image, label, target}));
}
const documents = new Map([...files].filter(file => file.endsWith('.md'))
  .map(file => [file, prose(readFileSync(join(root, file), 'utf8'))]));
let pairs = 0;
let localLinks = 0;
for (const [file, text] of documents) {
  const german = file.endsWith('_DE.md');
  const companion = german ? file.replace(/_DE\.md$/, '.md') : file.replace(/\.md$/, '_DE.md');
  if (!documents.has(companion)) throw new Error(`Missing documentation companion: ${companion}`);
  const nav = german ? `**Deutsch | [English](${posix.basename(companion)})**`
    : `**English | [Deutsch](${posix.basename(companion)})**`;
  if (!text.split('\n').slice(0, 8).includes(nav)) throw new Error(`Missing prominent language link: ${file}`);
  if (!german) {
    const original = headings(text).map(match => match[1].length);
    const translated = headings(documents.get(companion)).map(match => match[1].length);
    // The existing manuals have independently written subsections and common chapter IDs.
    if (file !== 'docs/USER_GUIDE.md' && JSON.stringify(original) !== JSON.stringify(translated)) {
      throw new Error(`Documentation heading structure differs: ${file}`);
    }
    pairs++;
  }
  for (const link of links(text)) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(link.target)) continue;
    const [rawPath, rawFragment] = link.target.replace(/^<|>$/g, '').split('#');
    const path = rawPath ? posix.normalize(posix.join(posix.dirname(file), decodeURIComponent(rawPath))) : file;
    // The set preserves spelling even on a case-insensitive Windows filesystem.
    if (!files.has(path)) throw new Error(`Missing or incorrectly cased link in ${file}: ${link.target}`);
    if (rawFragment && documents.has(path) && !anchors(documents.get(path)).has(decodeURIComponent(rawFragment))) {
      throw new Error(`Unknown documentation anchor in ${file}: ${link.target}`);
    }
    if (german && documents.has(path) && !path.endsWith('_DE.md') && !/English|englisch/i.test(link.label)) {
      throw new Error(`German navigation points to English documentation: ${file}: ${link.target}`);
    }
    localLinks++;
  }
}

const manifest = JSON.parse(readFileSync(join(root, 'docs/images/manifest.json'), 'utf8'));
const scenarios = {};
const declared = new Set();
for (const item of manifest.screenshots) {
  if (!['de', 'en'].includes(item.language) || !new RegExp(`^images/${item.language}/[\\w-]+\\.png$`).test(item.file)
      || declared.has(item.file)) throw new Error('Invalid or duplicate screenshot manifest entry.');
  const path = `docs/${item.file}`;
  if (!files.has(path)) throw new Error(`Missing or incorrectly cased screenshot: ${path}`);
  const bytes = readFileSync(join(root, path));
  if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
      || bytes.toString('ascii', 12, 16) !== 'IHDR' || bytes.length !== item.bytes
      || bytes.readUInt32BE(16) !== item.width || bytes.readUInt32BE(20) !== item.height) {
    throw new Error(`Screenshot dimensions/size do not match the manifest: ${path}`);
  }
  declared.add(item.file);
}
for (const [language, file] of [['en', 'docs/USER_GUIDE.md'], ['de', 'docs/USER_GUIDE_DE.md']]) {
  const images = links(documents.get(file)).filter(link => link.image).map(link => link.target);
  const listed = manifest.screenshots.filter(item => item.language === language).map(item => item.file);
  if (!images.length || images.length !== new Set(images).size || images.length !== listed.length
      || images.some(image => !listed.includes(image))) throw new Error(`Manual screenshot language/mapping mismatch: ${file}`);
  scenarios[language] = images.map(image => posix.basename(image));
}
if (JSON.stringify(scenarios.en) !== JSON.stringify(scenarios.de)) throw new Error('Manual screenshot scenario order differs.');
console.log(`Documentation checks passed: ${pairs} language pairs, ${localLinks} local links, ${scenarios.en.length} matching screenshots per language; no capture.`);
