import {installTransport} from './transport.js';
import {t, bindText, onLanguageChange, formatDate} from './localization.js';
import {installProjects} from './projects.js';

const bridge = window.z2maDesktop;
installTransport({kind: 'desktop', request: async (input, init = {}) => {
    const url = new URL(input, location.href);
    if (url.origin !== location.origin) throw new Error('Unsupported desktop request.');
    const route = url.pathname;
    const method = init.method ?? 'GET';
    let value;
    if (route === '/data' && method === 'GET') value = await bridge.snapshot();
    else if (route === '/select-system' && method === 'POST') value = await bridge.selectSystem(JSON.parse(init.body).systemId);
    else if (route === '/language' && method === 'POST') value = await bridge.language(JSON.parse(init.body));
    else throw new Error('Unsupported desktop operation.');
    return new Response(JSON.stringify(value), {status: 200, headers: {'Content-Type': 'application/json'}});
}});
document.body.classList.add('desktop-foundation');
const panel = document.createElement('details'); panel.className = 'desktop-debug';
const summary = document.createElement('summary'); bindText(summary, () => t('desktop.diagnostics'));
const controls = document.createElement('div'); controls.className = 'desktop-debug-controls';
const start = document.createElement('button'); start.type = 'button'; bindText(start, () => t('desktop.record'));
const stop = document.createElement('button'); stop.type = 'button'; bindText(stop, () => t('desktop.stop'));
const status = document.createElement('span'); status.setAttribute('role', 'status');
const events = document.createElement('ol');
controls.append(start, stop, status); panel.append(summary, controls, events); document.body.append(panel);
let recording = {active: false, end: 0, expired: false, events: []};
function paint() {
    bindText(status, () => recording.active ? t('desktop.recording', {time: formatDate(recording.end)}) : t(recording.expired ? 'desktop.expired' : 'desktop.idle'));
    start.disabled = recording.active; stop.disabled = !recording.active;
    events.replaceChildren(...recording.events.map(event => {
        const row = document.createElement('li');
        bindText(row, () => formatDate(event.time) + ' · ' + t('desktop.' + event.code) + ' · #' + event.request + (event.operation ? ' · ' + t('project.' + event.operation) : '') + (event.system ? ' · ' + event.system : '') + (event.language ? ' · ' + event.language : ''));
        return row;
    }));
}
start.addEventListener('click', async () => { recording = await bridge.recording('start'); paint(); });
stop.addEventListener('click', async () => { recording = await bridge.recording('stop'); paint(); });
setInterval(async () => { if (panel.open || recording.active) { recording = await bridge.diagnostics(); paint(); } }, 1000);
onLanguageChange(paint); paint();
try {
    await installProjects(bridge);
    await import('./reader.js');
    const view = await bridge.snapshot();
    const caption = document.querySelector('.brand-copy strong') ?? document.querySelector('.brand strong');
    if (caption) bindText(caption, () => 'Z2M-Automations ' + t(view.desktop.platform === 'win32' ? 'desktop.windows' : 'desktop.linux') + ' · ' + view.desktop.version);
} catch {
    document.body.replaceChildren();
    const error = document.createElement('p'); bindText(error, () => t('desktop.failed')); document.body.append(error);
}
