/* Whole-step ordering shared by rule and sequence editors; no server writes while dragging. */
export function moveAction(items, from, to) {
    if (!Array.isArray(items) || !Number.isInteger(from) || !Number.isInteger(to)
        || from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return items;
    const result = items.slice(); const [item] = result.splice(from, 1); result.splice(to, 0, item); return result;
}

export function actionDropPosition(from, target, after) {
    const position = target + (after ? 1 : 0);
    return position - (from < position ? 1 : 0);
}

export function installActionSorting(container, {getItems, canMove, onMove}) {
    const mime = 'application/x-z2ma-action-order';
    const listeners = []; let source = null; let original = null; let disposed = false;
    const listen = (element, type, callback) => { element.addEventListener(type, callback); listeners.push(() => element.removeEventListener(type, callback)); };
    const clear = () => {
        source = null; original = null;
        container.querySelectorAll('[data-action-index]').forEach(row => row.classList.remove('drag-source', 'drop-before', 'drop-after'));
    };
    const rowAt = event => {
        const row = event.target.closest?.('[data-action-index]');
        return row && container.contains(row) ? row : null;
    };
    const valid = () => !disposed && source !== null && canMove() && original === getItems();
    for (const handle of container.querySelectorAll('[data-order-handle]')) {
        handle.draggable = true;
        listen(handle, 'dragstart', event => {
            const row = rowAt(event); const index = Number(row?.dataset.actionIndex);
            if (!row || !canMove() || !Number.isInteger(index) || index < 0 || index >= getItems().length || !event.dataTransfer) { event.preventDefault(); return; }
            source = index; original = getItems(); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData(mime, String(index));
            row.classList.add('drag-source');
        });
        listen(handle, 'dragend', clear);
    }
    listen(container, 'dragover', event => {
        const row = rowAt(event);
        if (!valid() || !row || !event.dataTransfer?.types.includes(mime)) return;
        event.preventDefault(); event.dataTransfer.dropEffect = 'move';
        const after = event.clientY > row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
        container.querySelectorAll('[data-action-index]').forEach(item => item.classList.remove('drop-before', 'drop-after'));
        row.classList.add(after ? 'drop-after' : 'drop-before');
        const dialog = container.closest('dialog');
        if (dialog) {
            const box = dialog.getBoundingClientRect();
            if (event.clientY < box.top + 36) dialog.scrollTop -= 24;
            else if (event.clientY > box.bottom - 36) dialog.scrollTop += 24;
        }
    });
    listen(container, 'drop', event => {
        const row = rowAt(event);
        if (!valid() || !row || event.dataTransfer?.getData(mime) !== String(source)) return;
        event.preventDefault(); event.stopPropagation();
        const after = event.clientY > row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
        const from = source; const to = actionDropPosition(from, Number(row.dataset.actionIndex), after);
        clear(); onMove(from, to);
    });
    return {dispose() { disposed = true; clear(); listeners.forEach(remove => remove()); }};
}
