import {installSymconWorkspace} from './symcon-workspace.js';
import {t, bindText, bindHTML, bindAttribute, localizedOption, localizeRecord, MessageError, ResponseError, locale, formatDate, formatNumber, onLanguageChange, installLanguagePicker, localizeResponse} from './localization.js';
import {isDesktop} from './transport.js';
import {selectedSystemName} from './workspace.js';

/* Presentation only: existing controls and their listeners are moved, never cloned. */
export function layoutStatus(data) {
    const transfer = data?.transfer;
    const runtime = data?.runtime;
    const catalog = data?.catalogRefresh;
    return {
        transfer: !transfer ? t("ui.unavailable.5db96a2a") : transfer.pending ? t("ui.request.in.progress.315d385a") : transfer.error || transfer.details ? t("ui.check.notice.3bc4e09a") : transfer.canStore ? t("ui.validated.db2c6cfa") : transfer.status === 'stored' ? t("ui.saved.5e2338e2") : t("ui.check.draft.d0fa1aa4"),
        runtime: !runtime?.confirmed ? t("ui.not.confirmed.d70bfbb5") : runtime.pending ? t("ui.request.in.progress.315d385a") : runtime.executing ? t("ui.automatic.operation.active.5be9b590") : t("ui.automatic.operation.stopped.46b63e37"),
        catalog: !catalog ? t("ui.unavailable.5db96a2a") : catalog.pending ? t("ui.loading.d0e1f091") : catalog.error ? t("ui.check.notice.3bc4e09a")
            : data.catalogAvailable === true && catalog.loadedAt ? t("ui.device.data.loaded.de8568c7") : catalog.loadedAt ? t("ui.refresh.view.6540358c") : catalog.storedAt ? t("ui.not.confirmed.d70bfbb5") : t("ui.not.loaded.yet.f12d0120")
    };
}

export function workflowStatus(data, desktop = isDesktop()) {
    if (!data?.module || (desktop && (!data.desktop?.project || !data.workspaceContext?.systemId))) return null;
    const status = data.status;
    const transfer = desktop ? null : data.transfer;
    const receiverConfirmed = status?.storedConfirmed ?? transfer?.receiverConfirmed ?? status?.confirmed;
    const revision = status?.storedConfirmed === undefined
        ? transfer?.storedRevision ?? status?.storedRevision : status.storedRevision;
    const stored = Number.isSafeInteger(revision) && revision > 0
        ? t(receiverConfirmed ? 'workflow.stored' : 'workflow.lastRead', {revision})
        : revision === 0 && receiverConfirmed ? t('workflow.empty') : t('workflow.unknown');
    const projectFile = desktop ? t(data.desktop.projectDirty ? 'workflow.projectUnsaved' : 'workflow.projectSaved') : '';
    let next = '';
    if (desktop && data.desktop.source !== 'stored') next = !status?.mqttConnected ? 'connect' : status.confirmed ? 'review' : 'read';
    if (transfer) next = transfer.canStore ? 'store' : 'review';
    return {system: selectedSystemName(data), stored, projectFile, next};
}

export function installLayout({getData, reload, onStepChange}) {
    const guided = isDesktop() ? () => {} : installSymconWorkspace({getData, reload, onStepChange});
    const node = (tag, className, text) => {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text) bindText(el, () => text);
        return el;
    };
    const icon = name => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#icon-' + name); svg.append(use); return svg;
    };
    const toolbar = document.querySelector('.toolbar');
    const menu = node('details', 'designer-menu');
    const summary = node('summary', '', () => (t("ui.management.2456bb8e"))); summary.prepend(icon('settings'));
    const menuBody = node('div', 'designer-menu-items');
    menu.append(summary, menuBody); toolbar.append(menu);
    for (const selector of ['#new-sequence-button', '#diagnostics-button', '.permissions-open', '#event-import-button']) {
        const button = document.querySelector(selector);
        if (button) menuBody.append(button);
    }
    menu.addEventListener('click', event => { if (event.target.closest('button') && !event.target.closest('button').disabled) menu.open = false; });
    menu.addEventListener('keydown', event => { if (event.key === 'Escape') { menu.open = false; summary.focus(); } });
    const feedback = node('div', 'designer-feedback'); bindAttribute(feedback, 'aria-label', () => t("ui.view.feedback.68df1297"));
    const statusStrip = document.querySelector('.status-strip');
    feedback.append(document.querySelector('#feedback')); statusStrip.after(feedback);
    const systemLabel = node('strong', 'workflow-system'); systemLabel.id = 'workflow-system';
    const storedLabel = node('span', 'status-chip'); storedLabel.id = 'workflow-stored';
    const projectLabel = node('span', 'workflow-project'); projectLabel.id = 'workflow-project';
    const nextStep = node('button', 'workflow-next'); nextStep.id = 'workflow-next'; nextStep.type = 'button';
    statusStrip.prepend(systemLabel);
    statusStrip.querySelector('#runtime-status').before(storedLabel);
    statusStrip.append(projectLabel, nextStep);
    const nextLabels = {review: 'workflow.review', store: 'workflow.store', connect: 'workflow.connect', read: 'workflow.read'};
    nextStep.addEventListener('click', () => {
        const data = getData();
        const next = workflowStatus(data)?.next;
        if (!next) return;
        if (isDesktop()) {
            document.dispatchEvent(new CustomEvent('z2ma-workflow-next', {detail: {systemId: data.workspaceContext.systemId, next}}));
            return;
        }
        opened = 'transfer'; update();
        const transfer = panels.transfer.panel;
        const target = transfer?.querySelector('button[data-transfer-action="' + (next === 'store' ? 'store' : 'validate') + '"]:not(:disabled)');
        (target ?? panels.transfer.button).focus();
    });
    const controls = node('section', 'designer-controls'); bindAttribute(controls, 'aria-label', () => t("ui.requests.for.the.selected.z2m.982736e9"));
    const tabs = node('div', 'designer-control-tabs');
    const bodies = node('div', 'designer-control-bodies');
    controls.append(tabs, bodies); document.querySelector('.system-selector').after(controls);
    const panels = {};
    let opened = ''; let system = '';
    for (const [name, selector, label, symbol] of [
        ['transfer', '.system-transfer:not(.system-runtime)', () => t("ui.validate.transfer.471b554a"), 'save'],
        ['runtime', '.system-runtime', () => t("ui.operation.2145893c"), 'play'],
        ['catalog', '.system-catalog', () => t("ui.device.data.6ac5cb61"), 'device']
    ]) {
        const panel = document.querySelector(selector);
        const button = node('button', 'designer-control-button'); button.type = 'button';
        const title = node('span', 'designer-control-title', label);
        const state = node('span', 'designer-control-state');
        button.append(icon(symbol), title, state);
        const body = node('div', 'designer-control-body'); body.hidden = true;
        body.id = 'designer-' + name; body.setAttribute('role', 'region'); bindAttribute(body, 'aria-label', () => label);
        button.setAttribute('aria-controls', body.id); button.setAttribute('aria-expanded', 'false');
        if (panel) body.append(panel);
        button.addEventListener('click', () => { opened = opened === name ? '' : name; update(); });
        tabs.append(button); bodies.append(body); panels[name] = {button, state, body, panel};
    }
    for (const {panel} of Object.values(panels)) if (panel) new MutationObserver(() => update()).observe(panel, {childList: true, subtree: true, attributes: true});
    const media = matchMedia('(max-width: 760px)');
    const folds = [];
    for (const [selector, caption] of [['.navigation', () => t("ui.select.automations.and.devices.3cc3ba00")], ['.inspector', () => t("ui.block.properties.a8e85650")]]) {
        const panel = document.querySelector(selector);
        const fold = node('details', 'designer-fold');
        const title = node('summary', 'designer-fold-title', caption); title.prepend(icon(selector === '.navigation' ? 'flow' : 'condition'));
        const content = node('div', 'designer-fold-content');
        content.append(...panel.childNodes); fold.append(title, content); panel.append(fold);
        folds.push({fold, mobileOpen: false});
    }
    let resizing = false;
    function resize() {
        resizing = true;
        for (const item of folds) item.fold.open = !media.matches || item.mobileOpen;
        resizing = false;
    }
    for (const item of folds) item.fold.addEventListener('toggle', () => { if (!resizing && media.matches) item.mobileOpen = item.fold.open; });
    media.addEventListener('change', resize); resize();
    document.querySelector('.navigation').addEventListener('click', event => {
        if (media.matches && event.target.closest('[data-entry]')) { folds[0].mobileOpen = false; folds[0].fold.open = false; }
    });
    document.querySelector('#flow').addEventListener('click', event => {
        if (media.matches && event.target.closest('[data-part]')) { folds[1].mobileOpen = true; folds[1].fold.open = true; }
    });
    function update() {
        const data = getData(); const nextSystem = data?.workspaceContext?.systemId ?? '';
        if (system !== nextSystem) { opened = ''; menu.open = false; system = nextSystem; }
        controls.hidden = !data?.workspace || data?.capabilities?.operationControls === false;
        const workflow = workflowStatus(data);
        systemLabel.hidden = storedLabel.hidden = !workflow;
        projectLabel.hidden = !workflow?.projectFile;
        nextStep.hidden = !workflow?.next;
        bindText(systemLabel, () => workflow?.system ?? '');
        bindText(storedLabel, () => workflow?.stored ?? '');
        bindText(projectLabel, () => workflow?.projectFile ?? '');
        if (workflow?.next) bindText(nextStep, () => t(nextLabels[workflow.next]));
        const states = layoutStatus(data);
        for (const [name, item] of Object.entries(panels)) {
            bindText(item.state, () => states[name]);
            item.button.disabled = !data?.[name === 'catalog' ? 'catalogRefresh' : name];
            item.button.setAttribute('aria-expanded', String(opened === name));
            const view = data?.[name === 'catalog' ? 'catalogRefresh' : name];
            item.button.dataset.tone = view?.error || view?.details ? 'error' : view?.pending ? 'pending' : '';
            item.body.hidden = opened !== name;
        }
        document.body.dataset.designerTheme = 'browser';
        guided();
    }
    update();
    return update;
}
