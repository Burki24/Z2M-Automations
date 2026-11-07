import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

// Explicitly reviewed install steps only. npm ci itself always ignores lifecycles.
const root = fileURLToPath(new URL('../', import.meta.url));
for (const [directory, script] of [
  ['electron', 'install.js'],
  ...(process.platform === 'win32' ? [['electron-winstaller', 'script/select-7z-arch.js']] : [])
]) {
  const cwd = join(root, 'node_modules', directory);
  const result = spawnSync(process.execPath, [join(cwd, script)], {cwd, stdio: 'inherit'});
  if (result.status !== 0) process.exit(result.status ?? 1);
}
