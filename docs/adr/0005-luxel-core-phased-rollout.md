# luxel-core phased rollout (perf compiler track)

**Status:** accepted

**Phase 0 context (pre-exit):** WinRK spiral tier-2 showed Luxel at ~394 RPS vs ~693 for Svelte/Solid/Vue — root cause was interpreted `DomOp` SSR (`codegenSsrDocument` walking ~2.4k ops per request), not the bundler. **Phase 0 exited 2026-06-08** — spiral ~873 RPS (factor ~0.70), ISR ~4,459 RPS (factor ~0.41); `luxel bench --gate` green. luxel-core SSR (phase 1) **unblocked**. CONTEXT locked v1.1 compile backend as esbuild → WASM swap; this ADR sequences **when** Rust enters and **what** ships first.

## Decision

1. **Dual track, strict gates** — Phase 0 (TS compiler) and luxel-core (Rust) may proceed in parallel only after Phase 0 scope is staffed; **luxel-core SSR does not start until Phase 0 exit is green**. **luxel-core bundler does not start until luxel-core SSR exit is green**.

2. **Phase 0 — TS compiled SSR (v1.0 blocker)**
   - List/`{#each}` … `{/each}` (**close required**) → emitted `for` loops; numeric `left`/`top` style bindings codegen `.toFixed(2)`.
   - **Spiral fixture (locked):** `load()` → `store.set` array; default key `${routeId}:tiles`; `{#each tiles as t}` … `{/each}`.
   - Static subtree freeze → **Phase 0.5 (conditional)** — compile-time body buffer for zero-binding templates; only if Phase 0 misses spiral 1.08 gate.
   - **Document payload (locked):** compiler-inferred omission on zero-client routes; `hydrate:*` forces client artifacts; `export const client` in SFC; config fallback when SFC omits export (**SFC wins on conflict**). **`hydration: 'never'` + `hydrate:*` → compile error.**
   - ISR hot path → cache **hit** serves stored bytes only (no render worker, no store snapshot, no re-serialize); **same Phase 0 sprint** as spiral codegen (not deferred).
   - **Exit gate:** `luxel bench --gate` — spiral + counter SSR/ISR tier-2 cells; geo-mean ≤ 1.08.

3. **Phase 1 — luxel-core SSR (Rust)**
   - Crate: `crates/luxel-core` — SFC/IR shared with TS compiler contract; SSR hot paths (spiral, list routes) in Rust.
   - Bindings: napi-rs (`@luxel/core-node`, Bun-compatible), Deno FFI (`@luxel/core-deno`); WASM for SSR optional if parity proven.
   - Integration: `renderRouteDocumentFromStore` delegates to luxel-core when manifest marks `ssr: "native"`; TS fallback unchanged.
   - **Hot-path shape (locked):** route-specific native entry points (e.g. `renderCounterBody(count)`, `renderSpiralBody(tiles)`); **reject** generic `renderBodyFromIr` JSON IR interpreter on WinRK hot paths.
   - **Ship order (locked):** counter native → spiral native inline; **`luxel-renderd` IPC service only after spiral inline native ≥ TS** (`luxel-spiral-ssr`).
   - **Merge:** default `luxel-ssr` / `luxel-spiral-ssr` adopt native when `luxel-ssr-native` ≥ `luxel-ssr-full`; keep precompute when legal; `luxel-*-native` lab rows stay in geo-mean — see `docs/benchmarks/fairness.md`.
   - **Exit gate:** no regression vs Phase 0 on spiral + counter full-render (`LUXEL_BENCH_FULL_RENDER=1`); spiral geo-mean still ≤ 1.08.

4. **Phase 2 — luxel-core bundler**
   - Ships as existing `BundleBackend` id **`wasm`** (WASM build of luxel-core bundling module).
   - esbuild remains **v1.1-rc default** until `wasm` backend passes native-host CI on Node + Deno (no Bun on PATH).
   - Native napi bundler optional acceleration behind same `BundleBackend` interface — not a separate author API.

5. **Rejected for this sequence**
   - Ground-up Rust bundler before SSR green (build-time work does not fix spiral gate).
   - Vite-free SvelteKit fork before Phase 0 + luxel-core SSR both fail exit gates (see perf analysis fallback criteria in bench docs).
   - Replacing esbuild at v1.1-rc launch (wasm backend is post-SSR).

## Implementation order

| Phase | Deliverable | Blocks |
|-------|-------------|--------|
| 0 | TS `{#each}`, SSR codegen v2, spiral fixture, ISR hot path, document payload policy | v1.0 tier-2 spiral + ISR gate |
| 0.5 | Static subtree freeze (if Phase 0 spiral gate fails) | — |
| 1 | `luxel-core` SSR + napi/FFI + manifest `ssr: "native"` | — |
| 2 | `BundleBackend` `wasm` + host CI | v1.1 default backend swap |

## Considered options

| Topic | Rejected | Why |
|-------|----------|-----|
| Rust bundler first | Ship luxel-core bundle before SSR | Spiral bottleneck is request-time render, not `Bun.build`/esbuild |
| Skip Phase 0 | Jump straight to Rust SSR | Weeks of TS codegen fixes spiral gate without native addon friction; Rust inherits compiled contract |
| Separate `@luxel/bundler-rust` API | New author-facing bundler | `BundleBackend` plug-in already exists; wasm id is the swap seam |
| Bun-only luxel-core | napi on Bun only | ADR-0003 requires Node + Deno deploy and v1.1 host parity |

## Consequences

- `packages/luxel/src/compiler/codegen-ssr.ts` and `codegen-route-runtime.ts` gain list/static codegen paths; `renderIr` JSON blob shrinks or disappears for frozen routes.
- `examples/spiral` fixture switches from generated static template to loop SFC.
- `packages/luxel/src/host/backends/types.ts` `wasm` backend gets implementation after luxel-core SSR ships — stub until then.
- Root `CONTEXT.md` gains **Perf compiler track**, **luxel-core**, **Compiled SSR codegen**.

## Related

- Root `CONTEXT.md` — perf ladder, spiral fixture, v1.1 compile backend
- [ADR-0003](./0003-multi-runtime-deploy.md) — native host, Node/Deno FFI
- [ADR-0004](./0004-compiler-server-deepening.md) — route analysis / compile split
- `packages/luxel/src/compiler/codegen-ssr.ts`
- `packages/luxel/src/host/backends/types.ts`
- `docs/benchmarks/runs/winrk-spiral-latest.md`
