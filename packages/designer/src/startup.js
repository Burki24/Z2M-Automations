/* Report loading failures without exposing browser errors, private URLs or tokens. */
(() => {
    const button = document.querySelector('#validate-button');
    const status = document.querySelector('#draft-status');
    const feedback = document.querySelector('#feedback');
    for (const selector of ['#save-button', '#activate-button', '#stop-button']) document.querySelector(selector).disabled = true;
    button.disabled = true;
    // This minimal English fallback also works when the language assets themselves are missing.
    button.textContent = status.textContent = 'Loading designer …';
    let localization = null;
    import('./localization.js').then(api => {
        localization = api;
        api.bindText(button, () => api.t('startup.loading'));
        api.bindText(status, () => api.t('startup.loading'));
        return import('./reader.js');
    }).catch(() => {
        if (localization) {
            localization.bindText(status, () => localization.t('startup.failed'));
            localization.bindText(feedback, () => localization.t('startup.recovery'));
            localization.bindText(button, () => localization.t('startup.reload'));
        } else {
            status.textContent = 'Designer could not start';
            feedback.textContent = 'The designer files could not be loaded. Reload the designer or check module debug. Drafts and Z2M remain unchanged.';
            button.textContent = 'Reload designer';
        }
        feedback.dataset.tone = 'error';
        button.disabled = false;
        button.addEventListener('click', () => location.reload());
    });
})();
