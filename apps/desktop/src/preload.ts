import type {DesktopBridge} from './contracts.js';
import {contextBridge, ipcRenderer} from 'electron';

const bridge: DesktopBridge = Object.freeze({
  snapshot: () => ipcRenderer.invoke('z2ma:snapshot'),
  selectSystem: (systemId: string) => ipcRenderer.invoke('z2ma:select-system', systemId),
  language: (change: Parameters<DesktopBridge['language']>[0]) => ipcRenderer.invoke('z2ma:language', change),
  diagnostics: () => ipcRenderer.invoke('z2ma:diagnostics'),
  recording: (action: 'start' | 'stop') => ipcRenderer.invoke('z2ma:recording', action)
});
contextBridge.exposeInMainWorld('z2maDesktop', bridge);
