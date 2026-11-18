import {BrowserWindow} from 'electron';
import {rendererPreferences} from './security.js';

interface Confirmation {
  language: 'de' | 'en';
  question: string;
  detail?: string;
  cancel: string;
  accept?: string;
  save?: string;
  saveDisabled?: boolean;
  resume?: {label: string; help: string; detail: string; enabled: boolean};
}

type TransferChoice = {accepted: boolean; resume: boolean};

export async function showTransferConfirmation(parent: BrowserWindow, options: Confirmation): Promise<TransferChoice> {
  const result = await confirmationResult(parent, options);
  return typeof result === 'object' ? result : {accepted: false, resume: false};
}

export async function showConfirmation(parent: BrowserWindow, options: Confirmation): Promise<boolean> {
  return await showConfirmationChoice(parent, options) === true;
}

export async function showConfirmationChoice(parent: BrowserWindow, options: Confirmation): Promise<boolean | 'save'> {
  const result = await confirmationResult(parent, options);
  return typeof result === 'object' ? false : result;
}

async function confirmationResult(parent: BrowserWindow, options: Confirmation): Promise<boolean | 'save' | TransferChoice> {
  if (parent.isDestroyed()) return false;
  const dialog = new BrowserWindow({parent, modal: true, show: false, width: 540, height: options.resume ? 430 : options.detail ? 350 : 220,
    minWidth: 320, minHeight: options.resume ? 300 : 190, minimizable: false, maximizable: false, autoHideMenuBar: true,
    title: 'Z2M-Automations', webPreferences: rendererPreferences});
  const view = dialog.webContents;
  view.setWindowOpenHandler(() => ({action: 'deny'}));
  view.on('will-navigate', event => event.preventDefault());
  view.on('will-redirect', event => event.preventDefault());
  view.on('will-attach-webview', event => event.preventDefault());
  const closed = new Promise<false>(resolve => dialog.once('closed', () => resolve(false)));
  try {
    await dialog.loadURL('z2ma://app/confirmation.html');
    const response = view.executeJavaScript(confirmationScript(options));
    dialog.show();
    const result = await Promise.race([response, closed]);
    if (options.resume) return {accepted: result?.accepted === true, resume: result?.accepted === true && options.resume.enabled && result.resume === true};
    return result === 'save' && options.save && !options.saveDisabled ? 'save' : result === true;
  } catch {
    return false;
  } finally {
    if (!dialog.isDestroyed()) dialog.destroy();
  }
}

export function confirmationScript(options: Confirmation): string {
  return `((options) => new Promise(resolve => {
      document.documentElement.lang = options.language;
      document.querySelector('#question').textContent = options.question;
      document.querySelector('#detail').textContent = options.detail ?? '';
      const cancel = document.querySelector('#cancel');
      const accept = document.querySelector('#accept');
      const save = document.querySelector('#save');
      const group = document.querySelector('#resume-choice');
      const resume = document.querySelector('#resume-previous-operation');
      group.hidden = !options.resume;
      resume.checked = false;
      resume.disabled = options.resume?.enabled !== true;
      document.querySelector('#resume-label').textContent = options.resume?.label ?? '';
      document.querySelector('#resume-help').textContent = options.resume?.help ?? '';
      resume.onchange = () => { document.querySelector('#detail').textContent = resume.checked && options.resume ? options.resume.detail : options.detail ?? ''; };
      save.textContent = options.save ?? '';
      save.hidden = !options.save;
      save.disabled = options.saveDisabled === true;
      save.onclick = () => resolve('save');
      cancel.textContent = options.cancel;
      accept.textContent = options.accept ?? '';
      accept.hidden = !options.accept;
      cancel.onclick = () => resolve(false);
      accept.onclick = () => resolve(options.resume ? {accepted: Boolean(options.accept), resume: resume.checked && !resume.disabled} : Boolean(options.accept));
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); resolve(false); }
      });
      cancel.focus();
    }))(${JSON.stringify(options)})`;
}
