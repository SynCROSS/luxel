## Parent

PRD: `docs/prd/krausest-tier3-bench.md` · ADR: `docs/adr/0008-krausest-benchmark-integration.md`

## What to build

Expand krausest bench to full non-keyed **duration** coverage. Run upstream driver for all comparison frameworks: luxel, react, vue-vdom (upstream `vue-v3*`), vue-vapor (upstream `vue-vapor-v3*`), svelte, solid — all non-keyed duration scenarios the public table publishes. Vendor scenario weights from upstream driver config; add test asserting weights match on submodule pin. Refactor `evaluateKrausestTier` to compute per-scenario factors and weighted geo-mean from raw `krausest_*_ms` lines (same pattern as `inp_ms`). Emit full duration JSONL matrix. Krausest tier still **not** in `ACTIVE_GATE_TIERS` until slice 3 (memory + activation).

## Acceptance criteria

- [ ] Driver runs all non-keyed duration scenarios for luxel, react, vue-vdom, vue-vapor, svelte, solid
- [ ] JSONL emits `krausest_<scenario>_ms` for every duration scenario × executed framework
- [ ] Upstream framework IDs mapped to gate labels (`vue-v3*` → `vue-vdom`, `vue-vapor-v3*` → `vue-vapor`)
- [ ] Vendored scenario weight table with test parity against upstream driver config at pinned tag
- [ ] `evaluateKrausestTier` computes weighted geo-mean from raw ms (no pre-emitted `_factor` lines required)
- [ ] Gate JSON reports `geo_mean_factor`, `median_factor`, `frameworks` for krausest tier when evaluated (tier still inactive in `ACTIVE_GATE_TIERS`)
- [ ] `pending` frameworks excluded from denominator per existing fairness rules

## Blocked by

- https://github.com/SynCROSS/luxel/issues/89
