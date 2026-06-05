# Plugin sandbox (v1.1)

WASM-isolated compile hooks. Trusted JS plugins stay out-of-process (dev-only).

## Manifest

```json
{
  "id": "example-add",
  "wasmPath": "plugins/example.wasm",
  "capabilities": ["transform-script"]
}
```

Validate with `validatePluginManifest()` — `transform-script` and `network` allowed; unknown caps rejected.

## Loader

`loadWasmAddPlugin()` — sample hook with **zero host imports**.

`loadWasmFetchPlugin()` — wasm importing `env.fetch`; needs `network` in manifest or instantiate fails.

`createSandboxImports(capabilities)` — empty unless `network` granted (stub returns `42`).

See `packages/luxel/src/plugin/wasm-sandbox.ts`.

## Security

Human review required (HITL) before user plugins in production builds. See [threat-model.md](./threat-model.md).
