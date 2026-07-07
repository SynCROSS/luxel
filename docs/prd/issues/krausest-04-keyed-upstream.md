## Parent

PRD: `docs/prd/krausest-tier3-bench.md` · ADR: `docs/adr/0008-krausest-benchmark-integration.md`

## What to build

Optional post-v1.0-gate work: keyed krausest variant. Extend client attach codegen for keyed `{#each}` reconcile (key → DOM node association). Add keyed Luxel impl under submodule `frameworks/keyed/luxel/`. Pass upstream driver keyed scenarios. Prepare upstream PR to krausest/js-framework-benchmark for public table inclusion. **Not required for v1.0 tier-3 gate** (non-keyed only per ADR-0008).

## Acceptance criteria

- [ ] Keyed client `{#each}` attach codegen with tests (insert/delete/reorder preserves correct DOM association)
- [ ] Keyed `examples/krausest-table` variant (or compile flag) syncs to submodule keyed luxel directory
- [ ] Upstream keyed driver scenarios pass for Luxel
- [ ] Upstream submission checklist documented (fork PR steps, impl naming, build instructions)
- [ ] v1.0 `ACTIVE_GATE_TIERS` unchanged — keyed is publish/PR track, not merge gate unless explicitly promoted later

## Blocked by

- https://github.com/SynCROSS/luxel/issues/91
