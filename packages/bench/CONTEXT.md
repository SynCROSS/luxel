# Benchmarks

Luxel micro-benchmarks and future competitor scorecard fixtures.

## Horizon C2 skeleton

- **Registry:** `fixtures/micro/{counter,list,table}` — counter runnable; list/table reserved (`pending`).
- **CLI:** `luxel bench` emits JSON lines: `{ "fixture", "metric", "value" }`.
- **Metrics (counter):** SSR throughput (req/s), client JS bytes.
- **Competitor runners:** wired in `@luxel/luxel` bench registry (counter SSR); WinRK harness uses `@luxel/luxel/bench` public seam.
- **Deferred until v1.0 (C4g):** weighted scorecard; app fixtures (blog/dashboard/ecommerce/auth); server-stress fixtures; full §11 matrix exit. **v1.0 exit:** full §11 matrix per root `CONTEXT.md` **Benchmark scorecard (C4g)**.
- **Idiomatic peak rows:** CSR + SSR competitors use reactive state at framework fastest idioms; one shared component per stack (CSR build + SSR import) — see root `CONTEXT.md` **Idiomatic peak benchmark row** and `docs/benchmarks/fairness.md`.
- **Source of truth:** competitor components + SSR render fns in `@luxel/luxel/bench` (`packages/luxel/src/bench/competitors/`). WinRK servers import bench seam; `packages/bench/competitors/` = CSR Vite dist builds only. CSR build sync uses `competitorSource()` from `@luxel/luxel/bench` — no relative `../../luxel` paths.
