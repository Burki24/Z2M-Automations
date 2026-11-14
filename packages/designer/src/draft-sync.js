import {designerRequest} from './transport.js';
import {t, bindText, MessageError, ResponseError, localizeResponse} from './localization.js';
import {createUUID} from './identity.js';
import {systemHeaders, selectedSystemName} from './workspace.js';
import {confirmAction} from './confirmation.js';

const phaseKeys = {idle: 'symcon.draftSync.idle', reading: 'symcon.draftSync.reading', verifying: 'symcon.draftSync.verifying',
    updated: 'symcon.draftSync.updated', current: 'symcon.draftSync.current', conflict: 'symcon.draftSync.conflict',
    older: 'symcon.draftSync.older', restored: 'symcon.draftSync.restored'};

export async function draftSyncRequest(data, action, {token, request = designerRequest, base = location.href, requestId = createUUID()} = {}) {
    const context = data?.workspaceContext;
    if (!context || !['refresh', 'status', 'replace', 'restore'].includes(action)) throw new MessageError('symcon.draftSync.failed');
    const endpoint = new URL(action === 'status' ? 'draft-sync-status' : 'draft-sync', base); endpoint.hash = '';
    let response; let result;
    try {
        response = await request(endpoint, {method: action === 'status' ? 'GET' : 'POST',
            headers: {'X-Z2MA-Read-Token': token, ...systemHeaders(data), ...(action === 'status' ? {} : {'Content-Type': 'application/json'})},
            ...(action === 'status' ? {} : {body: JSON.stringify({requestId, action, operation: action === 'refresh' ? '' : data.draftSync?.operation})}),
            credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000)});
        const text = await response.text(); if (text.length > 16384) throw new Error('response_limit');
        result = localizeResponse(JSON.parse(text));
    } catch { throw new MessageError('symcon.draftSync.unconfirmed'); }
    if (!response.ok || !result.ok) throw new ResponseError(result, () => t('symcon.draftSync.failed'));
    const view = result.draftSync;
    if (view?.systemId !== context.systemId || view.generation !== context.generation || !/^[a-f0-9]{64}$/.test(view.fingerprint)
        || !['idle', 'reading', 'verifying', 'updated', 'current', 'conflict', 'older', 'restored', 'error'].includes(view.phase)
        || !['pending', 'canStart', 'canReplace', 'canRestore', 'permissionsChanged'].every(key => typeof view[key] === 'boolean')
        || !Number.isSafeInteger(view.baseRevision) || view.baseRevision < 0
        || !(view.remoteRevision === null || (Number.isSafeInteger(view.remoteRevision) && view.remoteRevision >= 0))
        || !view.counts || !['added', 'changed', 'removed'].every(key => Number.isSafeInteger(view.counts[key]) && view.counts[key] >= 0 && view.counts[key] <= 200)
        || typeof view.error !== 'string' || !(view.operation === '' || /^[a-f0-9]{32}$/.test(view.operation))) throw new MessageError('symcon.draftSync.unconfirmed');
    if (action !== 'refresh' && data.draftSync?.operation && view.operation !== data.draftSync.operation) throw new MessageError('symcon.draftSync.changed');
    if (action === 'refresh' && view.operation !== requestId.replaceAll('-', '')) throw new MessageError('symcon.draftSync.changed');
    return view;
}

/* The shared Symcon adapter installs this only in browser and tile workspaces. */
export function installDraftSync({getData, reload, actions}) {
    const refresh = document.createElement('button'); refresh.type = 'button'; refresh.id = 'symcon-refresh-draft';
    bindText(refresh, () => t('symcon.draftSync.refresh')); actions.append(refresh);
    const panel = document.createElement('div'); panel.id = 'symcon-draft-sync'; panel.className = 'field-help';
    const status = document.createElement('p'); status.id = 'symcon-draft-sync-status'; status.setAttribute('role', 'status');
    refresh.setAttribute('aria-describedby', status.id);
    const details = document.createElement('p');
    const choices = document.createElement('div'); choices.className = 'project-actions';
    const replace = document.createElement('button'); replace.type = 'button'; replace.id = 'symcon-replace-draft';
    bindText(replace, () => t('symcon.draftSync.replace'));
    const restore = document.createElement('button'); restore.type = 'button'; restore.id = 'symcon-restore-draft';
    bindText(restore, () => t('symcon.draftSync.restore'));
    choices.append(replace, restore); panel.append(status, details, choices); actions.after(panel);
    let busy = false; let command = ''; let error = ''; let timer; let observed = ''; let deadline = 0;
    const sameSystem = data => getData()?.workspaceContext?.systemId === data?.workspaceContext?.systemId
        && getData()?.workspaceContext?.generation === data?.workspaceContext?.generation;
    const blocked = code => t(code === 'open_input' ? 'symcon.draftSync.openInput' : code === 'busy' ? 'symcon.draftSync.busy'
        : code === 'not_connected' || code === 'ownership_required' ? 'symcon.draftSync.connection'
            : code === 'draft_sync_timeout' ? 'symcon.draftSync.timeout' : 'symcon.draftSync.failed');
    function paint() {
        const data = getData(); const view = data?.draftSync;
        panel.hidden = refresh.hidden = !data?.draftSyncAllowed || !view;
        if (panel.hidden) return;
        const key = `${view.systemId}:${view.generation}:${view.operation}`;
        if (observed !== key) {
            if (observed.split(':').slice(0, 2).join(':') !== key.split(':').slice(0, 2).join(':')) error = '';
            observed = key; deadline = Date.now() + 610000;
        }
        refresh.disabled = busy || view.pending || !view.canStart || data.openFormEdits;
        panel.setAttribute('aria-busy', String(busy || view.pending));
        status.dataset.tone = view.phase === 'error' || error ? 'error' : ['conflict', 'older'].includes(view.phase) ? 'warning' : ['updated', 'current', 'restored'].includes(view.phase) ? 'success' : '';
        bindText(status, () => error || (busy && command === 'refresh' ? t('symcon.draftSync.reading') : view.phase === 'error' ? blocked(view.error)
            : view.phase === 'idle' && view.error ? blocked(view.error) : t(phaseKeys[view.phase] ?? phaseKeys.idle, {name: selectedSystemName(data), revision: view.remoteRevision ?? ''})));
        details.hidden = !['updated', 'conflict'].includes(view.phase);
        bindText(details, () => t('symcon.draftSync.differences', {...view.counts, base: view.baseRevision, remote: view.remoteRevision})
            + (view.permissionsChanged ? ' ' + t('symcon.draftSync.permissions') : ''));
        replace.hidden = !view.canReplace; restore.hidden = !view.canRestore;
        choices.hidden = replace.hidden && restore.hidden;
        replace.disabled = restore.disabled = busy || data.openFormEdits;
    }
    function schedule() {
        clearTimeout(timer);
        if (getData()?.draftSync?.pending && Date.now() < deadline) timer = setTimeout(() => send('status'), 1200);
    }
    async function send(action) {
        if (busy) return;
        const data = getData(); const view = data?.draftSync;
        if (!data?.draftSyncAllowed || !view || !sameSystem(data)) return;
        if (document.querySelector('dialog[open]') || data.openFormEdits) { error = t('symcon.draftSync.openInput'); paint(); schedule(); return; }
        const captured = JSON.stringify([data.workspaceContext, view.operation]);
        if (action === 'replace' || action === 'restore') {
            if (!await confirmAction({title: () => t(action === 'replace' ? 'symcon.draftSync.replace' : 'symcon.draftSync.restore'),
                detail: () => t(action === 'replace' ? 'symcon.draftSync.replaceConfirm' : 'symcon.draftSync.restoreConfirm', {name: selectedSystemName(data)})})) return;
            if (captured !== JSON.stringify([getData()?.workspaceContext, getData()?.draftSync?.operation])) { error = t('symcon.draftSync.changed'); paint(); return; }
        }
        error = ''; busy = true; command = action; clearTimeout(timer); paint();
        try {
            const next = await draftSyncRequest(data, action, {token: location.hash.slice(1)});
            if (!sameSystem(data)) return;
            // An intervening view refresh or modal must not lose user input.
            if (getData() !== data || document.querySelector('dialog[open]')) { error = t('symcon.draftSync.reload'); return; }
            data.draftSync = next;
            if (!next.pending && await reload() === false) error = t('symcon.draftSync.reload');
        } catch (failure) { if (sameSystem(data)) error = failure.message; }
        finally { busy = false; paint(); schedule(); }
    }
    refresh.addEventListener('click', () => send('refresh'));
    replace.addEventListener('click', () => send('replace'));
    restore.addEventListener('click', () => send('restore'));
    return () => { paint(); schedule(); };
}
