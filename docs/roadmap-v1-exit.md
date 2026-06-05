# Roadmap v1 exit checklist

Parent: [luxel-architecture-roadmap-v1](../prd/luxel-architecture-roadmap-v1.md) · slices **#35–#50**

## Horizon A — phase-1 server + client nav

| Slice | Exit | Status |
|-------|------|--------|
| #35 resource store | `luxel-data` v2, void load/prefetch, render-from-store | **done** |
| #38 client nav | `data-luxel-nav`, fetch swap, generation merge, Playwright green | **done** |

## Horizon B — CI / deploy

| Slice | Exit | Status |
|-------|------|--------|
| #39 CI matrix | bun test, Deno, Playwright, toolchain-host/smoke | **done** |

## Horizon C — threat, bench, SW, v1.0 features

| Slice | Exit | Status |
|-------|------|--------|
| #36 threat model | `docs/` threat model + architecture link | **done** |
| #37 bench JSON | `luxel bench` lines, counter fixture, `LUXEL_BENCH_OUT` | **done** |
| #42 SW | `/luxel-sw.js`, offline policies, unit + e2e | **done** |
| #40 SSG | `prerender`, static dist, tests | **done** |
| #41 ISR | html cache adapter, revalidate, tag bust | **done** |
| #43 auth | dev provider, sessions, `/account` | **done** |
| #44 server fns | `POST /__luxel/fn`, CSRF, nav-demo echo | **done** |
| #45 offline | manifest `offline`, SW inference, tests | **done** |
| #46 docs-site | example app + integration test | **done** |
| #48 scorecard | luxel/static-http/fastify/react/vue runners; docs-site bench; list/table pending | **partial** |
| #47 stability | matrix doc + manifest v2 contract tests | **done** (HITL sign-off pending) |

## Horizon D — v1.1 toolchain + plugins

| Slice | Exit | Status |
|-------|------|--------|
| #49 native toolchain | Bun bridge **removed**; esbuild backend → WASM; **Node+Deno native host** `dev`/`build`/`bench`/`serve`; prebuilt `dist/host/run.mjs` on publish | **done (rc)** |
| #50 plugins | wasm sandbox, add sample, network import policy + tests; HITL sign-off pending | **partial** |

## Deferred (honest)

- **list/table** bench fixtures
- **solid/svelte** runners when deps compile in CI (registry emits `pending` if unavailable)
- **Native luxel on Node/Deno** without Bun on PATH
- **Maintainer HITL** for stability matrix + plugin sandbox before v1.0 tag

## Verify locally

```bash
bun test packages/luxel/test
CI=1 bunx playwright test
LUXEL_BENCH_OUT=docs/benchmarks/runs/latest.jsonl bun packages/luxel/src/cli.ts bench
```
