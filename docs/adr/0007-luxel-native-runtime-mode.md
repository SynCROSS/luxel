# Luxel-native runtime mode

**Status:** accepted

## Context

`luxel-core` started as a Rust crate used from JS through napi-rs, WASM, and Deno FFI. Current hot paths already show why a generic inline native helper is not enough: string payloads cross the JS/native boundary, `renderBodyFromIr` parses JSON render IR and resource snapshots per request, and the renderd prototype still speaks JSON lines and returns full HTML strings.

The goal is **Luxel-native** as Luxel's default native mode, not a separate product. Luxel remains the framework/API surface. Native mode accelerates coarse runtime work while JS/TS keeps orchestration, route semantics, and Web Vitals-sensitive UI paths.

## Decision

1. **Product shape**
   - **Luxel-native** is a native mode of Luxel, not a separate product surface.
   - Default config is `native.mode: "auto"`; authors may set `"off"` or `"strict"`.
   - `"auto"` uses native only when the platform package/runtime loads and sanity benchmarks pass.
   - `"strict"` is valid in dev and prod; startup fails if native mode cannot load.

2. **Runtime support day one**
   - Native mode must support **Bun**, **Node 20+**, and **Deno 2+** from the first defaultable release.
   - The public app API stays handler-first (`createAppServerFetch`, adapters, `serveLuxel`); runtime-specific native loading stays inside Luxel.
   - Platform native packages are acceptable when needed, but install size, startup cost, RSS, and Web Vitals gates decide whether native remains default on a path.

3. **Boundary strategy**
   - JS/TS owns high-frequency orchestration, route projection, and small render work.
   - Native owns coarse, stateful, measurable work: large-payload streaming, cache-backed transforms, native SSR kernels that avoid JSON payloads, compression, and later runtime services.
   - Generic per-request JSON native interpreters are rejected for hot paths. Route-specific native entry points or generated JS render functions are required.
   - Large payloads cross boundaries as typed bytes, shared memory handles, or protocol messages, not repeated JSON strings.

4. **IPC strategy**
   - Before choosing a production IPC format, benchmark at least:
     - Cap'n Proto
     - FlatBuffers
     - custom length-prefixed binary messages
   - Benchmarks must cover null-call latency, small control messages, 1KB/64KB/1MB payloads, streaming chunks, concurrent requests, backpressure, and failure/cancel paths on Bun, Node, and Deno.
   - JSON-lines stays prototype-only.

5. **Large JSON security and speed**
   - Default policy: trusted compile-time schemas only.
   - Compile-time schemas generate validators, typed layouts, and resource projection metadata.
   - Untrusted third-party JSON schemas are disabled by default and require explicit config.
   - When enabled, untrusted schemas must run with max depth, key count, string byte caps, total byte caps, parse timeout, schema cache bounds, and deterministic failure modes.
   - Parse once at the trust boundary; downstream Luxel-native paths consume typed/resource envelopes or binary buffers.

6. **Streaming and cache model**
   - Native mode should process streams incrementally and surface partial bytes to JS without buffering full payloads.
   - String-level caching is byte-bounded and generation-aware: intern repeated keys, stable enum strings, route static fragments, and validated resource strings by `(route_id, field_path, hash)`.
   - Cache entries are immutable and ref-counted; request cursors are isolated per consumer.
   - Backpressure is explicit through bounded queues or window updates; no unbounded native buffering.

7. **GPU scope**
   - First GPU scope is browser/client **layout and math only**.
   - Prefer WebGPU; use WebGL only for narrow numeric kernels where WebGPU is unavailable and the fallback beats CPU.
   - GPU paths are optimization-only. Output contract must match CPU output.
   - Web Vitals, memory, battery, and warmup costs gate default enablement. If GPU hurts INP or resource usage, auto mode disables it.

8. **Measurement gates**
   - Every native-mode optimization must ship with a benchmark before default enablement.
   - Required metrics: boundary crossings/request, serialized bytes/request, p50/p95/p99 latency, throughput, TTFB for streams, chunk gap p99, cache hit ratio by bytes, RSS, install size, cold start, and Web Vitals proxy metrics.
   - Native mode may be faster in isolation and still stay off by default if it hurts user-facing Web Vitals or resource budgets.

## Configuration shape

```ts
export default {
  native: {
    mode: "auto", // auto | off | strict
    runtime: "process",
    ipc: "benchmark",
    schemas: {
      thirdParty: false,
    },
    gpu: {
      client: "auto", // auto | off | strict
      backend: "webgpu",
      scope: "layout-math",
    },
  },
}
```

Names above are contract direction. Exact TypeScript types may evolve before the first public native-mode release, but the mode semantics (`auto | off | strict`) are locked.

## Implementation order

| Step | Deliverable | Gate |
|------|-------------|------|
| 1 | Boundary benchmark suite across Bun, Node, Deno | Measures NAPI/FFI/WASM/null calls, JSON, typed arrays, bytes |
| 2 | Remove generic JSON native render hot paths from defaults | No per-request `renderBodyFromIr(JSON.stringify(...))` on hot routes |
| 3 | IPC benchmark spike | Cap'n Proto vs FlatBuffers vs custom binary on all three runtimes |
| 4 | `luxel-renderd` runtime behind `native.mode` | Same Luxel app API; `"off"` falls back to JS |
| 5 | Streaming JSON parse/validate/resource envelope | TTFB, p99 chunk gap, RSS, limits verified |
| 6 | String-level native cache | Byte-bounded, generation-aware, concurrency-tested |
| 7 | Browser WebGPU layout/math prototype | Enabled only when Web Vitals/resource gates pass |
| 8 | Native mode default gate | `auto` faster or equal on target workloads without Web Vitals/RSS regression |

## Considered options

| Option | Decision | Why |
|--------|----------|-----|
| Separate `luxel-native` product | Rejected | User-facing product remains Luxel; native mode is config/runtime behavior |
| Inline FFI everywhere | Rejected | Boundary overhead defeats native speed on string/JSON hot paths |
| Generic Rust IR interpreter | Rejected for hot paths | Repeated JSON serialization/deserialization is the bottleneck class being removed |
| Pick Cap'n Proto immediately | Rejected | IPC choice must be benchmarked against FlatBuffers and custom binary on Bun/Node/Deno |
| Server GPU first | Deferred | First GPU value is browser layout/math; server GPU can follow evidence |
| Native default without resource gates | Rejected | Web Vitals, memory, startup, and package size can make "faster" native paths worse for users |

## Consequences

- Root `CONTEXT.md` must define **Luxel-native** as native mode, not product identity.
- ADR-0005 remains valid for the near-term `luxel-core` rollout, but this ADR supersedes any interpretation that `luxel-renderd` is only a late lab service after inline NAPI work. Runtime service work can proceed once boundary benchmarks and default gates exist.
- Bench docs need a native boundary benchmark section before native mode can become default.
- Config and manifest types need room for `native.mode` and native eligibility diagnostics.
- Native package publishing must include Bun, Node, and Deno loader coverage before default native mode ships.

## Related

- Root `CONTEXT.md` — Luxel-native, luxel-core, runtime compatibility, performance claim ladder
- [ADR-0003](./0003-multi-runtime-deploy.md) — Bun/Node/Deno deploy surface
- [ADR-0005](./0005-luxel-core-phased-rollout.md) — luxel-core rollout and native SSR gates
- [ADR-0006](./0006-bench-perf-priority-and-competitor-peak.md) — perf priority and fair benchmark gates
- `packages/luxel/src/luxel-core/render-ir-native.ts`
- `packages/luxel/src/renderd/protocol.ts`
