/* Product adapters install once before the shared view starts. Web defaults to fetch. */
let adapter = null;
export function installTransport(value) {
    if (adapter || value?.kind !== 'desktop' || typeof value.request !== 'function') throw new Error('Invalid designer adapter.');
    adapter = Object.freeze(value);
}
export const isDesktop = () => adapter?.kind === 'desktop';
export const designerRequest = (...args) => adapter ? adapter.request(...args) : globalThis.fetch(...args);
