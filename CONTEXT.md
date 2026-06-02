# Luxel

Bun-first, Vite-free web framework: compiled SFCs, streaming SSR, progressive hydration, trisomorphic rendering (server + page + service worker).

## Language

**Luxel**: The framework and toolchain (`@luxel/*` packages, `luxel` CLI).

**SFC**: Single-file component — HTML-like `<template>`, `<script>`, `<style scoped>`. Compiler-owned; not general HTML.

**Signal**: Fine-grained reactive primitive (`signal`, `computed`, `effect`). Runtime truth; compiler may sugar over it.

**Route loader**: Server `load(ctx)` that fetches data for a route/layout before render.

**Prefetch**: Explicit `prefetch(ctx)` run before render; compiler validates/optimizes resource reads. Client may add speculative prefetch on navigation.

**Server function**: Typed mutation/action invoked via form or JSON RPC. Compile-time manifest ID only — no client module refs.

**Render worker**: Bun worker that runs SSR, SSG, or ISR regeneration.

**Build worker**: Bun worker for compile, SSG, and ISR regen jobs.

**Hydration boundary**: Compiler-chosen (or `hydrate:*` override) region where client attaches interactivity.

**Trisomorphic rendering**: Same templates/routing on server (streaming SSR), browser page (hydrate + nav), and service worker (cached HTML nav). Per [web.dev](https://web.dev/articles/rendering-on-the-web#trisomorphic-rendering).

**Resource store**: Cache-aware async data layer with HTTP semantics, tags, and stable keys — shared across server, SW, and client nav.

**Generated manifest**: Inspectable compiler output for routes, render mode, data deps, security, and hydration — public contract; IR stays private.

**Prototype slice**: First executable Luxel milestone: one route, one SFC, SSR stream, client hydration boundary, Bun build, dev reload, and benchmark harness stub. Excludes auth, ISR, trisomorphic SW, and plugin API.

**Prototype fixture**: Counter demo app at `examples/counter` with async `load()` message, SSR-rendered HTML, one signal, one event binding, scoped CSS, and one hydration boundary.

**Prototype IR**: Two private compiler layers only: **Semantic IR** for SFC meaning and validation, then **Render IR** for SSR ops, client attach ops, and hydration boundary metadata. Target IRs deferred past prototype slice.

**Prototype hydration policy**: Prototype uses explicit `hydrate:load` as an element attribute on the interactive region. Compiler-chosen hydration boundaries are deferred until after the prototype slice.

**Prototype boundary SSR**: Elements carrying `hydrate:*` directives are preserved in SSR HTML (including wrapper elements such as `<section hydrate:load>`). Boundary comment markers wrap the directive host element in document order; the directive attribute is omitted from serialized HTML.

**Prototype style delivery**: SFC `<style>` blocks are emitted as a `<style>` element in `<head>` (block body copied verbatim; `scoped` attribute not serialized). Template nodes may also carry `style=""` attributes when the SFC template specifies inline styles. Per-component CSS asset files and `<link rel="stylesheet">` for route styles are deferred past the prototype slice; manifest `assets.css` may be absent or client-only for the shared client entry bundle.

**Prototype contract cutover**: Golden SSR/manifest contracts and compiler output change in the same change set (no long-lived red goldens on main).

**Prototype M11 sequence**: Exit requires two polish passes before post-prototype work — (1) **thin M11** (done): hydrate honors `luxel-hydration` boundaries and boundary host DOM; sync `docs/prototype-slice.md` with inline-style policy; hardening tests for escape and impure expressions. (2) **fat M11** (done): `compileCounterApp` discovers file routes (`index`, `about`); `GET /about` serves SSR; streaming spike via `?stream=1` and `streamHtmlDocument` (chunked `ReadableStream`, byte-identical to buffered HTML).

**Prototype SFC syntax**: Template expressions use `{expr}`. Event bindings use `on:event={handler}`. Colon-directive family matches `hydrate:*` (`hydrate:load`, `on:click`).

**Prototype template purity**: Strict whitelist for template expressions: literals, identifiers, and member access only. Operators and function calls are deferred past prototype slice.

**Prototype dev reload policy**: File watch invalidates route/component graph nodes, rebuilds affected output, then triggers full page reload. Fine-grained HMR is deferred.

**Prototype benchmark**: One runnable Luxel micro benchmark for the counter route: SSR throughput and generated client JS size. Competitor comparisons and weighted scorecard are deferred.

**Prototype package layout**: Hybrid Bun workspace with `packages/luxel` for compiler/runtime/dev/CLI internals, `packages/bench` for runnable benchmark code, and `examples/counter` as the demo app. Finer `@luxel/*` package split is deferred.

**Prototype routing**: File routes only. The prototype route lives at `examples/counter/src/routes/index.luxel` and generates the route manifest. Code routes are deferred.

**Prototype compiler ownership**: Use Bun build APIs first for bundling and build orchestration. Use Oxc only as a compiler front-end where Bun cannot expose framework semantics, especially `<script>` analysis. If Oxc blocks the prototype, fall back to a custom parser.

**Prototype parser fallback trigger**: Switch from Oxc to a custom parser if Oxc cannot expose import/export/`load()`/binding data cleanly or if Oxc adds install/build friction on Windows/Bun.

**Prototype signal runtime**: Luxel ships its own tiny signal runtime for `signal`, `computed`, and `effect` during the prototype slice.

**Prototype DOM update strategy**: Compiler emits direct text, attribute, and event attach ops with no VDOM. Minimal hydration markers provide stable anchors only where needed.

**Prototype codegen policy**: Render IR lowers the SFC template to a linear DOM op list; codegen walks ops for SSR HTML and the client attach module. The `<script>` block is bundled verbatim (Bun); the compiler does not parse signal graphs in the prototype slice.

**Prototype compile API**: `compileRoute(sfc)` is the single compile entry used by dev, build, test server, and Render worker. It returns server module source, client route module source, attach module source, and manifest slice; writing files under `dist/` is a thin `writeFile` step in build.

**Prototype client glue**: For each route, Luxel extracts the SFC `<script>` verbatim and appends generated `setupBoundary` glue that imports the generated attach module and wires handler/state symbols from the same module scope. Authors do not hand-write `client/routes/index.js` for file routes in the prototype slice.

**Prototype data sidecar**: SSR embeds route data in an inert JSON script (`type="application/json"`) for hydration. No executable JS literals.

**Prototype escaping policy**: HTML escaping is default for all template interpolation. `unsafe:html` is forbidden during the prototype slice.

**Prototype render worker**: Luxel exposes a Render worker abstraction during the prototype slice, but the implementation runs in the same Bun process. Worker IPC and pools are deferred.

**Prototype CLI**: Thin `luxel dev`, `luxel build`, and `luxel bench` commands drive the prototype dev loop, production build, and benchmark run.

**Prototype build output**: `luxel build` emits a server entry, client assets, and generated manifest. Single compiled Bun binary and platform adapters are deferred.

**Prototype test scope**: Tiny Bun unit tests, route integration tests, and one Playwright smoke test that clicks the counter and verifies browser hydration.

**Prototype plan**: Executable implementation checklist in `docs/prototype-slice.md`; separate from the compact architecture overview in `docs/architecture.md`.

**Prototype implementation order**: Test-first vertical tracer: write fixture behavior tests, hardcode generated SSR/client output, then replace hardcoded output with compiler-generated IR and build plumbing.

**Prototype artifacts**: Public build contracts are `manifest.json`, buffered SSR document with JSON sidecars (`luxel-data`, `luxel-hydration`), generated client attach module, and server route module exports (`load`, `render`). Private IR stays internal.

**Prototype app config**: Minimal `luxel.config.ts` per app with `root`, `routesDir`, and `outDir`. Generated manifest remains separate from app config.

**Prototype milestones**: M0–M11 phased plan in `docs/prototype-slice.md`; tracer first (M2), runtime/worker next (M3–M4), compiler/manifest replace tracer (M5–M7), CLI/bench last (M8–M11).

**Post-prototype roadmap**: Work after the prototype slice exits (M11 green). Covers auth, ISR, trisomorphic service worker, plugins, worker pools, platform adapters, and expanded threat-model docs — not part of the prototype slice.

**Post-prototype phase 1 (ADR):** See [docs/adr/0001-resource-store-phase-1.md](./docs/adr/0001-resource-store-phase-1.md).

**Post-prototype phase 1**: **Resource store** — cache-aware async data with HTTP semantics, stable keys, and tags on **server render and client navigation** (no service worker yet). **Post-prototype phase 2**: **Trisomorphic SW** — service worker caches **full HTML documents** keyed by route plus resource generation/etag; cache hit serves stored HTML, miss falls back to network SSR. Uses the same resource keys/tags as phase 1; does not re-run Render IR in the worker at phase-2 entry.

**Resource load pipeline**: Route `load()` and `prefetch()` write into the resource store; render reads the store (not ad-hoc `load` return values). Hydration receives a versioned **resource snapshot** in the existing `luxel-data` sidecar (`id` unchanged; JSON envelope gains a `version` field and resource map) — still inert JSON, no executable literals.

**Resource stable keys**: Compiler assigns default stable keys from route id and analyzed `load`/`prefetch` writes; authors may override keys (and tags) explicitly when needed for deduplication or invalidation.

**Resource cache entry**: Each stored resource carries HTTP-style cache metadata (for example `max-age`, stale/revalidate windows) **and** tag membership for grouped invalidation (`revalidateTag` / equivalent).

**Resource store fixture**: Post-prototype phase 1 is proven by a new two-route demo app (for example `examples/nav-demo`) with client navigation, `prefetch`, and tag revalidation — not by extending the counter prototype fixture alone.

**Client navigation (phase 1)**: In-app route changes `fetch` the target URL as a full HTML document, parse `luxel-data` / `luxel-hydration` from the response, merge into the client resource store, and re-hydrate affected boundaries — no separate JSON nav protocol in phase 1.

**Route prefetch**: Optional `export async function prefetch(ctx)` lives in the route SFC `<script>` alongside `load()`; it writes to the resource store ahead of navigation or SSR.

**Tag revalidation**: `revalidateTag(tag)` (or equivalent) is a **server-only** API in phase 1 — callable from route loaders, prefetch, and (later) server functions after mutations. Client navigation reads the resource store and sidecar snapshots; it does not invalidate tags in phase 1.

**Prototype threat model**: Inline threat table in `docs/prototype-slice.md` for prototype scope; full `docs/threat-model.md` deferred until after slice.

_Avoid_: "framework" as product name in docs (use **Luxel**); "server components" in React sense; "hydration" alone when meaning progressive boundary hydration.

## Relationships

- A **Route** has zero or one **Route loader** and zero or one **Prefetch**
- **Prefetch** → populates request **Resource store** → **Render worker** consumes it
- **SFC** compiles to SSR stream + client bundle + optional **Hydration boundary** metadata
- **Server function** never references arbitrary modules from the client — only manifest IDs
- **Trisomorphic rendering**: initial nav → server; repeat nav → SW if cache hit, else server fallback
- **Prototype slice** proves the compile → render → hydrate → benchmark path before larger subsystems
- **Prototype fixture** exercises `load()`, signal reactivity, event binding, scoped CSS, SSR, and progressive boundary hydration
- **Prototype IR** keeps compiler internals private while proving SFC validation, SSR generation, client attach, and boundary metadata
- **Prototype hydration policy** uses explicit element-attribute boundaries to validate manifest + client attach before compiler heuristics
- **Prototype boundary SSR** keeps hydrate directive hosts in SSR output and uses comment markers on those hosts
- **Prototype style delivery** uses head `<style>` for SFC blocks and optional `style=""` on template nodes; no per-route CSS files in the prototype slice
- **Prototype SFC syntax** keeps expressions and events in one colon-directive vocabulary with `hydrate:*`
- **Prototype template purity** enforces compile-time pure expressions before broader macro/escape-hatch work
- **Prototype dev reload policy** proves Luxel's Vite-free graph ownership before adding fine-grained HMR
- **Prototype benchmark** proves measurement plumbing early without turning benchmark breadth into the prototype bottleneck
- **Prototype package layout** keeps one framework package, one benchmark package, and one demo app under Bun workspaces
- **Prototype routing** proves file route discovery and manifest generation from `examples/counter` before adding code routes
- **Prototype compiler ownership** keeps Bun responsible for build/bundle work while Luxel owns SFC semantics
- **Prototype parser fallback trigger** prevents parser tooling from blocking the compile → render → hydrate path
- **Prototype signal runtime** establishes Luxel-owned fine-grained reactivity before broader runtime features
- **Prototype DOM update strategy** ties fine-grained signals directly to generated DOM attach/update ops
- **Prototype codegen policy** generates SSR and attach from a template DOM op list while leaving `<script>` to Bun bundling
- **Prototype compile API** keeps one compile pipeline for dev, build, tests, and Render worker; dist output is emitted from that pipeline
- **Prototype client glue** appends boundary setup exports to the extracted SFC script before client bundling
- **Prototype data sidecar** exercises JSON-only hydration data without introducing server-component-style executable payloads
- **Prototype escaping policy** proves safe rendering defaults before adding explicit unsafe escape hatches
- **Prototype render worker** preserves the SSR isolation boundary in code shape before adding worker pools and IPC
- **Prototype CLI** makes the prototype executable through the public `luxel` command shape from day one
- **Prototype build output** proves the deploy artifact shape before adapter and binary packaging work
- **Prototype test scope** verifies compiler/runtime units, route SSR integration, and real browser progressive boundary hydration
- **Prototype plan** translates architecture decisions into build order without expanding the architecture overview
- **Prototype implementation order** proves end-to-end behavior before deepening compiler/runtime internals
- **Prototype artifacts** define inspectable public outputs separate from private compiler IR
- **Prototype app config** points Luxel at `examples/counter` without expanding config beyond path roots
- **Prototype milestones** sequence tracer, runtime, compiler, build, dev, bench, and smoke validation
- **Prototype M11 sequence** requires thin then fat polish before post-prototype roadmap work begins
- **Post-prototype roadmap** starts only after prototype slice exit; defers auth, ISR, trisomorphic SW, and plugins
- **Post-prototype phase 1** delivers the resource store on server + client nav before SW (phase 2)
- **Post-prototype phase 2** adds service worker HTML document caching keyed by route and resource staleness
- **Resource load pipeline** routes `load`/`prefetch` through the store into a versioned `luxel-data` resource snapshot
- **Resource stable keys** default from the compiler with optional author overrides
- **Resource cache entry** combines HTTP cache metadata with tags on every stored resource
- **Resource store fixture** validates phase 1 via a dedicated two-route demo app
- **Client navigation (phase 1)** uses full-document fetch plus sidecar parse and store merge
- **Route prefetch** is authored as an optional SFC script export next to `load()`
- **Tag revalidation** is server-only in phase 1; clients consume invalidated snapshots via subsequent HTML nav
- **Prototype threat model** records XSS, JSON sidecar, purity, and manifest threats without blocking tracer work

## Example dialogue

> **Dev:** "Should this page SSR?"
> **Expert:** "If `load` reads cookies → SSR. Static catalog only → SSG. `revalidate: 60` → ISR. Override in route export if auto mode wrong."

## Flagged ambiguities

- "Resumability" (Qwik-style) is **not** v1 — streaming + progressive hydration yes; full resumability deferred.
- "Vite-free" = no Vite, Rollup, or Vite plugin API — Bun.build + Oxc analysis + own dev/HMR graph.
