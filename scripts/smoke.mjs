import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve, sep} from 'node:path';
import {startPeer} from '../tests/support/mqtt-peer.mjs';
const require = createRequire(import.meta.url);
const binary = process.env.Z2MA_SMOKE_BINARY || require('electron');
const args = process.env.Z2MA_SMOKE_BINARY ? ['--smoke-test'] : [fileURLToPath(new URL('../apps/desktop', import.meta.url)), '--smoke-test'];
const environment = {...process.env}; delete environment.ELECTRON_RUN_AS_NODE;
const profile = mkdtempSync(join(tmpdir(), 'z2ma-smoke-'));
const peer = await startPeer();
environment.Z2MA_SMOKE_MQTT_PORT = String(peer.port);
environment.Z2MA_SMOKE_PROFILE = profile;
const child = spawn(binary, args, {windowsHide: true, env: environment, stdio: ['ignore', 'pipe', 'pipe']});
let output = ''; let timedOut = false;
child.stdout.on('data', data => { process.stdout.write(data); output = (output + data).slice(-32768); });
child.stderr.on('data', data => process.stderr.write(data));
const timeout = setTimeout(() => { timedOut = true; child.kill(); process.exitCode = 1; }, 30000);
function cleanup() {
  // Only remove the exact temporary profile created by this process.
  if (!resolve(profile).startsWith(resolve(tmpdir()) + sep + 'z2ma-smoke-')) throw new Error('Unexpected smoke profile path.');
  try { rmSync(profile, {recursive: true, force: true, maxRetries: 10, retryDelay: 100}); }
  catch { console.error('Temporary smoke profile cleanup is pending OS lock release.'); }
}
child.on('error', async error => { clearTimeout(timeout); console.error(error.message); await peer.close(); cleanup(); process.exitCode = 1; });
child.on('exit', async code => {
  clearTimeout(timeout); cleanup();
  const readOnly = peer.publications.every(value => /\/symcon\/automations\/request\/(status|editor)$/.test(value.topic) && !value.retain && value.qos === 0);
  await peer.close();
  process.exitCode = !timedOut && readOnly && peer.publications.length >= 3 && code === 0 && output.includes('DESKTOP_SMOKE_OK') && output.includes('DESKTOP_PROJECTS_OK') && output.includes('DESKTOP_MQTT_OK') && output.includes('DESKTOP_LAYOUT_OK') ? 0 : 1;
});
