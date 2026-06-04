## Parent

#28 — Phase B: multi-runtime deploy (Node + Deno production server)

## What to build

**Bundled deploy artifact** + **`loadAppFromDist`** so production can load a built app without in-process `compileApp`.

End-to-end behavior:

- `luxel build` (Bun toolchain) emits **`dist/server/app.mjs`** — server graph bundled with resolved deps (no imports into monorepo compiler/runtime source trees).
- Keeps existing outputs: manifest, client asset, `dist/server/entry.js` compress stub, inspectable `dist/server/routes/*` debug emit.
- **`loadAppFromDist(distDir)`** returns `{ app, clientBundle }` for `createAppServerFetch`.
- Integration proof: build **counter** example → load dist → `createAppServerFetch` (or `createAppFetch`) → fetch `/` returns SSR HTML with expected content; client asset served at existing asset path.
- Identity or config-driven compression ok; full Node compress path lands in slice 3.

## Acceptance criteria

- [ ] `luxel build` writes `dist/server/app.mjs` that imports cleanly from dist layout.
- [ ] `loadAppFromDist` documented export on deploy subpath (per ADR-0003).
- [ ] Build + loader tests use real counter `dist/` (not hand-rolled mocks).
- [ ] Debug route `.ts` emit still written and not required as deploy entry.
- [ ] Clear error when bundle or assets missing.

## Blocked by

None — can start immediately.
