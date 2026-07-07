# Krausest tier-3 benchmark integration

## Problem Statement

Luxel v1.0 exit requires tier 3 of the **Performance claim ladder**: full [js-framework-benchmark](https://krausest.github.io/js-framework-benchmark/current.html) table parity under published krausest conditions, compared fairly against {React, Vue vdom, Vue vapor, Svelte, Solid}. Today the bench harness covers SSR throughput (WinRK), INP (Playwright), and ISR — but no client table scenarios run, no Luxel krausest implementation exists, and the compiler cannot reconcile client-side `{#each}` lists. `luxel bench --gate` reports the krausest tier as pending, blocking the four-tier v1.0 performance exit.

## Solution

Integrate the upstream js-framework-benchmark repo as a pinned git submodule, build an idiomatic Luxel table app, extend the compiler for non-keyed client list reconciliation, and wire results into the existing `luxel bench` registry and gate evaluator. Phased delivery: slice 1 proves two scenarios end-to-end for Luxel; later slices widen frameworks and scenarios, then activate the krausest gate with a krausest-specific threshold and memory ceiling.

## User Stories

1. As a Luxel maintainer, I want `vendor/js-framework-benchmark` as a pinned git submodule, so that scenario timing rules match the public krausest table.
2. As a Luxel maintainer, I want the submodule pinned to release tag `chrome148` initially, so that CI results are reproducible and comparable to published Chrome 148 results.
3. As a Luxel maintainer, I want a documented bump process for the submodule pin, so that krausest upgrades are deliberate and tested.
4. As a Luxel author, I want a table demo app at `examples/krausest-table/` using idiomatic `.luxel` SFCs and signals, so that the krausest row reflects real Luxel authoring patterns.
5. As a Luxel maintainer, I want a build step that syncs the Luxel CSR bundle into the submodule non-keyed luxel framework directory, so that the upstream driver can load Luxel like other frameworks.
6. As a Luxel maintainer, I want general non-keyed client `{#each}` codegen in the attach module, so that list reconciliation works beyond krausest-only hacks.
7. As a Luxel maintainer, I want slice 1 to pass upstream `create rows` and `clear rows` scenarios for Luxel, so that the highest-risk compiler and DOM contract gaps are proven early.
8. As a Luxel maintainer, I want krausest wired into main `runBenchRegistry`, so that one `luxel bench` run produces one JSONL stream for all tiers.
9. As a Luxel maintainer, I want raw `krausest_<scenario>_ms` JSONL lines per framework, so that gate math stays consistent with INP (`inp_ms`) and remains auditable.
10. As a Luxel maintainer, I want `evaluateKrausestTier` to compute duration factors and weighted geo-mean from raw ms lines, so that pre-computed factor lines are not required.
11. As a Luxel maintainer, I want scenario weights vendored from the upstream driver config, so that Luxel gate geo-mean matches the public table weighting model.
12. As a Luxel maintainer, I want a test that asserts vendored weights match upstream on submodule bump, so that pin updates cannot silently drift weighting.
13. As a Luxel maintainer, I want krausest duration gate threshold via `LUXEL_KRAUSEST_GATE_THRESHOLD` (default 1.09), so that tier 3 threshold is independent of SSR/INP 1.08.
14. As a Luxel maintainer, I want a separate memory ceiling check (`luxel_mb / fastest_mb ≤ 1.5` per memory scenario), so that memory regressions are caught without polluting duration geo-mean.
15. As a Luxel maintainer, I want krausest tier excluded from `ACTIVE_GATE_TIERS` until the full non-keyed duration matrix is green, so that slice work does not block unrelated merges.
16. As a Luxel maintainer, I want `LUXEL_BENCH_SKIP_KRAUSEST=1` for fast unit runs, so that CI/dev can skip Puppeteer krausest like INP skip.
17. As a benchmark reader, I want comparison rows for React, Vue vdom, Vue vapor, Svelte, and Solid from upstream submodule implementations, so that Luxel is not compared to hand-tuned stubs.
18. As a Luxel maintainer, I want upstream `vue-v3*` mapped to `vue-vdom` and `vue-vapor-v3*` mapped to `vue-vapor` in JSONL, so that gate labels align with SSR comparison class naming.
19. As a Luxel maintainer, I want `fixtures/micro/table` marked fulfilled by krausest, so that the micro fixture registry matches reality.
20. As a Luxel maintainer, I want `fixtures/micro/list` to remain pending, so that a future list micro fixture is not conflated with krausest table work.
21. As a Luxel maintainer, I want CI Chromium version documented alongside the submodule pin, so that driver parity matches release notes (Chrome 148 initially).
22. As a Luxel maintainer, I want slice 2 to run all non-keyed duration scenarios for all comparison frameworks, so that tier 3 coverage matches the public table duration section.
23. As a Luxel maintainer, I want memory scenarios published in JSONL even before gate enforcement, so that dashboard readers see memory rows honestly.
24. As a Luxel maintainer, I want to flip krausest into `ACTIVE_GATE_TIERS` only after slice 2 is green, so that v1.0 tier-3 exit is meaningful.
25. As a Luxel maintainer, I want non-keyed variant first and keyed variant deferred, so that scope matches current official table emphasis and reduces initial reconcile complexity.
26. As an upstream contributor, I want a path to submit Luxel to krausest later (keyed + non-keyed), so that Luxel can appear on the public results page.
27. As a Luxel maintainer, I want krausest DOM contract tests (buttons, table structure, selectors expected by upstream driver), so that scenario failures are caught without full Puppeteer in unit tests where possible.
28. As an AFK agent, I want slice 1 acceptance criteria as a checklist, so that work can proceed without re-reading the full grilling transcript.
29. As a Luxel maintainer, I want gate JSON to report krausest `geo_mean_factor`, `median_factor`, memory ceiling status, and frameworks executed, so that CI failures are diagnosable.
30. As a benchmark reader, I want published runs under `docs/benchmarks/runs/` for krausest, so that evidence matches gate claims.

## Implementation Decisions

### Testing seam (single integration point)

All external behavior is exercised through the existing **`luxel bench` registry + gate** seam (`@luxel/luxel/bench`), same as INP and SSR tiers. No separate parallel scorecard pipeline.

```
luxel bench
  → build examples/krausest-table + sync to submodule
  → invoke upstream webdriver runner (framework filter)
  → parse durations → emit krausest_*_ms JSONL
  → evaluateKrausestTier (when active)
```

Confirm this seam matches expectations before implementation: one JSONL stream, one gate evaluator, submodule as driver only.

### Modules built or modified

**Git submodule** — `vendor/js-framework-benchmark` at tag `chrome148`; documented bump procedure.

**Example app** — `examples/krausest-table/`: idiomatic Luxel table SFC implementing krausest non-keyed DOM contract (action buttons, 1000-row table, selection state).

**Compiler client attach** — non-keyed `{#each}` / `forLoop` reconciliation in attach module codegen; signal-driven list updates on the client.

**Bench krausest runner** — registry module: build/sync Luxel bundle, spawn upstream driver with framework/scenario filters, parse output to `BenchJsonLine` rows.

**Bench gate evaluator** — refactor `evaluateKrausestTier`: raw `krausest_*_ms` → per-scenario factors → weighted geo-mean (vendored weights) + memory ceiling 1.5×; read `LUXEL_KRAUSEST_GATE_THRESHOLD`.

**Vendored weights module** — parse/copy upstream scenario weights; test sync on pin bump.

**Micro fixture registry** — table fulfilled → krausest; list stays pending.

**Bench CONTEXT / scorecard docs** — cross-reference ADR-0008.

### Architectural decisions (locked — ADR-0008)

- Upstream Puppeteer driver; no Playwright reimpl for krausest scenarios.
- Non-keyed first; keyed later.
- Raw ms metrics; gate-side factor math.
- Krausest threshold 1.09 via env; other tiers 1.08.
- Duration weighted geo-mean + separate memory ceiling.
- Gate inactive until full non-keyed duration matrix.
- Submodule pin `chrome148`; CI Chrome 148 family.
- Vue rows from upstream only (vdom + vapor).

### Slice 1 scope (first PR)

1. Submodule add + pin script/docs.
2. Client non-keyed `{#each}` attach codegen + unit/integration tests.
3. `examples/krausest-table` + build sync into submodule.
4. Registry runner: Luxel-only, scenarios `create rows` + `clear rows`.
5. JSONL emission; krausest tier `pending`/`inactive`.

### Slice 2 scope

1. Framework filter: luxel, react, vue-vdom, vue-vapor, svelte, solid.
2. All non-keyed duration scenarios.
3. Memory scenarios publish + ceiling check.
4. Add `krausest` to `ACTIVE_GATE_TIERS`.
5. CI job with Chrome 148 + submodule pin.

### API contracts

**Bench JSONL (raw):**

```json
{"fixture":"krausest","framework":"luxel","metric":"krausest_create_rows_ms","value":42.5}
{"fixture":"krausest","framework":"react","metric":"krausest_create_rows_ms","value":38.1}
```

**Gate JSON (krausest tier when active):**

```json
{
  "tier": "krausest",
  "status": "pass",
  "threshold": 1.09,
  "geo_mean_factor": 1.04,
  "median_factor": 1.02,
  "frameworks": ["luxel", "react", "vue-vdom", "vue-vapor", "svelte", "solid"]
}
```

**Env:**

- `LUXEL_KRAUSEST_GATE_THRESHOLD` — default `1.09`
- `LUXEL_BENCH_SKIP_KRAUSEST=1` — skip runner
- `BENCH_GATE_THRESHOLD` — unchanged default `1.08` for SSR/INP/ISR/transfer

## Testing Decisions

**Principle:** Test external behavior at the bench seam — JSONL shape, gate pass/fail, scenario DOM contract — not internal compiler opcode lists unless via compiled output snapshots.

**Modules tested:**

- Gate evaluator: factor math, weighted geo-mean, memory ceiling, pending when tier inactive (prior art: `gate.ts` tests, `winrk-geo-gate.test.ts`).
- Vendored weights: parity test vs upstream config on pin (prior art: registry truth tests).
- Client `{#each}` attach: integration test — mutate signal list → DOM row count/content matches (prior art: compiler SSR `{#each}` tests, INP hydration tests).
- Krausest table app: DOM contract test — required buttons/labels present after hydrate (prior art: `counter-contract.ts` pattern).
- Slice 1 optional smoke: run upstream driver for two scenarios locally (manual/CI nightly if too slow for unit CI).

**Skip in unit CI:** full multi-framework Puppeteer matrix unless designated krausest CI job; use `LUXEL_BENCH_SKIP_KRAUSEST=1` in fast paths.

## Out of Scope

- Keyed krausest variant (deferred post non-keyed gate green).
- Playwright reimplementation of krausest driver.
- `fixtures/micro/list` implementation.
- Vue/React/Svelte/Solid custom impls in monorepo (upstream submodule only).
- WinRK / SSR changes for krausest.
- Global bump of all gate thresholds to 1.09.
- Weighted scorecard final weights (draft in scorecard.md until all tiers land).
- luxel-core Rust client list paths.
- Publishing to official krausest.github.io (separate upstream PR after local gate green).

## Further Notes

- ADR: `docs/adr/0008-krausest-benchmark-integration.md`
- Bench glossary: `packages/bench/CONTEXT.md` krausest bullet
- Idiomatic peak applies to Luxel row per ADR-0006 — no hand-DOM shortcut.
- Slice 1 checklist for AFK agents:
  - [ ] Submodule pinned `chrome148`
  - [ ] Client non-keyed `{#each}` tests green
  - [ ] `examples/krausest-table` builds + syncs
  - [ ] `create rows` + `clear rows` pass upstream driver for Luxel
  - [ ] JSONL lines emitted; gate tier not active
