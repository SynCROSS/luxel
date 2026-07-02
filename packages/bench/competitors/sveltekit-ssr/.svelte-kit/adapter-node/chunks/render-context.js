const a=!1;function i(e){throw new Error("https://svelte.dev/e/experimental_async_required")}function s(e){throw new Error("https://svelte.dev/e/lifecycle_outside_component")}function l(){const e=new Error(`await_invalid
Encountered asynchronous work while rendering synchronously.
https://svelte.dev/e/await_invalid`);throw e.name="Svelte error",e}function d(e,n){const r=new Error(`hydratable_serialization_failed
Failed to serialize \`hydratable\` data for key \`${e}\`.

\`hydratable\` can serialize anything [\`uneval\` from \`devalue\`](https://npmjs.com/package/uneval) can, plus Promises.

Cause:
${n}
https://svelte.dev/e/hydratable_serialization_failed`);throw r.name="Svelte error",r}function c(){const e=new Error("invalid_csp\n`csp.nonce` was set while `csp.hash` was `true`. These options cannot be used simultaneously.\nhttps://svelte.dev/e/invalid_csp");throw e.name="Svelte error",e}function v(){const e=new Error("invalid_id_prefix\nThe `idPrefix` option cannot include `--`.\nhttps://svelte.dev/e/invalid_id_prefix");throw e.name="Svelte error",e}function t(){const e=new Error("server_context_required\nCould not resolve `render` context.\nhttps://svelte.dev/e/server_context_required");throw e.name="Svelte error",e}function _(){const e=o?.getStore();return t(),e}let o=null;export{a as D,l as a,v as b,i as e,_ as g,d as h,c as i,s as l};
