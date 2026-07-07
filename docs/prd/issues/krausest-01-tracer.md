## Parent

PRD: `docs/prd/krausest-tier3-bench.md` · ADR: `docs/adr/0008-krausest-benchmark-integration.md`

## What to build

Thin vertical tracer for krausest tier 3. Pin upstream js-framework-benchmark submodule (`chrome148`). Implement general non-keyed client `{#each}` attach codegen (signal-driven list reconcile). Author idiomatic Luxel table app at `examples/krausest-table/` matching krausest non-keyed DOM contract. Build syncs CSR bundle into submodule `frameworks/non-keyed/luxel/`. Wire krausest into main `luxel bench` registry: invoke upstream Puppeteer driver for Luxel only, scenarios **create rows** and **clear rows**, emit raw `krausest_<scenario>_ms` JSONL lines. Add `LUXEL_BENCH_SKIP_KRAUSEST=1` skip flag. Mark `fixtures/micro/table` fulfilled by krausest; keep `list` pending. Krausest gate tier stays inactive/pending — no merge gate yet.

## Acceptance criteria

- [ ] Git submodule `vendor/js-framework-benchmark` pinned to release tag `chrome148` with documented bump notes
- [ ] Non-keyed client `{#each}` attach codegen with integration tests (signal list mutation → correct DOM)
- [ ] `examples/krausest-table` builds and syncs bundle into submodule luxel framework directory
- [ ] Upstream driver passes **create rows** and **clear rows** for Luxel non-keyed impl
- [ ] `luxel bench` emits `{"fixture":"krausest","framework":"luxel","metric":"krausest_create_rows_ms"|"krausest_clear_rows_ms","value":...}` JSONL lines
- [ ] `LUXEL_BENCH_SKIP_KRAUSEST=1` skips krausest runner (fast CI path)
- [ ] DOM contract test covers required krausest buttons/table structure without full Puppeteer in unit tests
- [ ] `luxel bench --gate` krausest tier remains inactive/pending (not in `ACTIVE_GATE_TIERS`)

## Blocked by

None — can start immediately
