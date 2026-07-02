import type { IpcBenchRuntime } from "./types.ts";

export function detectBenchRuntime(): IpcBenchRuntime {
  if (typeof (globalThis as { Deno?: unknown }).Deno !== "undefined") return "deno";
  if (typeof Bun !== "undefined") return "bun";
  return "node";
}

export function percentileUs(samplesUs: number[], p: number): number {
  if (samplesUs.length === 0) return 0;
  const sorted = [...samplesUs].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index] ?? 0;
}

export function benchIterations(size: number): number {
  if (size <= 0) return 400;
  if (size <= 1024) return 120;
  if (size <= 65_536) return 40;
  return 8;
}

export function timeRoundtripUs(fn: () => void, iterations: number): number {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    samples.push((performance.now() - start) * 1000);
  }
  return percentileUs(samples, 50);
}
