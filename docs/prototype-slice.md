# Luxel Prototype Slice

## Goal

First executable Luxel milestone: one route, one SFC, SSR stream, progressive boundary hydration, Bun build, dev reload, production build output, and one runnable benchmark.

## Fixture

- App root: `examples/counter`
- File route: `examples/counter/src/routes/index.luxel`
- SFC syntax: `{expr}` interpolation; `on:event={handler}` bindings; `hydrate:*` boundaries
- Template purity: minimal whitelist — literals, identifiers, member access only; operators and calls deferred
- Hydration: explicit `hydrate:load` element attribute on interactive region

```html
<template>
  <h1>{message}</h1>
  <section hydrate:load>
    <button type="button" on:click={increment}>{count}</button>
  </section>
</template>
```

- Escaping: HTML escape default; `unsafe:html` forbidden

```ts
// examples/counter/luxel.config.ts
export default {
  root: ".",
  routesDir: "src/routes",
  outDir: "dist",
};
```

## Architecture

- Monorepo: Bun workspaces at repo root for `packages/*` and `examples/*`
- Package layout: `packages/luxel` + `packages/bench`
- App config: minimal `luxel.config.ts` with `root`, `routesDir`, `outDir`
- Compiler IR: `Semantic IR` -> `Render IR`; Target IRs deferred
- Build ownership: Bun build APIs own bundling/orchestration
- Framework semantics: Luxel owns SFC semantics, IR, route manifest
- JS analysis: Oxc only where Bun cannot expose import/export/`load()`/binding data
- Parser fallback: custom parser if Oxc lacks needed data or causes Windows/Bun install/build friction

## Runtime

- Signals: Luxel-owned tiny `signal`, `computed`, `effect`
- DOM: direct text/attr/event attach ops; no VDOM
- Hydration anchors: minimal markers only where needed
- Data sidecar: inert JSON script, no executable literals

## Server And Dev

- Render worker: abstraction exists; same-process Bun impl for prototype
- Dev reload: file watch -> graph invalidation -> rebuild -> full page reload
- CLI: thin `luxel dev`, `luxel build`, `luxel bench`
- Build output: server entry, client assets, generated manifest

## Benchmark

- One runnable Luxel micro benchmark
- Metrics: SSR counter route throughput, generated client JS size
- Competitor comparisons + weighted scorecard deferred

## Tests

- Bun unit tests for compiler/runtime basics
- Route integration tests for SSR HTML, manifest, hydration script
- One Playwright smoke test: click counter, verify hydrated update

## Generated Artifacts

Public contracts only. Private IR stays internal.

### Build output layout

```
dist/
  manifest.json
  server/
    entry.js
    routes/index.js
  client/
    entry.js
    routes/index.js
    routes/index.attach.js
  assets/
    index.<hash>.css
    client.<hash>.js
```

### `manifest.json`

Inspectability contract for routes, render mode, hydration, and asset refs.

```json
{
  "version": 1,
  "routes": [
    {
      "id": "route:index",
      "path": "/",
      "source": "examples/counter/src/routes/index.luxel",
      "mode": "ssr",
      "hasLoad": true,
      "serverModule": "server/routes/index.js",
      "clientModule": "client/routes/index.js",
      "hydration": [
        {
          "id": "boundary:0",
          "directive": "load",
          "componentId": "sfc:index"
        }
      ],
      "assets": {
        "client": "assets/client.<hash>.js"
      }
    }
  ],
  "components": [
    {
      "id": "sfc:index",
      "source": "examples/counter/src/routes/index.luxel"
    }
  ]
}
```

Rules:

- `mode` is `ssr` for prototype fixture.
- `hydration[]` comes from explicit `hydrate:load` in SFC.
- No executable literals in manifest.
- Manifest is generated; hand-author only for tracer phase.

### SSR document shape

Buffered HTML for prototype. Streaming chunks deferred.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Luxel</title>
    <style>
      button {
        font: inherit;
        min-width: 44px;
        min-height: 44px;
      }
    </style>
  </head>
  <body>
    <main data-luxel-route="/">
      <h1>Hello Luxel</h1>
      <!-- luxel:boundary-start id="boundary:0" directive="load" -->
      <section><button type="button" data-luxel-text="count">0</button></section>
      <!-- luxel:boundary-end id="boundary:0" -->
    </main>

    <script type="application/json" id="luxel-data">
      {"message":"Hello Luxel"}
    </script>
    <script type="application/json" id="luxel-hydration">
      {"routeId":"route:index","boundaries":[{"id":"boundary:0","directive":"load","clientModule":"client/routes/index.js"}]}
    </script>
    <script type="module" src="/assets/client.<hash>.js"></script>
  </body>
</html>
```

Rules:

- Template text escaped by default.
- `luxel-data` = serialized `load()` result only.
- `luxel-hydration` = boundary metadata only; JSON, not JS.
- Boundary markers wrap the `hydrate:*` host element; client `hydrateRoute` resolves the host from markers + `luxel-hydration.boundaries[]` (not `closest("main")`).
- SFC `<style>` is emitted as `<style>` in `<head>` during the prototype slice; per-route CSS asset files are deferred.
- `data-luxel-text` / `data-luxel-attr` / `data-luxel-event` allowed on SSR nodes when needed by attach ops.

### Client entry shape

`client/entry.js` bootstraps hydration from sidecars.

```ts
import { readJsonSidecar } from "./runtime/sidecar";
import { hydrateRoute } from "./runtime/hydrate";
import * as routeIndex from "./routes/index.js";

const hydration = readJsonSidecar("luxel-hydration");
const data = readJsonSidecar("luxel-data");

hydrateRoute({
  routeId: hydration.routeId,
  data,
  boundaries: hydration.boundaries,
  modules: { "route:index": routeIndex },
});
```

`client/routes/index.js` exports boundary setup for one route.

```ts
import { signal } from "../runtime/signal";
import { attach } from "./index.attach.js";

export function setupBoundary(ctx: { data: { message: string } }) {
  const count = signal(0);
  return {
    state: { count },
    attach(root: HTMLElement) {
      attach(root, { count, increment: () => count.value++ });
    },
  };
}
```

`client/routes/index.attach.js` is generated from Render IR.

```ts
export function attach(root: HTMLElement, ctx: { count: Signal<number>; increment: () => void }) {
  const button = root.querySelector("[data-luxel-text='count']");
  bindText(button, () => String(ctx.count.value));
  bindClick(button, ctx.increment);
}
```

Rules:

- Client reads sidecars; does not rerun `load()` in browser for prototype.
- Attach ops are direct DOM updates; no VDOM.
- Generated attach module is stable public output for tests/benchmarks.

### Server route module shape

`server/routes/index.js` exports render fn consumed by Render worker.

```ts
export async function load() {
  return { message: "Hello Luxel" };
}

export async function render(ctx: { data: Awaited<ReturnType<typeof load>> }) {
  return renderFromTemplate("route:index", ctx.data);
}
```

Rules:

- `load()` and `render()` are separate exports.
- Render worker calls `load()` then `render({ data })`.
- Template render can be generated or hardcoded during tracer phase.

## Milestones

Each milestone has entry criteria, deliverables, exit checks. No code until planning complete.

| Milestone | Goal | Exit check |
|-----------|------|------------|
| M0 | Freeze fixture + artifact contracts + threat table | Fixture SFC, JSON/HTML examples, inline threat model approved |
| M1 | Test specs | Unit/integration/Playwright tests exist; initially fail |
| M2 | Vertical tracer | Hardcoded artifacts serve `/`; tests for SSR HTML + sidecars pass |
| M3 | Runtime core | Signals + attach ops + hydrate boundary work against tracer HTML |
| M4 | Render worker | Same-process worker renders fixture via server module contract |
| M5 | Semantic IR | SFC parse/validate -> Semantic IR; purity/escape errors |
| M6 | Render IR + codegen | Semantic IR -> Render IR -> SSR HTML + attach module |
| M7 | Manifest + routing | File route discovery -> `manifest.json` matches contract |
| M8 | `luxel build` | Bun build emits server/client/assets/manifest in `dist/` |
| M9 | `luxel dev` | Watch -> graph invalidation -> rebuild -> full reload |
| M10 | `luxel bench` | Counter SSR throughput + client JS size reported |
| M11 | Smoke + polish | Playwright click test green; escaping/error cases tightened |

Dependency order:

```
M0 -> M1 -> M2 -> M3 -> M4 -> M5 -> M6 -> M7 -> M8 -> M9 -> M10 -> M11
```

Parallelizable after M2:

- M3 runtime core
- M4 render worker shell

Both must land before M6 replaces hardcoded tracer output.

## Implementation Order

1. M0–M1: contracts + failing tests.
2. M2–M4: vertical tracer + runtime + render worker on hardcoded/generated attach path.
3. M5–M7: real compiler + manifest replace tracer artifacts.
4. M8–M10: build/dev/bench CLI wiring.
5. M11: browser smoke + hardening.

## Threat Model (prototype scope)

Inline for prototype; expand to `docs/threat-model.md` after slice.

| Threat | Mitigation in prototype |
|--------|-------------------------|
| XSS via template interpolation | HTML escape default; `unsafe:html` forbidden |
| Executable hydration payload | JSON-only sidecars (`luxel-data`, `luxel-hydration`); no JS literals in stream |
| Template expression abuse | Minimal purity whitelist (literals, identifiers, member access) |
| Event handler injection | `on:event={handler}` binds script exports only; compiler validates handler refs |
| Manifest tampering | Generated at build; server reads build output, not client-supplied manifest |
| CSRF / server functions | Out of scope; no server functions in prototype |
| Plugin supply chain | Out of scope; no plugins in prototype |
| Worker isolation | Same-process Render worker; process isolation deferred |

Open after prototype:

- `unsafe:html` + sanitizer + TrustedHTML
- Server function manifest IDs, CSRF, origin/session
- CSP + Trusted Types hooks
- Plugin sandbox (WASM / trusted worker policy)

## Deferred

- Compiler-chosen hydration boundaries
- Fine-grained HMR
- ISR, auth, trisomorphic SW
- Plugin API
- Worker pools + IPC
- `bun build --compile`
- Node/edge/platform adapters
- Competitor benchmarks
