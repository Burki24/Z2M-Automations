import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join, sep} from 'node:path';
import {existsSync} from 'node:fs';
import {listPackage, extractFile} from '@electron/asar';
import {posix} from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const binary = join(root, 'apps/desktop/out', 'Z2M-Automations-' + process.platform + '-' + process.arch, 'Z2M-Automations' + (process.platform === 'win32' ? '.exe' : ''));
if (!existsSync(binary)) throw new Error('Package the native application before running packaged smoke.');
// A package inside the checkout must not accidentally resolve missing modules from its parent node_modules.
const archive = join(binary, '..', 'resources/app.asar');
const files = new Set(listPackage(archive).map(file => file.replaceAll('\\', '/').replace(/^\/+/, '')));
const checked = new Set();
function verifyDependencies(manifestPath) {
  if (checked.has(manifestPath)) return;
  checked.add(manifestPath);
  const manifest = JSON.parse(extractFile(archive, manifestPath.split('/').join(sep)).toString('utf8'));
  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    let directory = posix.dirname(manifestPath); let found = null;
    while (true) {
      const candidate = posix.join(directory, 'node_modules', dependency, 'package.json');
      if (files.has(candidate)) { found = candidate; break; }
      if (directory === '.') break;
      directory = posix.dirname(directory);
    }
    if (!found) throw new Error('Missing packaged runtime dependency: ' + dependency);
    verifyDependencies(found);
  }
}
verifyDependencies('package.json');
console.log('PACKAGED_DEPENDENCIES_OK ' + checked.size);
const child = spawn(process.execPath, [join(root, 'scripts/smoke.mjs'), ...process.argv.slice(2)], {windowsHide: true, env: {...process.env, Z2MA_SMOKE_BINARY: binary}, stdio: 'inherit'});
child.on('error', () => { process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
