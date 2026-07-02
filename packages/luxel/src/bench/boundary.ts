import { getLuxelCoreNodeModule, isLuxelCoreNodeLoadable } from "./ensure-core-node.ts";

export type BoundaryBenchLine = {
  fixture: "boundary";
  runtime: "bun" | "node" | "deno";
  metric: string;
  value: number;
};

type BenchRuntime = BoundaryBenchLine["runtime"];

const SAMPLE_JSON = {
  renderIr: { domOps: [{ kind: "text", expr: { kind: "identifier", raw: "message" } }] },
  snapshot: { "route:index:message": { value: { message: "Hello Luxel" } } },
  bindings: [{ templateId: "message", resourceKey: "route:index:message", field: "message" }],
};

function detectRuntime(): BenchRuntime {
  if (typeof (globalThis as { Deno?: unknown }).Deno !== "undefined") return "deno";
  if (typeof Bun !== "undefined") return "bun";
  return "node";
}

function percentileUs(samplesUs: number[], p: number): number {
  if (samplesUs.length === 0) return 0;
  const sorted = [...samplesUs].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index] ?? 0;
}

function benchLatencyUs(fn: () => void, iterations: number): number[] {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    samples.push((performance.now() - start) * 1000);
  }
  return samples;
}

function* emitLatencyPercentiles(
  runtime: BenchRuntime,
  metricPrefix: string,
  samples: number[],
): Generator<BoundaryBenchLine> {
  if (samples.length === 0) return;
  for (const [suffix, p] of [
    ["p50", 50],
    ["p95", 95],
    ["p99", 99],
  ] as const) {
    yield {
      fixture: "boundary",
      runtime,
      metric: `${metricPrefix}_${suffix}_us`,
      value: percentileUs(samples, p),
    };
  }
}

function benchJsonRoundtrip(iterations: number): { samples: number[]; serializedBytes: number } {
  const serializedBytes = JSON.stringify(SAMPLE_JSON).length;
  const samples = benchLatencyUs(() => {
    JSON.parse(JSON.stringify(SAMPLE_JSON));
  }, iterations);
  return { samples, serializedBytes };
}

function benchNativeNullCall(iterations: number): number[] | null {
  const mod = getLuxelCoreNodeModule();
  const fn = mod?.renderCounterBody;
  if (typeof fn !== "function") return null;
  return benchLatencyUs(() => {
    (fn as (message: string) => string)("bench");
  }, iterations);
}

function benchNativeJsonIr(iterations: number): number[] | null {
  const mod = getLuxelCoreNodeModule();
  const fn = mod?.renderBodyFromIr;
  if (typeof fn !== "function") return null;
  const ir = JSON.stringify(SAMPLE_JSON.renderIr);
  const snapshot = JSON.stringify(SAMPLE_JSON.snapshot);
  const bindings = JSON.stringify(SAMPLE_JSON.bindings);
  return benchLatencyUs(() => {
    (fn as (a: string, b: string, c: string) => string)(ir, snapshot, bindings);
  }, iterations);
}

function benchTypedArrayCross(iterations: number): number[] | null {
  const mod = getLuxelCoreNodeModule();
  const fn = mod?.renderSpiralBodyFromCoords;
  if (typeof fn !== "function") return null;
  const coords = new Float64Array([0, 0, 10, 10, 20, 20]);
  return benchLatencyUs(() => {
    (fn as (coords: Float64Array) => string)(coords);
  }, iterations);
}

function benchStreamChunkCross(iterations: number): number[] | null {
  const mod = getLuxelCoreNodeModule();
  const fn = mod?.renderSpiralBodyFromCoords;
  if (typeof fn !== "function") return null;
  const chunks = [
    new Float64Array([0, 0, 10, 10]),
    new Float64Array([20, 20, 30, 30]),
    new Float64Array([40, 40, 50, 50]),
  ];
  return benchLatencyUs(() => {
    for (const chunk of chunks) {
      (fn as (coords: Float64Array) => string)(chunk);
    }
  }, iterations);
}

export async function* runBoundaryBench(): AsyncGenerator<BoundaryBenchLine> {
  const runtime = detectRuntime();
  const iterations = 200;
  const json = benchJsonRoundtrip(iterations);

  yield* emitLatencyPercentiles(runtime, "json_roundtrip", json.samples);
  yield { fixture: "boundary", runtime, metric: "json_serialized_bytes", value: json.serializedBytes };

  if (isLuxelCoreNodeLoadable()) {
    const nullSamples = benchNativeNullCall(iterations);
    if (nullSamples) {
      yield* emitLatencyPercentiles(runtime, "native_null_call", nullSamples);
    }
    const jsonIrSamples = benchNativeJsonIr(Math.min(iterations, 50));
    if (jsonIrSamples) {
      yield* emitLatencyPercentiles(runtime, "native_json_ir", jsonIrSamples);
    }
    const typedSamples = benchTypedArrayCross(Math.min(iterations, 50));
    if (typedSamples) {
      yield* emitLatencyPercentiles(runtime, "typed_array_cross", typedSamples);
    }
    const streamSamples = benchStreamChunkCross(Math.min(iterations, 50));
    if (streamSamples) {
      yield* emitLatencyPercentiles(runtime, "stream_chunk_cross", streamSamples);
    }
  }
}
