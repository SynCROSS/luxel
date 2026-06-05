# PRD: Luxel architecture roadmap (phase 1 → v1.0 → v1.1)

**Source:** Grill session on `docs/architecture.md` + root `CONTEXT.md` (2026-06-04)  
**ADRs:** [0001](../adr/0001-resource-store-phase-1.md), [0002](../adr/0002-response-compression.md), [0003](../adr/0003-multi-runtime-deploy.md)  
**Tracker:** [GitHub #34](https://github.com/SynCROSS/luxel/issues/34)  
**Child slices:** #35–#50 (index on [#34](https://github.com/SynCROSS/luxel/issues/34))

## Problem Statement

Luxel’s compact architecture doc describes a Vite-free, trisomorphic, streaming framework with a resource store, multi-runtime deploy, and a broad v1 surface. The **prototype slice is delivered**, and **phase B deploy** is largely implemented, but the repo lacks a single execution contract for everything between today and **v1.0** / **v1.1**. Without that contract, agents and humans re-litigate ordering (resource store vs SW, toolchain parity vs app features, benchmark scope) and drift from agreed glossary terms (`Resource load pipeline`, `luxel-data` v2, adaptive navigation).

## Solution

Execute in locked **horizons**:

1. **A — Post-prototype phase 1:** Resource store as sole render truth, `luxel-data` v2, template binding map, client navigation on `examples/nav-demo`, counter migration in one cutover PR.
2. **B — Phase B deploy exit:** Node + Deno production smoke for counter and nav-demo; **Deno required in CI** (no permanent skip).
3. **C — Architecture §12 middle:** Threat model outline, benchmark skeleton, trisomorphic SW with adaptive nav, then v1.0 feature pillars.
4. **D — v1.0 / v1.1:** **v1.0** = app-framework complete on Bun toolchain with Node/Deno **deploy**; **v1.1** = full Bun/Node/Deno **toolchain** parity + plugin WASM sandbox.

All domain terms match root `CONTEXT.md`.

## User Stories

### Horizon A — Resource store phase 1

1. As a route author, I want `load()` and `prefetch()` to write only to the **resource store** with no return value, so that render has a single source of truth.
2. As a route author, I want the framework to **project** store entries into template bindings via a **template binding map**, so that I do not hand-return view models from `load`.
3. As a Luxel maintainer, I want the **generated manifest** to include the template binding map, so that SSR, hydration, and client nav share the same binding semantics.
4. As a developer, I want `luxel-data` to use a **v2 envelope** `{ version: 2, resources }` without duplicate flat bindings in JSON, so that hydration stays inert and cache-friendly.
5. As a developer, I want **client navigation** on opt-in `data-luxel-nav` links via full HTML fetch, DOMParser main swap, `pushState`, and generation-based store merge, so that phase 1 reuses the SSR pipeline without a JSON nav protocol.
6. As a developer, I want `popstate` to perform a full document navigation in phase 1, so that back/forward stays correct before client-managed history exists.
7. As a route author, I want `prefetch` to run on the server only (`prefetch` → `load` → render) at phase-1 exit, so that warm-up is proven without hover or prefetch endpoints.
8. As a Luxel maintainer, I want **examples/nav-demo** to prove two-route client nav and tag revalidation, so that counter remains the prototype regression fixture.
9. As a Luxel maintainer, I want **examples/counter** migrated to v2 and void `load` in the same PR as contract golden updates, so that main never carries red goldens.
10. As a maintainer, I want Playwright coverage for nav-demo `/` ↔ `/detail` without full reload on forward nav, so that client nav is browser-verified.

### Horizon B — Deploy exit

11. As an operator, I want `luxel build` artifacts to run on Node and Deno via `start-node.mjs` / `start-deno.mjs`, so that production does not require Bun on the host.
12. As a maintainer, I want CI to run **Deno deploy integration tests** for built counter and nav-demo dist, so that phase B cannot regress silently on Windows-style PATH gaps.
13. As a maintainer, I want the deploy matrix doc to reflect v1.0 vs v1.1 toolchain split, so that runtime expectations are honest.

### Horizon C1 — Threat model

14. As a security reviewer, I want `docs/threat-model.md` as **surface tables** (SFC compile, SSR HTML, `luxel-data` v2, client nav, deploy/compression, server-fn stub), so that mitigations map to ADRs and status is trackable.

### Horizon C2 — Benchmark skeleton

15. As a maintainer, I want a **fixture registry** under micro fixtures (counter, list, table) with only counter wired initially, so that §11 layout exists early.
16. As a maintainer, I want `luxel bench` to emit **JSON lines** (`fixture`, `metric`, `value`), so that a future scorecard can consume results mechanically.

### Horizon C3 — Trisomorphic SW

17. As a developer, I want a service worker on **nav-demo** that caches full HTML keyed by route and resource generation from v2 sidecars, so that trisomorphic rendering is proven without Render IR in the worker.
18. As a developer, I want **adaptive navigation** (first visit MPA/SSR; later SW-cached HTML when valid; else document fallback to network SSR), so that behavior matches architecture §6.
19. As a maintainer, I want per-route `offline:` policy deferred until after this slice is green, so that C3 stays focused.

### Horizon C4a–h — v1.0 features

20. As a route author, I want **SSG** via `luxel build` writing static HTML under `dist/static/` with hybrid `prerender` inference and override, so that static routes are CDN-friendly.
21. As a route author, I want **ISR** with a filesystem HTML cache adapter, route `revalidate` seconds, and resource-tag invalidation, so that time- and mutation-driven regen both work.
22. As an app author, I want **auth** with opaque session cookies, a session store adapter, and SQLite shipped at v1.0, so that local and small deploys work without Postgres.
23. As an app author, I want a **reference auth provider** at v1.0 and OAuth providers later, so that adapter shape is proven before Google/GitHub work.
24. As an app author, I want **server functions** via HTML forms and JSON RPC sharing one manifest ID space, with Origin checks and session-bound CSRF tokens, so that mutations are hardened by default.
25. As a developer, I want hybrid **`offline:`** inference with author override after SW is stable, so that trisomorphic offline policies match render mode.
26. As a contributor, I want **examples/docs-site** dogfooding Luxel, so that docs prove SSG/ISR/auth/server fns/deploy together.
27. As a maintainer, I want the **full §11 competitor benchmark matrix** published at v1.0, so that Luxel claims are evidence-backed.
28. As an adopter, I want a **strict stability matrix** (frozen diagnostic codes, versioned manifest schema, major-only breaking output with codemods), so that upgrades are predictable.

### Horizon v1.1

29. As a contributor, I want `luxel dev` / `build` / `bench` on Node and Deno, so that toolchain parity matches ADR phase A.
30. As a maintainer, I want **plugin WASM sandbox** at v1.1, so that v1.0 is not blocked on plugin isolation.

## Implementation Decisions

### Ordering (locked)

`A` → `B` → `C1` → `C2` → `C3` → `C4a` SSG → `C4b` ISR → `C4c` auth → `C4d` server fns → `C4e` offline → `C4f` docs site → `C4g` scorecard → `C4h` stability matrix → **v1.0** → **v1.1** toolchain + plugins.

### Deep modules (build or extend)

| Module | Interface | Notes |
|--------|-----------|-------|
| Resource store | `set` / `get` / tags / generations / `snapshot` | Server + client; merge on nav |
| Resource snapshot codec | v2 envelope read/write | Same `id="luxel-data"` |
| Template binding projector | manifest map + snapshot → flat template data | SSR + hydrate + client nav |
| Route data pipeline | `prefetch` → `load` → render-from-store | `void` loaders |
| Client nav runtime | delegated `data-luxel-nav`, fetch, parse, merge, swap main, re-hydrate | `popstate` → full reload in phase 1 |
| Compiler resource analysis | binding map; optional default keys post-exit | Keys may follow phase-1 |
| HTML cache adapter | FS impl + interface; Redis stub optional | ISR |
| Render mode resolver | hybrid `prerender`, `revalidate`, `offline` | Manifest records modes |
| Session store adapter | SQLite v1.0; Postgres later | Opaque cookie |
| Auth provider adapter | reference provider v1.0; OAuth later | |
| Server function gateway | manifest ID, schema, CSRF, form + RPC | JSON-safe payloads only |
| Service worker shell | install, precache, fetch, adaptive nav | nav-demo first; no Render IR in worker |
| Benchmark registry | fixtures + JSON line reporter | C2 counter only; C4g full matrix |
| Stability / manifest schema | versioned manifest + frozen diagnostics | C4h |

### Phase 1 technical contracts

- **Load pipeline:** `load` / `prefetch` return `void`; render never reads return values.
- **Sidecar:** `{ "version": 2, "resources": ResourceSnapshot }` only.
- **Client nav:** opt-in attribute; generation-based upsert; no JSON nav protocol.
- **Prefetch:** server SSR ordering only at exit.

### v1.0 technical contracts (C4)

- **SSG:** build-time HTML in `dist/static/`; hybrid `prerender`.
- **ISR:** FS HTML cache adapter; `revalidate` seconds + resource tag/generation invalidation.
- **Auth:** SQLite session adapter + reference provider; Postgres and OAuth post-v1.0.
- **Server fns:** forms + RPC; `Origin`/`Referer` + `X-Luxel-CSRF` / hidden field.
- **Offline:** hybrid defaults on SW after C3.
- **Docs:** `examples/docs-site` workspace app.
- **Bench:** full competitor matrix on micro + app fixtures (weights documented when published).
- **Stability:** strict semver on manifest, diagnostics, public server/CLI exports.

### Runtime / release

- **v1.0:** Bun-only toolchain; Node/Deno deploy in scope (ADR-0003 amended).
- **v1.1:** toolchain parity on Bun, Node, Deno; plugin WASM sandbox.
- **Edge adapters:** not v1.0.

## Testing Decisions

- **Principle:** assert public contracts (HTML sidecars, manifest shape, HTTP status, Playwright behavior), not private IR or store internals.
- **Phase 1:** extend contract goldens for v2; nav-demo integration + Playwright forward nav; counter regression unchanged in role.
- **Phase B:** Node + Deno spawn tests on built dist for counter and nav-demo; CI installs Deno.
- **ISR/SSG:** integration tests for static file serve, TTL expiry, tag invalidation regen.
- **Auth/server fns:** route tests for session cookie, CSRF rejection, form and RPC success paths.
- **SW:** controlled cache hit/miss (Playwright service worker or harness).
- **Bench:** JSON line schema tests; v1.0 competitor runs gated in CI where feasible.
- **Prior art:** `packages/luxel/test/nav-demo-revalidate.test.ts`, `node-deploy.test.ts`, `deno-deploy.test.ts`, `resource-store.test.ts`, `hydrate.test.ts`.

## Out of Scope

- Qwik-style resumability (post-1.0).
- Edge / Cloudflare Workers adapters at v1.0.
- Plugin WASM sandbox at v1.0 (v1.1).
- JSON partial navigation protocol (phase 1).
- Client `revalidateTag` (phase 1).
- Client hover / dedicated prefetch endpoints (phase 1).
- Postgres session adapter and OAuth at v1.0 (post-v1.0).
- Redis/KV HTML cache required at v1.0 (interface + FS only).
- Full SFC directive grammar spec (architecture §14 open).
- Fine-grained HMR (reload policy remains until later).
- Code routes (API/middleware) unless separately scheduled.
- Worker pools / IPC (same-process render worker until later).
- npm compression codec fallbacks (ADR-0002 follow-up).

## Further Notes

- **Existing PRD:** [post-prototype-resource-store.md](./post-prototype-resource-store.md) (#13) covers phase 1–2 at issue granularity; this PRD is the **umbrella** execution order through v1.1.
- **Compression:** ADR-0002 slice largely shipped (#27); not a horizon gate.
- **Flagged:** C2 ships counter-only bench; C4g still requires full competitor matrix before v1.0 tag — plan runner work between C2 and v1.0.
- **Intentionally ungrilled (defer):** benchmark scorecard weights, exact directive grammar, worker pool scheduling, general data-access ORM layer beyond session/auth adapters.
