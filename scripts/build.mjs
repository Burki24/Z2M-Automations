import './build-designer.mjs';
import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync, cpSync, mkdirSync, copyFileSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {root} from './build-designer.mjs';

// Fixed generated directory inside the workspace; never project/user storage.
rmSync(join(root, 'apps/desktop/.build'), {recursive: true, force: true});
const result = spawnSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--project', 'apps/desktop/tsconfig.json'], {cwd: root, stdio: 'inherit'});
if (result.status !== 0) process.exit(result.status ?? 1);
const destination = join(root, 'apps/desktop/.build/renderer');
mkdirSync(destination, {recursive: true});
cpSync(join(root, 'packages/designer/dist/assets'), destination, {recursive: true});
cpSync(join(root, 'apps/desktop/renderer'), destination, {recursive: true});
const index = readFileSync(join(destination, 'index.html'), 'utf8').replace('src="designer.js"', 'src="desktop.js"').replace('</head>', '    <link rel="stylesheet" href="desktop.css">\n</head>');
writeFileSync(join(destination, 'index.html'), index);
copyFileSync(join(root, 'packages/designer/dist/manifest.json'), join(root, 'apps/desktop/.build/designer-package.json'));
copyFileSync(join(root, 'version.json'), join(root, 'apps/desktop/.build/version.json'));
copyFileSync(join(root, 'LICENSE'), join(root, 'apps/desktop/.build/LICENSE'));
console.log('Desktop compiled and local assets staged.');
