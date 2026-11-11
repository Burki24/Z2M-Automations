import {spawn} from 'node:child_process';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, dirname, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

// This test inspects DOM/layout only. It never captures a desktop, window or image.
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const profile = await mkdtemp(join(tmpdir(), 'z2ma-link-ui-'));
try {
  const preload = join(profile, 'preload.cjs');
  await writeFile(preload, `const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('linkTest', {
  network: input => ipcRenderer.invoke('link:network', input),
  selectSystem: id => ipcRenderer.invoke('link:select', id),
  view: () => ipcRenderer.invoke('link:view'),
  scenario: name => ipcRenderer.invoke('link:scenario', name)
});\n`);
  const environment = {...process.env, Z2MA_LINK_TEST_ROOT: root, Z2MA_LINK_TEST_PROFILE: profile, Z2MA_LINK_TEST_PRELOAD: preload};
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), [join(root, 'tests/support/system-link-ui.cjs')],
    {cwd: root, env: environment, windowsHide: true, stdio: 'inherit'});
  let expired = false;
  const timer = setTimeout(() => { expired = true; child.kill(); }, 60000);
  try {
    const result = await new Promise((done, reject) => { child.once('error', reject); child.once('close', done); });
    if (expired || result !== 0) throw new Error('System-link DOM test failed' + (expired ? ': timeout' : ': exit ' + result));
  } finally { clearTimeout(timer); }
} finally {
  const target = resolve(profile);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('z2ma-link-ui-')) throw new Error('Unexpected test profile path');
  await rm(target, {recursive: true, force: true});
}
