## Problem Statement

Luxel fails the v1.0 tier-2 server throughput gate on the spiral benchmark (~394 RPS vs ~693 for Svelte/Solid/Vue — factor ~1.76, gate ≤1.08). Counter ISR also fails (~2,121 RPS vs SvelteKit ISR ~4,784). Root cause: request-time SSR walks an interpreted `DomOp` tree (~2.4k static elements for spiral) and ships full document sidecars even on zero-client routes. Counter SSR wins only via precomputed HTML fast paths, not representative of heavy SSR cost.

Authors need Luxel to match the comparison class on server render throughput without abandoning the Luxel-native SFC model or waiting for Rust tooling.

## Solution

Ship **Phase 0** in the TypeScript compiler and server pipeline: compiled list SSR via `{#each}`, compiler-inferred document payload policy, and a true ISR cache hit path. Spiral fixture becomes `load` + store + `{#each}` per fairness contract. Exit when `luxel bench --gate` passes spiral and counter ISR tier-2 cells (geo-mean ≤ 1.08). Rust `luxel-core` SSR and WASM bundler remain gated behind Phase 0 green per ADR-0005.

## User Stories

1. As a Luxel maintainer, I want spiral SSR to emit a compiled `for` loop instead of walking thousands of `DomOp` nodes per request, so that tier-2 RPS approaches Svelte/Solid/Vue.
2. As a Luxel maintainer, I want `{#each expr as item}` … `{/each}` block syntax in SFC templates, so that list rendering is idiomatic and compiler-lowering is straightforward.
3. As a Luxel maintainer, I want `{/each}` to be required (no self-closing shorthand), so that the template parser stays simple and Svelte-aligned in Phase 0.
4. As a Luxel author, I want `load()` to write an array to the resource store and iterate it in the template, so that spiral and list routes follow the same data pipeline as other routes.
5. As a Luxel author, I want the default store key for `{#each tiles as t}` to be `${routeId}:tiles`, so that I do not hand-wire binding maps for common cases.
6. As a Luxel author, I want to override the store key via explicit `ctx.store.set("custom:key", value)`, so that deduplication and tag invalidation remain under my control.
7. As a Luxel maintainer, I want numeric `left`/`top` style bindings inside `{#each}` to codegen `.toFixed(2)`, so that spiral output matches SynCROSS / Platformatic competitor formatting.
8. As a Luxel maintainer, I want the spiral bench fixture to use loop-at-SSR (not a generated static ~2.4k-div template), so that WinRK rows are fair per `docs/benchmarks/fairness.md`.
9. As a Luxel author, I want the compiler to omit `luxel-data`, `luxel-hydration`, and client `<script>` when no client consumer exists on a route, so that zero-interactivity pages ship minimal HTML.
10. As a Luxel author, I want `export const client = { hydration: 'never' | 'auto' }` in the route SFC to control hydration policy, so that policy lives beside the route source.
11. As a Luxel author, I want `luxel.config.ts` per-route `routes[path].client.hydration` when the SFC omits `export const client`, so that app-level defaults are possible.
12. As a Luxel author, I want SFC `export const client` to win over `luxel.config.ts` on conflict, so that colocated route policy is authoritative.
13. As a Luxel author, I want a compile error when `client.hydration: 'never'` coexists with any `hydrate:*` directive, so that contradictory routes fail at build time.
14. As a Luxel maintainer, I want `hydrate:*` boundaries to force hydration sidecars and client script when attach ops exist, so that interactive routes still hydrate correctly.
15. As a Luxel maintainer, I want the generated manifest to record resolved `client.hydration` and `shipSidecars` flags, so that deploy and bench harnesses can inspect the public contract.
16. As a Luxel maintainer, I want ISR cache hits to serve stored HTML bytes without invoking the render worker, resource-store snapshot, or document re-serialization, so that `luxel-isr` WinRK RPS matches SvelteKit ISR class.
17. As a Luxel maintainer, I want ISR miss/regen behavior unchanged, so that correctness and tag invalidation are preserved.
18. As a Luxel maintainer, I want the WinRK `luxel-isr` bench row to use a warmed cache within the 1s revalidate TTL, so that sustained hits are measured realistically.
19. As a Luxel maintainer, I want `luxel bench --gate` to validate spiral and counter ISR tier-2 cells together, so that Phase 0 exit is evidence-backed.
20. As a Luxel maintainer, I want counter SSR contract tests to keep passing with full document shape on interactive routes, so that counter hydration is not regressed.
21. As a Luxel maintainer, I want spiral HTML output to still contain `spiral_tile_count` matching `spiral-html.ts`, so that fixture contract tests remain valid.
22. As a Luxel author, I want `{#each}` list identifiers to participate in template binding inference, so that `projectSnapshotToTemplateData` supplies the loop collection at render time.
23. As a Luxel maintainer, I want compile errors for malformed `{#each}` blocks (missing `{/each}`, unclosed blocks), so that invalid templates fail early.
24. As a Luxel maintainer, I want generated `renderRouteDocumentFromStore` to avoid embedding huge `renderIr` JSON for list-heavy routes, so that server bundle size and module load cost drop.
25. As a benchmark reader, I want `ssr_html_bytes` published for spiral after payload policy, so that transfer tier interpretation stays honest.
26. As a Luxel maintainer, I want deploy parity tests to pass for counter after payload policy changes, so that dev and dist HTML remain aligned on gated fixtures.
27. As a Luxel maintainer, I want `contracts.test.ts` and similar goldens updated in the same change set as payload policy, so that main does not carry red contract tests.
28. As a future luxel-core engineer, I want Phase 0 to define the SSR ABI (`renderRouteDocumentFromStore`, list loop shape, sidecar flags), so that Rust SSR can swap behind the same seam in Phase 1.
29. As a Luxel maintainer, I want Phase 0 to ship without static subtree freeze, so that scope stays focused on the spiral gate.
30. As a Luxel maintainer, I want static subtree freeze reserved for Phase 0.5 only if spiral still misses 1.08 after Phase 0, so that conditional work is not premature.

## Implementation Decisions

### Modules to build or modify

**Template parser / lowerer (deep module)**  
Extend template tokenization and lowering to recognize `{#each listExpr as itemName}` … `{/each}` blocks. Output a `ForLoopIr` (or equivalent) on `RenderIr` instead of flattening to N `element` ops. Reject unclosed blocks and self-closing `{#each}` without `{/each}`. Integrate with existing `analyzeRouteSfc` / `compileTemplateIr` pipeline per ADR-0004 route analysis seam.

**List binding inference (deep module)**  
Extend binding inference so `{#each}` list identifiers map to resource store keys: default `${routeId}:${listId}`; honor explicit string or const-resolved keys from `store.set` analysis (extend existing `inferTemplateBindings` / `findResourceKeyForField` patterns). Whole-array projection at render time (field = entire resource value, not a scalar field path).

**SSR codegen v2 (deep module)**  
New path in route runtime codegen: for routes with `ForLoopIr`, emit a native `for` loop appending to an HTML buffer inside `renderRouteDocumentFromStore`. Detect numeric `left`/`top` style patterns in loop body and emit `.toFixed(2)` in generated JS. Retain existing `codegenSsrDocument` / `renderDomOps` path for non-list templates (counter, nav-demo). Document shell assembly (doctype, head styles, main wrapper) stays centralized.

**Document payload policy (deep module)**  
Extend `analyzeRouteSfc` (or adjacent analysis) to compute `shipSidecars`: `{ data, hydration, clientScript }` from inference rules. Read optional `export const client = { hydration: 'never' | 'auto' }` from script analysis. Merge `luxel.config.ts` `routes[path].client.hydration` only when SFC omits client export (config loader extension). Compile error on `never` + any `hydrate:*`. Thread flags into `CodegenSsrOptions` and manifest route slice. Update contract assertions to be route-mode-aware (interactive routes keep sidecars; zero-client routes omit).

**Spiral fixture generator**  
Replace static tile markup expansion in spiral SFC builder with loop-based SFC: `load` calls `computeSpiralTiles()` into store; template uses `{#each tiles as t}` with tile `div` and style bindings. Import shared tile math from existing spiral-html module.

**ISR hot path (server module)**  
Audit `matchIsrCache` and filesystem `HtmlCacheAdapter`: ensure hit path returns pre-encoded bytes without `worker.render`, store snapshot, or string re-encoding. If adapter is async/fs-bound under load, add in-process byte cache layer or store `Uint8Array` plus `Content-Type` headers on set. Warm cache before WinRK measurement in bench server startup. Preserve miss path: render worker → cache set with tags.

**Manifest / config**  
Extend manifest types with `client.hydration` and `shipSidecars`. Extend `LuxelConfig` with optional per-route client overrides (path-keyed).

**Bench / gate**  
Ensure `luxel bench --gate` includes spiral tier-2 and counter ISR cells. WinRK spiral and luxel-isr rows must pass geo-mean ≤ 1.08 vs executed competitors.

### Architectural decisions (locked)

- Dual track per ADR-0005: Phase 0 TS only; no Rust work until Phase 0 green.
- Phase 0 scope: `{#each}` codegen, document payload policy, ISR hot path, spiral fixture rewrite. Static subtree freeze → Phase 0.5 conditional.
- Spiral fairness: per-request `load` + framework render; no static 2400-div bake.
- Override precedence: `hydrate:*` forces client artifacts; SFC `export const client` beats config; `never` + `hydrate:*` → compile error; inference default.
- Store key default: `${routeId}:tiles` for list binding `tiles`.
- `{/each}` required in Phase 0.
- Numeric coord formatting: `.toFixed(2)` in loop codegen for left/top style bindings.

### API contracts

- Public author syntax: `{#each expr as item}` … `{/each}`; `export const client = { hydration: 'never' | 'auto' }`.
- Config: `routes[path].client.hydration` (fallback only).
- Generated manifest fields: `client.hydration`, `shipSidecars` (or equivalent names aligned with glossary).
- `renderRouteDocumentFromStore(store)` remains the deploy SSR entry; internal implementation may switch from interpreter to emitted loop.

## Testing Decisions

**Principle:** Test external behavior — compiled output shape, rendered HTML, HTTP headers, bench metrics — not private parser internals unless via snapshot of generated `renderRouteDocumentFromStore` source for regression.

**Modules to test:**

| Module | Test focus | Prior art |
|--------|------------|-----------|
| Template `{#each}` parser | Valid blocks compile; missing `{/each}` errors; nested markup inside loop | `compiler.test.ts`, `hardening.test.ts` |
| List binding inference | `${routeId}:tiles` default; explicit `store.set` key override | `resource-store.test.ts`, binding inference tests |
| SSR codegen v2 | Generated loop contains `toFixed(2)` for spiral style; spiral tile count in HTML | `spiral-html.test.ts`, `spiral-bench.test.ts` |
| Document payload policy | Zero-client spiral omits sidecars; counter keeps them; `never`+`hydrate:load` compile error | `contracts.test.ts`, `deploy-parity.test.ts` |
| ISR hot path | Cache hit returns `x-luxel-cache: hit` without render; RPS class improvement | `nav-demo-revalidate.test.ts`, phase-1 server tests |
| End-to-end gate | `luxel bench --gate` spiral + ISR factors ≤ 1.08 | `bench-json.test.ts`, WinRK integration |

**Not required in Phase 0:** unit tests for every parser token; krausest tier; luxel-core Rust stubs.

## Out of Scope

- Static subtree freeze (Phase 0.5 conditional only)
- Rust `luxel-core` SSR (Phase 1, gated)
- WASM `BundleBackend` bundler (Phase 2, gated)
- Vite-free SvelteKit fallback
- `{#each}` destructuring (`as { x, y }`)
- General filter/pipe syntax for template expressions
- Streaming compression of ISR hits
- SSG/SW/trisomorphic tier-2 bench cells (pending per existing matrix)
- krausest full table / INP / transfer tier gates (separate v1.0 ladder items)

## Further Notes

**Baseline metrics (WinRK, 8 threads, 400 conn, 15s):**

| Stack | RPS |
|-------|-----|
| luxel-spiral-ssr | ~394 |
| svelte-spiral-ssr | ~693 |
| luxel-isr | ~2,121 |
| sveltekit-isr | ~4,784 |
| luxel-ssr (counter) | ~22,900 (precompute-assisted) |

**Suggested implementation order within Phase 0:**

1. `{#each}` parse + `ForLoopIr`
2. Binding inference for list identifiers
3. Loop SSR codegen + `toFixed(2)`
4. Spiral fixture rewrite + spiral tests green
5. Document payload policy + manifest/config
6. ISR hot path + bench server warm
7. `luxel bench --gate` + WinRK verification

**References:** `CONTEXT.md` (Perf compiler track, List iteration, Document payload policy, Spiral bench fixture), ADR-0005, ADR-0004, `docs/benchmarks/fairness.md`, `docs/benchmarks/ssr-showdown.md`.
