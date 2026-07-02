# Luxel-native default enablement gate

`native.mode: auto` may become the **product default** only when CI evidence shows native is competitive on WinRK workloads without regressing Web Vitals proxy (INP), NAPI boundary cost, RSS, cold-start, or install footprint.

## Run

```bash
bun run build:core-node
cd examples/counter
LUXEL_BENCH_SKIP_INP=1 LUXEL_BENCH_SKIP_SPIRAL=1 \
  bun ../../packages/luxel/src/cli.ts bench --gate --native-gate
```

Exit **1** when `native_default_gate.ok` is false.

### Fast smoke (test job)

Skips INP + WebGPU. Asserts `"ok":true` only — `auto_default_enabled` stays false.

```bash
LUXEL_BENCH_SKIP_INP=1 LUXEL_BENCH_SKIP_SPIRAL=1 LUXEL_WEBGPU_SKIP=1 \
  LUXEL_BENCH_GATE_SSR_FIXTURES=counter \
  bun ../../packages/luxel/src/cli.ts bench --gate --native-gate
```

### Release gate (`native-default-enablement-full` job)

Runs INP (Playwright) + WebGPU preflight. Asserts `auto_default_enabled: true`.

```bash
bun run build:core-node
bun run test:e2e:webgpu
cd examples/counter
LUXEL_BENCH_SKIP_SPIRAL=1 LUXEL_BENCH_GATE_SSR_FIXTURES=counter \
  bun ../../packages/luxel/src/cli.ts bench --gate --native-gate 2>&1 | tee /tmp/gate.log
bun ../../packages/luxel/scripts/verify-native-default-gate.ts /tmp/gate.log
```

Optional env for CI without WebGPU:

- `LUXEL_BENCH_SKIP_INP=1` — INP pending (blocks `auto_default_enabled`, not `ok`)
- `LUXEL_WEBGPU_SKIP=1` — client-gpu bench emits `webgpu_parity_ok: 0` (slice pending)

## Artifacts

| File | Purpose |
| --- | --- |
| `docs/benchmarks/runs/native-default-gate-latest.jsonl` | Input lines + gate JSON |
| `docs/benchmarks/runs/native-default-gate-scorecard.md` | Release scorecard row |
| `docs/benchmarks/runs/native-default-gate-notes.md` | Why auto is blocked or allowed |

## Required checks

| Check | Source | Pass |
| --- | --- | --- |
| WinRK SSR | `luxel bench` registry | geo-mean factor ≤ 1.08 |
| WinRK ISR | `nav-demo` throughput rows | geo-mean factor ≤ 1.08 |
| INP proxy | Playwright `inp_ms` | geo-mean factor ≤ 1.08, or luxel-only max ≤ `LUXEL_NATIVE_GATE_INP_MS` (default 200) when competitors pending |
| Boundary null NAPI | `luxel bench --boundary` | `native_null_call_p50_us` ≤ cap |
| RSS | `native-resource` bench | `rss_mb` ≤ cap |
| Cold start | first `core-node` load in bench | `cold_start_ms` ≤ cap |
| Install size | `packages/core-node` on disk | `install_size_mb` ≤ cap |

Caps default via env: `LUXEL_NATIVE_GATE_RSS_MB`, `LUXEL_NATIVE_GATE_COLD_START_MS`, `LUXEL_NATIVE_GATE_INSTALL_MB`, `LUXEL_NATIVE_GATE_BOUNDARY_NULL_US`, `LUXEL_NATIVE_GATE_INP_MS`.

## Slice evidence (informational)

References completed parent slices:

- **hot-path** — `typed_array_cross_p50_us` boundary row (#78)
- **runtime** — luxel-renderd IPC bench rows (#81)
- **schema-cache** — trusted schema stream `cache_hit_ratio_bytes` (#84)
- **client-gpu** — WebGPU parity row (#80)

## `auto_default_enabled` vs `ok`

- **`ok`** — no required check **failed** (pending allowed).
- **`auto_default_enabled`** — all required checks **passed** (no pending). INP skip in CI keeps `ok` true but blocks auto default until INP rows land.

## Related

- Parent: [luxel-native rollout #75](https://github.com/SynCROSS/luxel/issues/75)
- Implementation slice: [#85](https://github.com/SynCROSS/luxel/issues/85)
- General scorecard: [scorecard.md](./scorecard.md)
