import {BrowserWindow} from 'electron';
import {rendererPreferences} from './security.js';

interface Confirmation {
  language: 'de' | 'en';
  question: string;
  detail?: string;
  cancel: string;
  accept?: string;
}

export async function showConfirmation(parent: BrowserWindow, options: Confirmation): Promise<boolean> {
  if (parent.isDestroyed()) return false;
  const dialog = new BrowserWindow({parent, modal: true, show: false, width: 540, height: options.detail ? 350 : 220,
    minWidth: 320, minHeight: 190, minimizable: false, maximizable: false, autoHideMenuBar: true,
    title: 'Z2M-Automations', webPreferences: rendererPreferences});
  const view = dialog.webContents;
  view.setWindowOpenHandler(() => ({action: 'deny'}));
  view.on('will-navigate', event => event.preventDefault());
  view.on('will-redirect', event => event.preventDefault());
  view.on('will-attach-webview', event => event.preventDefault());
  const closed = new Promise<false>(resolve => dialog.once('closed', () => resolve(false)));
  try {
    await dialog.loadURL('z2ma://app/confirmation.html');
    const response = view.executeJavaScript(`((options) => new Promise(resolve => {
      document.documentElement.lang = options.language;
      document.querySelector('#question').textContent = options.question;
      document.querySelector('#detail').textContent = options.detail ?? '';
      const cancel = document.querySelector('#cancel');
      const accept = document.querySelector('#accept');
      cancel.textContent = options.cancel;
      accept.textContent = options.accept ?? '';
      accept.hidden = !options.accept;
      cancel.onclick = () => resolve(false);
      accept.onclick = () => resolve(Boolean(options.accept));
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); resolve(false); }
      });
      cancel.focus();
    }))(${JSON.stringify(options)})`);
    dialog.show();
    return await Promise.race([response, closed]) === true;
  } catch {
    return false;
  } finally {
    if (!dialog.isDestroyed()) dialog.destroy();
  }
}
