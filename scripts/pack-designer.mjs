import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const destination = fileURLToPath(new URL('../artifacts', import.meta.url));
mkdirSync(destination, {recursive: true});
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run pack:designer.');
const result = spawnSync(process.execPath, [npm, 'pack', '--ignore-scripts', '--pack-destination', destination], {cwd: fileURLToPath(new URL('../packages/designer/dist', import.meta.url)), stdio: 'inherit'});
process.exitCode = result.status ?? 1;
