/* Only our direct, same-origin HTML-SDK loader may control the embedded view. */
export function installNativeEmbedding({renew, environment = window}) {
    const channel = 'z2ma.designer.embed.v1';
    if (environment.parent === environment || environment.name !== 'burki24.wheel.v1') return {ready: Promise.resolve(), update() {}};
    const origin = environment.location.origin;
    if (!/^https?:\/\//.test(origin)) return {ready: Promise.resolve(), update() {}};
    const send = value => environment.parent.postMessage({channel, ...value}, origin);
    let lastSystem = '';
    environment.addEventListener('message', async event => {
        const value = event.data;
        if (event.source !== environment.parent || event.origin !== origin || value?.channel !== channel) return;
        if (value.type === 'maximize') { send({type: environment.document.querySelector?.('dialog[open]') ? 'maximize-blocked' : 'maximize-ready'}); return; }
        if (value.type === 'renew') { send({type: 'renewed', ok: (await renew()) === true}); return; }
        if (value.type !== 'theme') return;
        const root = environment.document.documentElement;
        if (![value.text, value.card, value.accent].every(color => typeof color === 'string' && /^#[a-f0-9]{6}$/i.test(color))) return;
        const rgb = [1, 3, 5].map(index => parseInt(value.card.slice(index, index + 2), 16));
        const scheme = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 < 128 ? 'dark' : 'light';
        root.dataset.nativeEmbed = scheme;
        root.style.colorScheme = scheme;
        root.style.setProperty('--native-text', value.text);
        root.style.setProperty('--native-card', value.card);
        root.style.setProperty('--native-accent', value.accent);
        if (Number.isFinite(value.fontSize) && value.fontSize >= 10 && value.fontSize <= 40) root.style.setProperty('--native-font-size', value.fontSize + 'px');
    });
    // This is the unchanged central wheel router, served through a fixed own asset path.
    const ready = import('./interaction.js').then(() => send({type: 'ready'})).catch(() => send({type: 'interaction-error'}));
    return {ready, update(data) {
        const systemId = data?.workspaceContext?.systemId ?? '';
        if (systemId && lastSystem !== systemId) { lastSystem = systemId; send({type: 'system', systemId}); }
    }};
}
