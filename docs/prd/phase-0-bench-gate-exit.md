## Status: **closed** (2026-06-08)

Phase 0 bench gate exit **proven**. `luxel bench --gate` passes spiral SSR + nav-demo ISR tiers in one run. Fresh WinRK artifacts published. Phase 0.5 static subtree freeze **not opened** — spiral factor well under 1.08.

## Problem Statement (resolved)

Phase 0 compiler and server work (`{#each}` compiled SSR, document payload policy, ISR hot path, spiral fixture rewrite) landed in code, but v1.0 tier-2 exit was not proven until re-measurement and gate wiring completed.

**Pre-Phase-0 baselines (WinRK, 8t / 400c / 15s):**

| Stack | RPS | Gate factor (approx) |
|-------|-----|----------------------|
| luxel-spiral-ssr | ~394 | ~1.76 vs ~693 |
| luxel-isr | ~2,121 | ~2.26 vs ~4,784 |

## Solution (delivered)

Close **Phase 0 bench gate exit**: wire ISR into gate evaluation, complete ISR competitor harness, re-run WinRK for spiral and ISR, publish results, and make `luxel bench --gate` exit non-zero on failure / zero on pass.

## Post-Phase-0 results (WinRK, 8t / 400c / 10s, Windows)

| Stack | RPS | Gate factor |
|-------|-----|-------------|
| luxel-spiral-ssr | 873 | ~0.70 vs ~614 fastest |
| luxel-isr | 4,459 | ~0.41 vs SvelteKit ISR 1,809 |

`luxel bench --gate` (from `examples/counter`, `LUXEL_BENCH_SKIP_INP=1`): `bench_gate.ok: true`, `ssr` + `isr` tiers `pass`, geo-mean factor 1.0.

Artifacts: `docs/benchmarks/runs/winrk-spiral-latest.{md,json,jsonl}`, `winrk-latest.*`.

## User Stories

1. As a Luxel maintainer, I want `luxel bench --gate` to evaluate **spiral tier-2 SSR** (`counter` + `spiral` fixtures, `ssr_throughput_rps`), so that the Platformatic workload gate is enforced in CI.
2. As a Luxel maintainer, I want `luxel bench --gate` to evaluate **nav-demo ISR** (`isr_throughput_rps`), so that cache-hit throughput is gated alongside spiral.
3. As a Luxel maintainer, I want ISR gate comparison to include **SvelteKit ISR** when built, so that the fastest denominator is fair per `docs/benchmarks/winrk.md`.
4. As a Luxel maintainer, I want `pending` competitor rows excluded from gate denominators, so that missing harnesses do not fake a pass.
5. As a Luxel maintainer, I want `luxel bench --gate` to exit code **1** when any active tier fails, so that CI blocks merges on perf regression.
6. As a Luxel maintainer, I want fresh WinRK results written to `docs/benchmarks/runs/` (`winrk-spiral-latest`, ISR row in counter matrix), so that published evidence matches the gated run.
7. As a benchmark reader, I want spiral RPS **re-measured** after `{#each}` codegen and document payload policy, so that improvement from Phase 0 slices 1–4 is visible.
8. As a Luxel maintainer, I want ISR bench server **warmed before measurement** (already in `createIsrBenchServer`), so that WinRK and registry rows measure sustained cache hits within 1s TTL.
9. As a Luxel maintainer, I want gate JSON to report per-tier `geo_mean_factor`, `median_factor`, and `frameworks`, so that failures are diagnosable from CI logs.
10. As a Luxel maintainer, I want spiral gate to use only **executed** frameworks {React, Vue vdom, Vue vapor, Solid, Svelte} per `COMPARISON_FRAMEWORKS`, so that fairness rules in CONTEXT.md hold.
11. As a Luxel maintainer, I want `ssr_html_bytes` / `isr_html_bytes` published beside RPS, so that transfer interpretation stays honest after payload policy.
12. As a Luxel maintainer, I want Phase 0 exit documented in CONTEXT or ADR when gate passes, so that luxel-core Rust work can start per ADR-0005.
13. As a Luxel maintainer, I want a **Phase 0.5 issue** filed automatically (or via checklist) if spiral factor still > 1.08 after re-measurement, so that static subtree freeze is conditional not speculative.
14. As an AFK agent, I want slice acceptance criteria as a checklist in the issue, so that grab work without re-reading the whole Phase 0 PRD.
15. As a Luxel maintainer, I want existing ISR correctness tests (`isr.test.ts`, `nav-demo-revalidate.test.ts`) to stay green while gate wiring lands, so that hot path does not regress for correctness.

## Implementation Decisions

### Modules built or modified

**Bench gate evaluator** — ISR tier (`evaluateIsrTier`) on `nav-demo` / `isr_throughput_rps`; `ACTIVE_GATE_TIERS = ["ssr", "isr"]`; `pending` competitors excluded from denominators.

**Bench registry** — SvelteKit ISR harness via `runSvelteKitIsrBench`; Luxel row via `runIsrBench`.

**WinRK artifact publisher** — `winrk-spiral-latest` + `winrk-latest` under `docs/benchmarks/runs/`.

**CLI exit contract** — `runBenchCommand` returns 1 on `gate.ok === false` when `--gate` passed.

**E2E test** — `packages/luxel/test/bench-gate-exit.test.ts`.

### Architectural decisions (locked)

- Phase 0 exit = `luxel bench --gate` green in **one run**; competitors must be **executed**, not pending.
- Spiral + ISR are separate cells; geo-mean combines them for SSR/ISR throughput gate (align with parent #51 exit wording).
- Phase 0.5 static subtree freeze **out of scope** — spiral passed after honest post-Phase-0 measurement.
- No Rust luxel-core work in this slice (ADR-0005); luxel-core SSR **unblocked** by Phase 0 exit.

### Already shipped (do not re-implement)

- `{#each}` compiled SSR, spiral loop fixture, document payload policy, manifest `shipSidecars`, ISR tiered memory cache, render-worker skip on cache hit, `createIsrBenchServer` warm, registry Luxel `isr_throughput_rps`.

### API contracts

- Bench JSON lines: `{ fixture: "nav-demo", framework: "luxel"|"svelte", metric: "isr_throughput_rps", value: number }`.
- Gate JSON: `{ type: "bench_gate", ok: boolean, tiers: [...] }` with ISR tier status `pass|fail|pending`.
- `luxel bench --gate` exit codes: 0 pass, 1 fail.

## Testing Decisions

| Module | Test focus | Status |
|--------|------------|--------|
| Gate ISR tier | Pass/fail/pending from synthetic rows | `bench-gate.test.ts` |
| Registry ISR | luxel + svelte `isr_throughput_rps` | `isr-bench.test.ts` |
| CLI `--gate` E2E | Exit 0 with spiral + ISR | `bench-gate-exit.test.ts` |
| ISR correctness | Cache hit skips worker | `isr.test.ts` |

## Out of Scope

- Static subtree freeze (Phase 0.5 — **not needed**)
- Rust luxel-core SSR / WASM bundler (next track per ADR-0005)
- krausest / INP / transfer tier gates
- SSG / SW tier-2 cells

## Exit checklist (#56)

- [x] Re-run WinRK spiral after Phase 0 codegen + payload policy
- [x] Wire `evaluateIsrTier` + activate when competitor executes
- [x] Wire `sveltekit-isr` in bench registry
- [x] `luxel bench --gate` passes both cells
- [x] Publish `docs/benchmarks/runs/*-latest`
- [x] Document Phase 0 exit in CONTEXT.md (Phase 0.5 not opened)

**Parent:** #51 · **References:** ADR-0005, `docs/benchmarks/fairness.md`, `docs/benchmarks/winrk.md`, CONTEXT.md Perf compiler track
