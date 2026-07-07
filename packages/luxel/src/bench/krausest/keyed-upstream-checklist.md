# Keyed krausest upstream submission (#92)

Non-keyed gate path unchanged. Keyed Luxel uses `{#each rows as row (row.id)}` client attach + `frameworks/keyed/luxel/` sync.

## Checklist

1. Build keyed variant: `examples/krausest-table` with keyed `{#each}` → sync to `vendor/js-framework-benchmark/frameworks/keyed/luxel/`.
2. Run upstream driver: `npm run bench -- keyed/luxel` from submodule root (Chrome **148** family).
3. Fork [krausest/js-framework-benchmark](https://github.com/krausest/js-framework-benchmark), branch from latest release tag.
4. Add `frameworks/keyed/luxel/` with `package.json` (`js-framework-benchmark.frameworkVersion`, home URL, language).
5. PR title: `Add Luxel keyed implementation`.
6. Include build instructions in PR body (`luxel build` + sync script path).
7. v1.0 `ACTIVE_GATE_TIERS` stays non-keyed only unless promoted in a follow-up ADR.

Track: https://github.com/SynCROSS/luxel/issues/92
