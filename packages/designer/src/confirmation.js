import {t, bindText} from './localization.js';

/* Cancellation is the default for Escape, window close and explicit dismissal. */
export function confirmAction({title, detail}) {
    if (document.querySelector('dialog[open]')) return Promise.resolve(false);
    const dialog = document.createElement('dialog'); dialog.className = 'management-dialog guided-confirmation';
    const heading = document.createElement('h2'); heading.id = 'guided-confirmation-title';
    bindText(heading, title); dialog.setAttribute('aria-labelledby', heading.id);
    const description = document.createElement('p'); bindText(description, detail);
    const actions = document.createElement('div'); actions.className = 'dialog-actions';
    const cancel = document.createElement('button'); cancel.type = 'button'; bindText(cancel, () => t('ui.cancel.f7ff1178'));
    const accept = document.createElement('button'); accept.type = 'button'; accept.className = 'primary'; bindText(accept, () => t('ui.confirm.15b63b4d'));
    actions.append(cancel, accept); dialog.append(heading, description, actions); document.body.append(dialog);
    return new Promise(resolve => {
        let accepted = false;
        cancel.addEventListener('click', () => dialog.close());
        accept.addEventListener('click', () => { accepted = true; dialog.close(); });
        dialog.addEventListener('cancel', () => { accepted = false; });
        dialog.addEventListener('close', () => { dialog.remove(); resolve(accepted); }, {once: true});
        dialog.showModal(); cancel.focus();
    });
}
