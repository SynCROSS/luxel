# Luxel-native boundary benchmark

Baseline JS/native boundary evidence before native-mode perf claims. Hot-path SSR uses **route-specific kernels** only; `native_json_ir_*` rows measure the **lab** generic Render IR interpreter (`renderBodyFromIr`), not counter/spiral defaults.

## Run

```bash
bun run build:core-node   # optional — enables native rows
bun packages/luxel/src/cli.ts bench --boundary
```

Node / Deno (from app dir):

```bash
node ../../packages/luxel/bin/luxel-node.mjs bench --boundary
deno run --allow-all ../../packages/luxel/bin/luxel-deno.ts bench --boundary
```

## Metrics

| Metric prefix | Meaning |
| --- | --- |
| `json_roundtrip_p{50,95,99}_us` | `JSON.stringify` + `JSON.parse` round-trip |
| `json_serialized_bytes` | Sample payload byte size |
| `native_null_call_p{50,95,99}_us` | `renderCounterBody("bench")` NAPI call |
| `native_json_ir_p{50,95,99}_us` | Lab `renderBodyFromIr` (not hot-path SSR) |
| `typed_array_cross_p{50,95,99}_us` | `Float64Array` → native spiral coords |
| `stream_chunk_cross_p{50,95,99}_us` | Multiple typed-array chunks per iteration |

Each line: `{"fixture":"boundary","runtime":"bun|node|deno","metric":"…","value":number}`.

## Interpretation

- Compare **same `runtime`** across machines; do not compare bun vs node directly.
- Rising `native_null_call_*` or `typed_array_cross_*` without code changes → investigate addon load or boundary regression.
- Native default gate (`luxel bench --native-gate`) consumes `native_null_call_p50_us` and `typed_array_cross_p50_us`.

Related: [ADR-0007](../adr/0007-luxel-native-runtime-mode.md), [native-default-enablement.md](./native-default-enablement.md).
