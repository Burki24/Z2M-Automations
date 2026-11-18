import './build-designer.mjs';
import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync, cpSync, mkdirSync, copyFileSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {root} from './build-designer.mjs';
import {createHash} from 'node:crypto';
import {buildHelp} from './build-help.mjs';

// Fixed generated directory inside the workspace; never project/user storage.
rmSync(join(root, 'apps/desktop/.build'), {recursive: true, force: true});
const result = spawnSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--project', 'apps/desktop/tsconfig.json'], {cwd: root, stdio: 'inherit'});
if (result.status !== 0) process.exit(result.status ?? 1);
// The exact shared pure source also runs behind the desktop's privileged IPC boundary.
const mergeSource = readFileSync(join(root, 'packages/designer/src/draft-merge.js'), 'utf8');
const mergeExports = [...mergeSource.matchAll(/^export function (\w+)\(/gm)].map(match => match[1]);
const mergeBody = mergeSource.replaceAll(/^export (?=function )/gm, '');
if (!mergeExports.length || /^\s*(?:import|export)\b/m.test(mergeBody)) throw new Error('Shared reconciliation must remain a self-contained pure module.');
writeFileSync(join(root, 'apps/desktop/.build/draft-merge.cjs'), mergeBody + '\nmodule.exports = {' + mergeExports.join(', ') + '};\n');
const destination = join(root, 'apps/desktop/.build/renderer');
mkdirSync(destination, {recursive: true});
cpSync(join(root, 'packages/designer/dist/assets'), destination, {recursive: true});
cpSync(join(root, 'apps/desktop/renderer'), destination, {recursive: true});
const index = readFileSync(join(destination, 'index.html'), 'utf8').replace('src="designer.js"', 'src="desktop.js"').replace('</head>', '    <link rel="stylesheet" href="desktop-palette.css">\n    <link rel="stylesheet" href="desktop.css">\n</head>');
writeFileSync(join(destination, 'index.html'), index);
buildHelp(root, destination);
copyFileSync(join(root, 'packages/designer/dist/manifest.json'), join(root, 'apps/desktop/.build/designer-package.json'));
copyFileSync(join(root, 'version.json'), join(root, 'apps/desktop/.build/version.json'));
copyFileSync(join(root, 'LICENSE'), join(root, 'apps/desktop/.build/LICENSE'));
const schemaRoot = join(root, 'apps/desktop/schema');
const provenance = JSON.parse(readFileSync(join(schemaRoot, 'provenance.json'), 'utf8'));
if (createHash('sha256').update(readFileSync(join(schemaRoot, 'automations.schema.json'))).digest('hex') !== provenance.sha256) throw new Error('Schema artifact integrity mismatch.');
cpSync(schemaRoot, join(root, 'apps/desktop/.build/schema'), {recursive: true});
const extensionRoot = join(root, 'apps/desktop/extension');
const extension = JSON.parse(readFileSync(join(extensionRoot, 'provenance.json'), 'utf8'));
if (extension.schemaSha256 !== provenance.sha256 || createHash('sha256').update(readFileSync(join(extensionRoot, 'z2m-automations.mjs'))).digest('hex') !== extension.sha256) throw new Error('Extension artifact integrity mismatch.');
cpSync(extensionRoot, join(root, 'apps/desktop/.build/extension'), {recursive: true});
console.log('Desktop compiled and local assets staged.');
