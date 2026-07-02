# Benchmark scorecard (draft)

Published from `luxel bench` JSON lines. Counter fixture includes **luxel**, **static-http**, **fastify**, **react**, **vue**; **solid** / **svelte** emit `pending` when optional deps unavailable. **docs-site** app-class throughput included.

## Claim ladder (product order)

Resolve conflicts in this order (see root `CONTEXT.md` **Performance claim ladder**):

1. **Web Vitals / INP** — Playwright `inp_ms` on counter + nav-demo; gate: `inp_geo_mean_factor ≤ 1.08`; nightly Lighthouse on docs-site; CrUX optional post-launch
2. **Server render throughput** — per-request SSR / ISR / SSG / trisomorphic via render worker; **RPS** per [Platformatic SSR showdown](https://blog.platformatic.dev/ssr-performance-showdown) (large spiral tile document ~2.4k nodes, prod build, render every request). Pass: `geo_mean(ssr_factor) ≤ 1.08` over all `{mode}×{fixture}` cells; `ssr_factor = rps_fastest / rps_luxel` among {Luxel, React, Vue, Svelte, Solid} in same run. Metrics: `ssr_throughput_rps`, `isr_throughput_rps`, `ssg_throughput_rps`, `sw_throughput_rps` — runners must not pre-bake HTML for framework rows.
3. **js-framework-benchmark** — full krausest table at v1.0; pass: `geo_mean(krausest_factor) ≤ 1.08` where `krausest_factor = duration_luxel / min(duration_luxel, react, vue, svelte, solid)` per scenario; publish `median(krausest_factor)` too. Stretch: top-3 on every row (marketing only)
4. **Bytes** — **gate:** first-nav served transfer (HTML+JS+CSS, compressed) on counter + docs-site; `transfer_geo_mean_factor ≤ 1.08`. **publish-only:** `client_js_bytes`, install/tarball footprint, CLI cold start ms

Weighted score below is **draft** until INP + krausest runners land; ladder order overrides stale weights.

## Metrics (draft weights)

| Metric | JSON `metric` | Draft weight |
|--------|----------------|--------------|
| INP / Web Vitals proxy | `inp_ms` | 0.40 (tier 1) |
| SSR throughput (fair per-request) | `ssr_throughput_rps` | 0.25 |
| krausest factors + geo mean | `krausest_<scenario>_factor`, `krausest_geo_mean_factor` | 0.20 |
| Served transfer (gate) | `transfer_bytes`, `transfer_geo_mean_factor` | 0.15 |
| Client JS / install / CLI (publish) | `client_js_bytes`, `install_bytes`, `cli_cold_start_ms` | — |

## Normalized score (per framework F) — draft

```
score(F) = 0.40 * inp_score(F) + 0.25 * (rps(F) / max_rps) + 0.20 * krausest_gate(F) + 0.15 * (min_bytes / bytes(F))

# krausest_gate: 1.0 if geo_mean_factor(F) ≤ 1.08 else scales down; Luxel v1.0 requires gate = 1.0
```

Higher is better. Re-normalize when metrics are `pending`.

## Example line

```json
{"fixture":"counter","framework":"luxel","metric":"ssr_throughput_rps","value":1234.5}
```

Run: `bun packages/luxel/src/cli.ts bench` (v1.0). v1.1: native `luxel-node.mjs` / `luxel-deno.ts` (no Bun).

**Gate:** `luxel bench --gate` (active tier: SSR counter only until more runners land). Fast tests: `LUXEL_BENCH_SKIP_INP=1 luxel bench`. INP requires `bunx playwright install chromium`.

**Native default gate:** `luxel bench --gate --native-gate` (or `--native-gate` alone) evaluates WinRK + INP + boundary + RSS/cold-start/install for `native.mode: auto` enablement. Publishes `docs/benchmarks/runs/native-default-gate-*.md`. See [native-default-enablement.md](./native-default-enablement.md).

**v1.0 gate:** `luxel bench --gate` (or CI equivalent) — all tier geo means ≤ 1.08 in **one** run. Fastest/min denominator = only frameworks with non-`pending` results in that run.

Publish runs: `LUXEL_BENCH_OUT=docs/benchmarks/runs/<date>.jsonl luxel bench`
