

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/2.B4ZxjuSA.js","_app/immutable/chunks/DlFdhP-i.js","_app/immutable/chunks/DtgZCYjD.js"];
export const stylesheets = [];
export const fonts = [];
