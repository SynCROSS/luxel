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
- **Prototype threat model** records XSS, JSON sidecar, purity, and manifest threats without blocking tracer work

## Example dialogue

> **Dev:** "Should this page SSR?"
> **Expert:** "If `load` reads cookies → SSR. Static catalog only → SSG. `revalidate: 60` → ISR. Override in route export if auto mode wrong."

## Flagged ambiguities

- "Resumability" (Qwik-style) is **not** v1 — streaming + progressive hydration yes; full resumability deferred.
- "Vite-free" = no Vite, Rollup, or Vite plugin API — Bun.build + Oxc analysis + own dev/HMR graph.
