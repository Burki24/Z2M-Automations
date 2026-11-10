import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve, sep} from 'node:path';
import {createHash} from 'node:crypto';
import {parse} from 'yaml';
import {startPeer, remoteFixture} from '../tests/support/mqtt-peer.mjs';
const require = createRequire(import.meta.url);
const binary = process.env.Z2MA_SMOKE_BINARY || require('electron');
const args = process.env.Z2MA_SMOKE_BINARY ? ['--smoke-test'] : [fileURLToPath(new URL('../apps/desktop', import.meta.url)), '--smoke-test'];
const environment = {...process.env}; delete environment.ELECTRON_RUN_AS_NODE;
const profile = mkdtempSync(join(tmpdir(), 'z2ma-smoke-'));
function stoppedFixture(name) {
  const fixture = remoteFixture(name);
  const {session, stored_revision: revision, checksum} = fixture.status;
  Object.assign(fixture.status, {executing: false, extension_build: 'a'.repeat(64), execution_version: 1,
    execution: {protocol_version: 1, execution_version: 1, session, revision, checksum, sequence: 0, runs: []}});
  Object.assign(fixture.editor, fixture.status);
  return fixture;
}
const first = stoppedFixture('Synthetic remote rule');
for (let number = 16; number >= 1; number--) {
  first.editor.devices.push({id: '0x' + (number + 2).toString(16).padStart(16, '0'), name: 'Device ' + number, properties: []});
  first.editor.groups.push({id: number + 1, name: 'Group ' + number});
}
const second = stoppedFixture('Other stored rule');
second.editor.devices[0].name = 'Other sensor';
second.editor.groups = [];
const peer = await startPeer({
  systems: new Map([['synthetic', first], ['synthetic-other', second]]),
  reply({operation, request, response, publish}) {
    if (operation === 'validate') {
      const draft = parse(request.yaml);
      const checksum = createHash('sha256').update(request.yaml).digest('hex');
      response.data = {valid: draft.automations.every(rule => rule.enabled === false), revision: draft.revision, checksum,
        automation_count: draft.automations.length, executing: false};
    }
    publish();
  }
});
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
  clearTimeout(timeout);
  let saved = false;
  if (code === 0 && !timedOut) {
    try {
      const project = JSON.parse(readFileSync(join(profile, 'synthetic.z2ma'), 'utf8'));
      saved = project.format === 'z2m-automations-project' && project.name === 'Saved from the close dialog'
        && project.systems.some(system => system.configuration.automations.some(rule => rule.name === 'D4 preserved input' && rule.enabled === false));
    } catch { /* The missing or invalid file fails the smoke test. */ }
    if (saved) console.log('DESKTOP_CLOSE_SAVE_OK project persisted and application exited');
    else console.error('The application exited without saving the expected project changes.');
  }
  cleanup();
  const readOnly = peer.publications.every(value => /\/symcon\/automations\/request\/(status|editor|validate)$/.test(value.topic) && !value.retain && value.qos === 0);
  const validations = peer.publications.filter(value => value.topic.endsWith('/request/validate'));
  await peer.close();
  process.exitCode = !timedOut && saved && readOnly && validations.length === 1
    && validations[0].topic === 'synthetic/symcon/automations/request/validate'
    && code === 0 && output.includes('DESKTOP_SMOKE_OK') && output.includes('DESKTOP_PROJECTS_OK') && output.includes('DESKTOP_MQTT_OK') && output.includes('DESKTOP_DRAFTS_OK') && output.includes('DESKTOP_LAYOUT_OK') ? 0 : 1;
});
