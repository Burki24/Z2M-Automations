import {readFileSync, readdirSync} from 'node:fs';
import {dirname, extname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const metadata = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8'));
if (!/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(metadata.version)
    || !Number.isSafeInteger(metadata.build) || metadata.build < 0
    || !Number.isSafeInteger(metadata.date) || metadata.date < 0) {
  throw new Error('Invalid application version metadata.');
}
const excluded = new Set(['.git', '.cache', 'node_modules', 'vendor', 'private', 'local-data', 'backups', 'out', 'dist', 'coverage', '.build', 'artifacts', 'test-results']);
const extensions = new Set(['.md', '.json', '.yml', '.yaml', '.js', '.mjs', '.ts', '.cjs', '.css', '.html']);
let checked = 0;
function scan(directory) {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    if (entry.isSymbolicLink()) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { if (!excluded.has(entry.name)) scan(path); continue; }
    if (!extensions.has(extname(entry.name)) && !['.editorconfig', '.gitattributes', '.gitignore'].includes(entry.name)) continue;
    const text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(readFileSync(path));
    if (text.startsWith('\uFEFF') || text.includes('\r') || !text.endsWith('\n')
        || /\uFFFD|\u00C3[\u0080-\u00BF]|\u00E2\u20AC[\u0090-\u00BF]/u.test(text)) {
      throw new Error(`Invalid text encoding or line endings: ${relative(root, path)}`);
    }
    checked++;
  }
}
scan(root);
console.log(`Project checks passed: ${checked} text files; application version ${metadata.version}.`);
