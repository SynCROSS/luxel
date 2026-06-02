# PRD: Luxel Prototype Slice + M11 (Delivered Baseline)

**Tracker:** [GitHub #12](https://github.com/SynCROSS/luxel/issues/12)  
**Child issues:** #14–#18

## Problem Statement

Luxel needs a provable end-to-end path from SFC source to SSR HTML, progressive boundary hydration, Bun build output, and a runnable dev loop—without Vite, without a full production feature set. Without a frozen public artifact contract and tests, every later feature (resource store, trisomorphic service worker, auth) risks re-litigating HTML shape, JSON sidecars, and hydration boundaries.

## Solution

Deliver the **prototype slice** on the counter **prototype fixture**, then exit via **thin M11** (correct boundary hydration + hardening tests) and **fat M11** (second file route + streaming SSR spike). The result is a Bun workspace with `packages/luxel`, `examples/counter`, goldens for manifest and SSR, `luxel dev|build|bench`, and Playwright smoke for the interactive counter.

## User Stories

1. As a Luxel maintainer, I want frozen golden contracts for manifest and SSR documents, so that regressions are caught by `bun test`.
2. As a Luxel maintainer, I want a counter SFC with `load()`, signals, `on:click`, and `hydrate:load`, so that the prototype fixture exercises real authoring syntax.
3. As a Luxel maintainer, I want Semantic IR to reject impure template expressions and `unsafe:html`, so that prototype security boundaries are enforced at compile time.
4. As a Luxel maintainer, I want Render IR to lower templates to DOM ops and codegen SSR plus attach modules, so that tracer hardcoding can be removed.
5. As a Luxel maintainer, I want a single `compileRoute` / `compileCounterApp` pipeline used by dev, build, tests, and the Render worker, so that behavior does not drift across environments.
6. As a Luxel maintainer, I want SFC `<script>` bundled verbatim with appended `setupBoundary` glue, so that authors do not hand-write client route modules.
7. As a Luxel maintainer, I want `hydrate:load` host elements preserved in SSR with boundary comment markers, so that SSR matches SFC structure.
8. As a Luxel maintainer, I want SFC styles inlined in `<head>` during the prototype slice, so that we avoid per-route CSS files until a later milestone.
9. As a Luxel maintainer, I want a same-process Render worker calling `load()` then render, so that SSR isolation shape exists before worker pools.
10. As a Luxel maintainer, I want `luxel build` to emit manifest, server routes, client routes, and hashed client assets, so that deploy shape is proven.
11. As a Luxel maintainer, I want `luxel dev` to watch SFC files and reload, so that the Vite-free dev graph is real.
12. As a Luxel maintainer, I want `luxel bench` to report counter SSR throughput and client JS size, so that measurement plumbing exists.
13. As a developer, I want to open the counter page and click increment after hydration, so that progressive boundary hydration works in a real browser.
14. As a Luxel maintainer, I want `hydrateRoute` to resolve boundary hosts from `luxel-hydration` markers, so that hydration does not depend on `closest("main")` heuristics.
15. As a Luxel maintainer, I want SSR to HTML-escape interpolated load data, so that XSS via `{message}` is blocked in the prototype slice.
16. As a Luxel maintainer, I want file route discovery for multiple `.luxel` files, so that routing is not counter-only.
17. As a developer, I want `GET /about` to return SSR HTML for a second route, so that multi-route serving is proven.
18. As a Luxel maintainer, I want an opt-in streaming SSR path (`?stream=1`) byte-identical to buffered HTML, so that streaming can evolve without a second wire format yet.
19. As a Luxel maintainer, I want `docs/prototype-slice.md` aligned with inline styles and boundary SSR policy, so that docs match shipped behavior.
20. As a Luxel maintainer, I want the prototype slice declared complete before post-prototype resource store work, so that scope does not bleed.

## Implementation Decisions

- **Prototype slice** scope per `docs/prototype-slice.md`; glossary in `CONTEXT.md`.
- **Compiler**: Semantic IR → Render IR → codegen; private IR, public manifest + SSR + sidecars.
- **compileRoute / compileCounterApp**: single compile entry; generated output under `.generated/counter`.
- **Hydration**: explicit `hydrate:load`; boundary markers wrap directive host; client attach via generated attach module.
- **Style delivery**: `<style>` in `<head>` from SFC; optional `style=""` on nodes later; no route CSS asset in prototype manifest.
- **Routing**: `discoverRouteFiles`; `index` → `/`, `about` → `/about`; about route has no hydration boundary.
- **Streaming spike**: `streamHtmlDocument` chunks HTML; handler serves stream when `?stream=1`.
- **Out of prototype**: auth, ISR, trisomorphic SW, plugins, fine-grained HMR, competitor benchmarks, `unsafe:html`, compiler-chosen boundaries.

## Testing Decisions

- Test **observable behavior** only: golden SSR/manifest, HTTP integration, Playwright smoke, hydrate unit tests (happy-dom `Window` per test), hardening escape test.
- Do not assert Semantic IR / Render IR internals in integration tests.
- Modules under test: artifact contracts, compile pipeline, render worker, handler, boundary host resolution, route discovery, streaming equivalence.

## Out of Scope

- Resource store, client nav store merge, trisomorphic service worker (see post-prototype PRD).
- Auth, server functions, ISR/SSG modes, plugin API, worker pools.
- Full streaming chunk protocol (chunked whole document only).
- `examples/nav-demo` (post-prototype).

## Further Notes

- ADR for post-prototype data plane: `docs/adr/0001-resource-store-phase-1.md`.
- Child issues under this PRD are **verify/close** slices for delivered work plus optional prototype exit housekeeping.
