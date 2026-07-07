# Krausest (js-framework-benchmark) tier-3 integration

**Status:** accepted

## Context

Root `CONTEXT.md` **Performance claim ladder** tier 3 requires full [js-framework-benchmark](https://krausest.github.io/js-framework-benchmark/current.html) parity at v1.0 exit: every published non-keyed duration scenario runnable under upstream conditions, Luxel + comparison class {React, Vue vdom, Vue vapor, Svelte, Solid}, geo-mean factor ≤ threshold.

Today:

- WinRK covers tier-2 server SSR (counter, spiral); INP covers tier-1 Playwright lab.
- `luxel bench --gate` evaluates krausest tier as `pending` (`krausest scenarios not wired`).
- `fixtures/micro/table` was reserved; client attach codegen supports text + click only — no client `{#each}` reconcile.
- Reimplementing the Puppeteer driver in Playwright risks diverging from public table methodology (warmup counts, CPU throttle, new-tab-per-iteration since Chrome 119, weighted geo-mean since Chrome 118).

Grilling session (2026-07-06) locked phased delivery, metric shape, gate policy, and submodule strategy.

## Decision

1. **Upstream driver as source of truth**
   - Add git submodule `vendor/js-framework-benchmark` pinned to a **release tag** (initial pin: `chrome148`, matching published results for Chrome 148).
   - `luxel bench` invokes the submodule Puppeteer/webdriver runner — no Playwright reimplementation of scenario timing rules.
   - Bump submodule pin deliberately; add a test that vendored scenario weights still match upstream driver config.

2. **Luxel implementation layout**
   - Author idiomatic Luxel table app at `examples/krausest-table/` (`.luxel` SFC, reactive signals — **idiomatic peak** per ADR-0006).
   - Production CSR build syncs bundled artifacts into `vendor/js-framework-benchmark/frameworks/non-keyed/luxel/`.
   - **Non-keyed variant first**; keyed variant deferred for upstream PR completeness.

3. **Compiler: general non-keyed client `{#each}`**
   - Extend client attach codegen to reconcile non-keyed list blocks (not krausest-only hand DOM).
   - SSR `{#each}` / `forLoop` IR already exists; client path is the new work.
   - Rejected: imperative DOM in submodule bypassing compiler (violates idiomatic peak).

4. **Bench registry seam (single integration point)**
   - Wire krausest into main `runBenchRegistry` async generator (same JSONL stream as INP/SSR).
   - Emit **raw durations**: `{ fixture: "krausest", framework, metric: "krausest_<scenario>_ms", value }`.
   - Gate computes factors internally (`duration_luxel / duration_fastest` per scenario) — same pattern as `inp_ms`, not pre-emitted `_factor` lines.
   - Skip flag: `LUXEL_BENCH_SKIP_KRAUSEST=1` (mirrors INP skip).

5. **Gate policy**
   - Krausest tier stays **out of** `ACTIVE_GATE_TIERS` until full non-keyed **duration** matrix is green for all executed comparison frameworks.
   - **Duration pass:** weighted geometric mean of Luxel scenario factors ≤ `LUXEL_KRAUSEST_GATE_THRESHOLD` (default **1.09**). Weights vendored from upstream driver (not equal-weight).
   - **Memory pass (separate):** per memory scenario, `luxel_mb / fastest_mb ≤ 1.5` (ceiling check, not in duration geo-mean).
   - Other tiers (SSR, INP, ISR, transfer) keep `BENCH_GATE_THRESHOLD` default **1.08**.
   - Denominator = frameworks **actually executed** in the run (existing fairness rule). Upstream rows: `react-hooks-v*`, `vue-v3*`, `vue-vapor-v3*`, `svelte-v*`, `solid-v*`, `luxel`.

6. **Micro fixture registry**
   - `fixtures/micro/table` **fulfilled by krausest** (`fixture: "krausest"` in JSONL).
   - `fixtures/micro/list` remains **`pending`** — separate list fixture if needed later; not in scope for krausest table work.

7. **CI browser parity**
   - CI Chromium version must match the pinned submodule release notes (initial target: **Chrome 148** family, aligned with `chrome148` tag).
   - Document pin + Chrome version in bench runbook; update together on submodule bump.

8. **Phased delivery**
   - **Slice 1:** submodule + registry runner + non-keyed client `{#each}` + `examples/krausest-table` passing upstream `create rows` and `clear rows` for Luxel only; gate tier inactive/pending.
   - **Slice 2+:** all comparison frameworks, all non-keyed duration scenarios, memory publish + ceiling, flip krausest into `ACTIVE_GATE_TIERS`.
   - **Later:** keyed variant upstream submission.

## Consequences

- `packages/bench/CONTEXT.md` and `docs/benchmarks/scorecard.md` reference this ADR for tier-3 methodology.
- `evaluateKrausestTier` refactored to compute factors from raw `krausest_*_ms` lines (and apply vendored weights + memory ceiling).
- New example app + compiler client list codegen are v1.0 exit prerequisites for tier 3.
- Submodule pin + Chrome version become part of reproducible bench runbook (`bench:krausest` or equivalent script name TBD in implementation).
- Vue vapor row comes from upstream `vue-vapor-v3*` — no Luxel-maintained Vue port in submodule.

## Rejected

- Playwright-only krausest driver without upstream parity verification.
- Equal-weight scenario geo-mean (diverges from public table).
- Global 1.09 threshold for all tiers (SSR/INP stay 1.08).
- Pre-baked `krausest_*_factor` JSONL lines as gate input (prefer raw ms + gate-side math).
- Folding `micro/list` into krausest (list fixture stays pending).
