## Parent

PRD: `docs/prd/krausest-tier3-bench.md` · ADR: `docs/adr/0008-krausest-benchmark-integration.md`

## What to build

Complete krausest tier-3 exit gate. Publish memory scenario results in JSONL. Enforce memory ceiling: per scenario `luxel_mb / fastest_mb ≤ 1.5`. Wire duration pass via `LUXEL_KRAUSEST_GATE_THRESHOLD` (default **1.09**); other tiers keep 1.08. Add `krausest` to `ACTIVE_GATE_TIERS` so `luxel bench --gate` enforces duration weighted geo-mean + memory ceiling in one run. Document CI Chromium version (Chrome 148 family) alongside submodule pin. Publish evidence to `docs/benchmarks/runs/krausest-latest.jsonl` (and markdown summary if runbook pattern exists).

## Acceptance criteria

- [ ] Memory scenarios emit `krausest_<scenario>_mb` (or equivalent) JSONL per framework
- [ ] Memory ceiling check: luxel / fastest ≤ 1.5 per memory scenario; failures surface in gate JSON
- [ ] `LUXEL_KRAUSEST_GATE_THRESHOLD` env (default 1.09) applies to krausest duration geo-mean only
- [ ] `krausest` added to `ACTIVE_GATE_TIERS`; `luxel bench --gate` exit 1 on krausest fail
- [ ] CI job documents Chrome 148 + submodule `chrome148` pin; reproducible runbook entry
- [ ] Published run artifact under `docs/benchmarks/runs/` for krausest latest matrix
- [ ] Gate JSON includes krausest tier status, geo_mean_factor, median_factor, memory status, frameworks executed

## Blocked by

- https://github.com/SynCROSS/luxel/issues/90
