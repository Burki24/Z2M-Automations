import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join, resolve} from 'node:path';
import {setTimeout as waitFor} from 'node:timers/promises';

// Explicitly reviewed install steps only. npm ci itself always ignores lifecycles.
const root = fileURLToPath(new URL('../', import.meta.url));
export async function prepareTools({platform = process.platform, run = spawnSync, wait = waitFor, report = console.log} = {}) {
  for (const [directory, script, label, attempts] of [
    ['electron', 'install.js', 'Electron', 3]
  ]) {
    const cwd = join(root, 'node_modules', directory);
    for (let attempt = 1; attempt <= attempts; attempt++) {
      report(`Preparing ${label} (attempt ${attempt}/${attempts}).`);
      const result = run(process.execPath, [join(cwd, script)], {cwd, encoding: 'utf8', timeout: 180000, windowsHide: true});
      if (result.stdout) report(result.stdout.trimEnd());
      if (result.stderr) report(result.stderr.trimEnd());
      if (result.error) throw new Error(`${label} setup failed: ${result.error.message}`, {cause: result.error});
      if (result.status === 0) break;
      const transient = /HTTPError: Response code (?:408|429|500|502|503|504)\b|\b(?:ECONNRESET|ETIMEDOUT|EAI_AGAIN|ECONNREFUSED)\b|TypeError: fetch failed/.test(result.stderr ?? '');
      if (!transient || attempt === attempts) throw new Error(`${label} setup failed (exit ${result.status ?? 'unknown'}).`);
      const delay = attempt === 1 ? 1000 : 3000;
      report(`Temporary Electron download failure; retrying in ${delay / 1000} seconds.`);
      await wait(delay);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareTools().catch(error => { console.error(error.message); process.exitCode = 1; });
}
