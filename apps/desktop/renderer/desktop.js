import {installTransport} from './transport.js';
import {t, bindText, onLanguageChange, formatDate} from './localization.js';
import {installProjects} from './projects.js';
import {installNetwork} from './network.js';
import {validationSummary} from './draft-review.js';
import {installDraftExchange} from './drafts.js';
import {installDesktopWorkspace} from './desktop-workspace.js';

const bridge = window.z2maDesktop;
let editorState = Promise.resolve();
document.addEventListener('z2ma-editor-pending', event => {
    const pending = event.detail === true;
    editorState = editorState.then(async () => {
        const view = await bridge.snapshot(); const context = view.workspaceContext;
        if (!view.desktop.project || !context?.systemId) return;
        await bridge.designer({route: 'editor-state', systemId: context.systemId, generation: context.generation,
            fingerprint: context.fingerprint, payload: {pending}});
    }).catch(() => {});
});
installTransport({kind: 'desktop', request: async (input, init = {}) => {
    const url = new URL(input, location.href);
    if (url.origin !== location.origin) throw new Error('Unsupported desktop request.');
    const route = url.pathname;
    const method = init.method ?? 'GET';
    let value;
    if (route === '/data' && method === 'GET') value = await bridge.snapshot();
    else if (route === '/select-system' && method === 'POST') value = await bridge.selectSystem(JSON.parse(init.body).systemId);
    else if (route === '/draft-view' && method === 'POST') {
        const {systemId} = JSON.parse(init.body);
        const current = await bridge.snapshot();
        if (current.workspaceContext?.systemId !== systemId) return new Response(null, {status: 409});
        const result = await bridge.network({action: 'view', id: systemId, source: 'draft'});
        if (!result.ok) return new Response(null, {status: 409});
        value = {ok: true};
    }
    else if (route === '/language' && method === 'POST') value = await bridge.language(JSON.parse(init.body));
    else if (['/create', '/edit', '/create-yaml', '/edit-yaml', '/sequence', '/manage', '/permissions', '/permissions-status'].includes(route) && method === (route === '/permissions-status' ? 'GET' : 'POST')) {
        const headers = new Headers(init.headers);
        const result = await bridge.designer({route: route.slice(1), systemId: headers.get('X-Z2MA-System-ID'),
            generation: Number(headers.get('X-Z2MA-Generation')), fingerprint: headers.get('X-Z2MA-Fingerprint'), payload: method === 'POST' ? JSON.parse(init.body) : {}});
        if (!result.ok) {
            const message = [t('project.' + result.error), validationSummary(result.validation)].filter(Boolean).join('\n');
            return new Response(JSON.stringify({ok: false, error: result.error, message}), {status: 409});
        }
        value = result.state;
        if (route !== '/create-yaml' && route !== '/edit-yaml') document.dispatchEvent(new Event('z2ma-project-changed'));
    }
    else throw new Error('Unsupported desktop operation.');
    return new Response(JSON.stringify(value), {status: 200, headers: {'Content-Type': 'application/json'}});
}});
document.body.classList.add('desktop-foundation');
const panel = document.createElement('details'); panel.className = 'desktop-debug';
const summary = document.createElement('summary'); bindText(summary, () => t('desktop.diagnostics'));
const controls = document.createElement('div'); controls.className = 'desktop-debug-controls';
const start = document.createElement('button'); start.type = 'button'; bindText(start, () => t('desktop.record'));
const stop = document.createElement('button'); stop.type = 'button'; bindText(stop, () => t('desktop.stop'));
const open = document.createElement('button'); open.type = 'button'; open.id = 'desktop-open-recording';
open.setAttribute('aria-controls', 'desktop-recording-events');
const status = document.createElement('span'); status.setAttribute('role', 'status');
const events = document.createElement('ol'); events.id = 'desktop-recording-events'; events.hidden = true;
function paintRecordingToggle() {
    open.setAttribute('aria-expanded', String(!events.hidden));
    bindText(open, () => t(events.hidden ? 'desktop.openRecording' : 'desktop.closeRecording'));
}
open.addEventListener('click', () => { events.hidden = !events.hidden; paintRecordingToggle(); });
paintRecordingToggle();
controls.append(start, stop, open, status); panel.append(summary, controls, events); document.body.append(panel);
let recording = {active: false, end: 0, expired: false, events: []};
function paint() {
    bindText(status, () => recording.active ? t('desktop.recording', {time: formatDate(recording.end)}) : t(recording.expired ? 'desktop.expired' : 'desktop.idle'));
    start.disabled = recording.active; stop.disabled = !recording.active;
    open.disabled = events.hidden && recording.events.length === 0;
    events.replaceChildren(...recording.events.map(event => {
        const row = document.createElement('li');
        bindText(row, () => formatDate(event.time) + ' · ' + t('desktop.' + event.code) + ' · #' + event.request + (event.operation ? ' · ' + t('project.' + event.operation) : '') + (event.reason ? ' · ' + t('mqtt.error.' + event.reason) : '') + (event.system ? ' · ' + event.system : '') + (event.broker ? ' · ' + event.broker : '') + (event.transaction ? ' · ' + event.transaction : '') + (event.language ? ' · ' + event.language : '') + (event.run ? ' · ' + event.rule + ' · ' + event.run + ' · ' + t('mqtt.runStep', {state: t('mqtt.run.' + event.state), step: event.step}) : ''));
        return row;
    }));
}
start.addEventListener('click', async () => { recording = await bridge.recording('start'); paint(); });
stop.addEventListener('click', async () => { recording = await bridge.recording('stop'); paint(); });
setInterval(async () => { if (panel.open || recording.active) { recording = await bridge.diagnostics(); paint(); } }, 1000);
onLanguageChange(paint); paint();
const themeOptions = ['system', 'light', 'dark'];
const themeKey = 'z2ma.desktop.theme';
async function installTheme() {
    let preference = 'system';
    try {
        const saved = localStorage.getItem(themeKey);
        if (themeOptions.includes(saved)) preference = saved;
    } catch { /* The session still supports changing the theme. */ }
    await bridge.theme(preference);
    const label = document.createElement('label'); label.className = 'designer-language';
    const mark = document.querySelector('.app-header .brand-mark');
    const icon = document.createElement('img'); icon.src = 'app-mark.svg'; icon.alt = '';
    mark.replaceChildren(icon);
    const caption = document.createElement('span'); bindText(caption, () => t('desktop.theme'));
    const select = document.createElement('select'); select.id = 'desktop-theme';
    for (const value of themeOptions) {
        const option = document.createElement('option'); option.value = value;
        bindText(option, () => t('desktop.theme.' + value)); select.append(option);
    }
    select.value = preference;
    select.addEventListener('change', async () => {
        const value = select.value;
        await bridge.theme(value);
        try { localStorage.setItem(themeKey, value); } catch { /* The current session already uses the theme. */ }
    });
    label.append(caption, select);
    const language = document.querySelector('#designer-language')?.closest('label');
    if (language) language.after(label);
    else document.querySelector('.app-header .toolbar').append(label);
}
try {
    const workspace = installDesktopWorkspace();
    await installProjects(bridge, workspace);
    installDraftExchange(bridge, workspace);
    const updateNetwork = installNetwork(bridge, workspace, () => editorState);
    panel.name = 'desktop-setup';
    workspace.setup.append(panel);
    document.addEventListener('z2ma-designer-view', event => {
        workspace.update(event.detail);
        updateNetwork(event.detail);
    });
    await import('./reader.js');
    workspace.mountDesigner();
    await installTheme();
    const view = await bridge.snapshot();
    const caption = document.querySelector('.brand-copy strong') ?? document.querySelector('.brand strong');
    if (caption) bindText(caption, () => 'Z2M-Automations ' + t(view.desktop.platform === 'win32' ? 'desktop.windows' : 'desktop.linux') + ' · ' + view.desktop.version);
} catch {
    document.body.replaceChildren();
    const error = document.createElement('p'); bindText(error, () => t('desktop.failed')); document.body.append(error);
}
