# Krausest bench runbook

- Submodule: `vendor/js-framework-benchmark` pinned to tag **chrome148** (see `docs/benchmarks/krausest-submodule-pin.md`)
- CI Chrome: **148** family (match submodule release notes)
- Luxel app: `examples/krausest-table`
- Sync: `bun packages/luxel/scripts/sync-krausest-luxel.ts` after `luxel build`
- Skip fast path: `LUXEL_BENCH_SKIP_KRAUSEST=1`
- Gate threshold: `LUXEL_KRAUSEST_GATE_THRESHOLD` (default **1.09**)

```bash
git submodule update --init vendor/js-framework-benchmark
cd examples/krausest-table && bun run build && bun run sync:krausest
# optional smoke driver (starts upstream server + puppeteer):
LUXEL_KRAUSEST_SMOKETEST=1 LUXEL_BENCH_SKIP_INP=1 bun packages/luxel/src/cli.ts bench
```

Artifacts: `docs/benchmarks/runs/krausest-latest.jsonl` (publish after full matrix green)
