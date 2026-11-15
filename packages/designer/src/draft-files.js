import {createDraftFile, fileDrafts} from './draft-merge.js';
import {designerRequest} from './transport.js';
import {systemHeaders, selectedSystemName} from './workspace.js';
import {bindText, t} from './localization.js';
import {createUUID} from './identity.js';
import {confirmAction} from './confirmation.js';

export function appendDraftVersion(parent, value, side, data) {
    const section = document.createElement('section'); section.className = 'draft-version';
    const heading = document.createElement('h3'); bindText(heading, () => t(side === 'local' ? 'draft.sync.local' : 'draft.sync.remote')); section.append(heading);
    const name = document.createElement('p'); name.textContent = value?.name ?? ''; section.append(name);
    const summary = document.createElement('p');
    bindText(summary, () => value === null ? t('draft.sync.deleted') : Array.isArray(value) ? value.join(', ') : t('draft.preview.counts', {
        triggers: value.triggers?.length ?? 0, conditions: value.conditions?.length ?? 0, actions: value.actions?.length ?? 0}));
    section.append(summary);
    if (value && !Array.isArray(value)) {
        const list = document.createElement('ul');
        const deviceName = id => data?.devices?.find(device => device.key === id)?.name ?? id ?? '';
        for (const trigger of value.triggers ?? []) {
            const row = document.createElement('li');
            row.textContent = trigger.type === 'device' ? [deviceName(trigger.device), trigger.property, trigger.operator, String(trigger.value)].join(' · ')
                : [trigger.at ?? trigger.event ?? trigger.type, trigger.timezone ?? ''].filter(Boolean).join(' · '); list.append(row);
        }
        for (const action of value.actions ?? []) {
            const row = document.createElement('li');
            row.textContent = [action.target?.system, deviceName(action.target?.id), action.sequence_id,
                action.values ? Object.entries(action.values).map(([key, item]) => key + ': ' + String(item)).join(', ') : action.property ?? action.type].filter(Boolean).join(' · '); list.append(row);
        }
        section.append(list);
    }
    const details = document.createElement('details'); const technical = document.createElement('summary'); bindText(technical, () => t('draft.preview.technical'));
    const text = document.createElement('pre'); text.textContent = JSON.stringify(value, null, 2); details.append(technical, text); section.append(details); parent.append(section);
}

export function installDraftFiles({getData, reload, parent}) {
    const actions = document.createElement('div'); actions.className = 'project-actions'; parent.append(actions);
    const feedback = document.createElement('p'); feedback.setAttribute('role', 'status'); parent.append(feedback);
    let busy = false;
    async function request(action, fields = {}, data = getData()) {
        const endpoint = new URL('draft-files', location.href); endpoint.hash = '';
        const response = await designerRequest(endpoint, {method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
            headers: {'Content-Type': 'application/json', 'X-Z2MA-Read-Token': location.hash.slice(1), ...systemHeaders(data)},
            body: JSON.stringify({requestId: createUUID(), action, ...fields}), signal: AbortSignal.timeout(10000)});
        const text = await response.text(); if (text.length > 8388608) throw new Error('response_limit');
        const result = JSON.parse(text); if (!response.ok || !result.ok) throw new Error('draft_file');
        return result;
    }
    function download(value, name) {
        const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], {type: 'application/json'}));
        const link = document.createElement('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    async function select(source, {saving = false} = {}) {
        if (!source.length) throw new Error('no_drafts');
        return new Promise(resolve => {
            const dialog = document.createElement('dialog'); dialog.id = 'draft-file-dialog'; dialog.className = 'draft-file-dialog';
            const form = document.createElement('form'); form.method = 'dialog';
            const title = document.createElement('h2'); bindText(title, () => t('draft.file.select')); form.append(title);
            const sourceLabel = document.createElement('label'); const sourceCaption = document.createElement('span');
            bindText(sourceCaption, () => t('draft.file.sourceChoice')); sourceLabel.append(sourceCaption);
            const sourceSelect = document.createElement('select'); sourceSelect.id = 'draft-file-source';
            source.forEach((file, index) => sourceSelect.append(new Option(file.system.name + ' · ' + file.system.baseTopic, String(index))));
            sourceLabel.append(sourceSelect); form.append(sourceLabel);
            const targetLabel = document.createElement('label'); const targetCaption = document.createElement('span');
            bindText(targetCaption, () => t('draft.file.mapping')); targetLabel.append(targetCaption);
            const targetSelect = document.createElement('select'); targetSelect.id = 'draft-file-target';
            for (const system of getData()?.workspace?.systems ?? []) targetSelect.append(new Option(system.name + ' · ' + system.binding.baseTopic, system.binding.systemId));
            targetSelect.value = getData()?.workspaceContext?.systemId ?? ''; targetLabel.append(targetSelect); targetLabel.hidden = saving; form.append(targetLabel);
            const description = document.createElement('p'); form.append(description);
            const allLabel = document.createElement('label'); const all = document.createElement('input'); all.type = 'checkbox'; all.checked = true;
            const allText = document.createElement('span'); bindText(allText, () => t('draft.file.all')); allLabel.append(all, allText); form.append(allLabel);
            const list = document.createElement('div'); list.className = 'guided-inventory'; form.append(list);
            const conflictList = document.createElement('div'); form.append(conflictList);
            function paintDescription() {
                const file = source[Number(sourceSelect.value)];
                bindText(description, () => t('draft.file.source', {name: file.system.name, topic: file.system.baseTopic})
                    + (saving ? '' : ' · ' + t('draft.file.target', {name: targetSelect.selectedOptions[0]?.textContent ?? selectedSystemName(getData())})));
            }
            function paint() {
                const file = source[Number(sourceSelect.value)]; paintDescription();
                list.replaceChildren(...file.configuration.automations.map(rule => {
                    const label = document.createElement('label'); label.className = 'guided-choice';
                    const input = document.createElement('input'); input.type = 'checkbox'; input.value = rule.id; input.checked = true;
                    const text = document.createElement('span'); text.textContent = rule.name; label.append(input, text); return label;
                }));
                all.checked = true;
            }
            sourceSelect.addEventListener('change', paint);
            targetSelect.addEventListener('change', paintDescription);
            all.addEventListener('change', () => { for (const input of list.querySelectorAll('input')) input.checked = all.checked; });
            list.addEventListener('change', () => { const checked = [...list.querySelectorAll('input')]; all.checked = checked.every(input => input.checked); all.indeterminate = checked.some(input => input.checked) && !all.checked; });
            const cancel = document.createElement('button'); cancel.type = 'button'; bindText(cancel, () => t('draft.file.cancel'));
            const accept = document.createElement('button'); accept.type = 'submit'; accept.className = 'primary'; bindText(accept, () => t(saving ? 'draft.file.save' : 'draft.file.open'));
            form.append(cancel, accept); dialog.append(form); document.body.append(dialog); paint();
            let result = null;
            cancel.addEventListener('click', () => dialog.close());
            form.addEventListener('submit', event => {
                event.preventDefault();
                const ids = [...list.querySelectorAll('input:checked')].map(input => input.value);
                if (!ids.length && source[Number(sourceSelect.value)].configuration.automations.length) return;
                result = {file: source[Number(sourceSelect.value)], ids, target: targetSelect.value}; dialog.close();
            });
            dialog.addEventListener('close', () => { dialog.remove(); resolve(result); }, {once: true}); dialog.showModal(); cancel.focus();
        });
    }
    async function chooseFile() {
        if (getData()?.desktop?.project) {
            const result = await request('open'); return result.canceled ? null : result.file;
        }
        return new Promise((resolve, reject) => {
            const input = document.createElement('input'); input.type = 'file'; input.accept = '.z2mad,.z2map,.z2ma,application/json';
            input.addEventListener('cancel', () => resolve(null), {once: true});
            input.addEventListener('change', async () => {
                try { const file = input.files?.[0]; if (!file) return resolve(null); if (file.size > 8388608) throw new Error('limit'); resolve(JSON.parse(await file.text())); }
                catch (error) { reject(error); }
            }, {once: true}); input.click();
        });
    }
    async function chooseTarget(id) {
        if (getData()?.workspaceContext?.systemId === id) return;
        const select = document.querySelector('.system-selector select');
        if (!select || ![...select.options].some(option => option.value === id)) throw new Error('target');
        select.value = id; select.dispatchEvent(new Event('change', {bubbles: true}));
        const deadline = Date.now() + 5000;
        const ready = () => getData()?.workspaceContext?.systemId === id && document.querySelector('#validate-button')?.disabled !== true
            && !getData()?.draftSync?.pending && document.querySelector('#symcon-draft-sync')?.getAttribute('aria-busy') !== 'true';
        while (!ready() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
        if (!ready()) throw new Error('target');
        // System selection normally opens the editor; keep the explicit file workflow visible.
        document.querySelector('#desktop-nav-draft')?.click();
    }
    async function resolveConflicts(conflicts) {
        return new Promise(resolve => {
            const dialog = document.createElement('dialog'); dialog.className = 'draft-file-dialog'; dialog.id = 'draft-file-conflicts';
            const form = document.createElement('form'); form.method = 'dialog';
            const title = document.createElement('h2'); bindText(title, () => t('draft.file.conflict')); form.append(title);
            const choices = {};
            const accept = document.createElement('button'); accept.type = 'submit'; accept.className = 'primary'; bindText(accept, () => t('draft.sync.merge')); accept.disabled = true;
            for (const conflict of conflicts) {
                const field = document.createElement('fieldset'); const legend = document.createElement('legend'); legend.textContent = conflict.name;
                const select = document.createElement('select'); select.setAttribute('aria-label', conflict.name);
                for (const value of ['', 'local', 'remote']) { const option = new Option('', value); bindText(option, () => t(value ? 'draft.sync.' + value : 'draft.sync.choose')); select.append(option); }
                select.addEventListener('change', () => { choices[conflict.key] = select.value; accept.disabled = conflicts.some(item => !choices[item.key]); });
                field.append(legend, select);
                if (conflict.dependency) { const hint = document.createElement('p'); bindText(hint, () => t('draft.sync.dependency')); field.append(hint); }
                for (const side of ['local', 'remote']) appendDraftVersion(field, conflict[side], side, getData());
                form.append(field);
            }
            const cancel = document.createElement('button'); cancel.type = 'button'; bindText(cancel, () => t('draft.file.cancel')); cancel.addEventListener('click', () => dialog.close());
            let result = null;
            form.addEventListener('submit', event => { event.preventDefault(); if (accept.disabled) return; result = choices; dialog.close(); });
            form.append(cancel, accept); dialog.append(form); document.body.append(dialog);
            dialog.addEventListener('close', () => { dialog.remove(); resolve(result); }, {once: true}); dialog.showModal(); cancel.focus();
        });
    }
    for (const [id, key, action] of [['save', 'draft.file.save', 'draft'], ['open', 'draft.file.open', 'import'], ['project-save', 'draft.file.projectSave', 'project'], ['project-open', 'draft.file.projectOpen', 'import']]) {
        const button = document.createElement('button'); button.type = 'button'; button.id = 'draft-file-' + id; bindText(button, () => t(key)); actions.append(button);
        button.addEventListener('click', async () => {
            if (busy || document.querySelector('dialog[open]')) return;
            const data = getData(); const context = JSON.stringify(data?.workspaceContext);
            busy = true; for (const child of actions.children) child.disabled = true;
            try {
                if (action === 'project') {
                    const result = await request('project', {}, data);
                    if (result.file) download(result.file, 'project.z2map');
                } else if (action === 'draft') {
                    const selected = await select([createDraftFile({id: data.workspaceContext.systemId, name: selectedSystemName(data), baseTopic: data.module.baseTopic}, data.configuration, data.draftBase ?? null)], {saving: true});
                    if (!selected) return;
                    const file = createDraftFile(selected.file.system, data.configuration, data.draftBase ?? null, selected.ids.length === data.configuration.automations.length ? null : selected.ids);
                    if (data.desktop?.project) { const result = await request('save', {file}, data); if (result.canceled) return; }
                    else download(file, 'automations.z2mad');
                } else {
                    const value = await chooseFile(); if (!value) return;
                    const selected = await select(fileDrafts(value)); if (!selected) return;
                    const file = createDraftFile(selected.file.system, selected.file.configuration, selected.file.base,
                        selected.ids.length === selected.file.configuration.automations.length ? null : selected.ids);
                    if (context !== JSON.stringify(getData()?.workspaceContext)) throw new Error('changed');
                    await chooseTarget(selected.target);
                    const destination = getData();
                    if (!await confirmAction({title: () => t('draft.file.open'), detail: () => t('draft.file.confirm')})) return;
                    let result = await request('import', {file, choices: {}}, destination);
                    if (result.conflicts?.length) {
                        const choices = await resolveConflicts(result.conflicts); if (!choices) return;
                        result = await request('import', {file, choices}, destination);
                    }
                    if (!result.applied) throw new Error('conflict');
                    await reload();
                }
                bindText(feedback, () => t(action === 'import' ? 'draft.file.added' : 'draft.file.saved'));
            } catch { bindText(feedback, () => t('draft.file.failed')); }
            finally { busy = false; update(); }
        });
    }
    function update() { for (const button of actions.children) button.disabled = busy || !getData()?.workspaceContext?.systemId || !getData()?.configuration || getData()?.openFormEdits === true || getData()?.draftSync?.pending === true; }
    return update;
}
