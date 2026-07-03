import { benchFetch } from "@luxel/luxel/bench";
import {
  benchLatencySampleCount,
  benchLatencyConcurrency,
  prepareForPostWinrkLatencySample,
} from "./bench-latency-config.ts";

export type LatencyPercentiles = {
  sampleCount: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
};

export type LatencySampleOptions = {
  url: string;
  sampleCount?: number;
  concurrency?: number;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)]!;
}

/** Post-winrk fetch loop — histogram for p50/p95/p99 winrk does not emit. */
export async function sampleLatencyPercentiles(
  options: LatencySampleOptions,
): Promise<LatencyPercentiles> {
  const sampleCount = options.sampleCount ?? benchLatencySampleCount();
  const concurrency = options.concurrency ?? benchLatencyConcurrency();
  const durations: number[] = [];
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= sampleCount) return;
      const start = performance.now();
      const res = await benchFetch(options.url);
      if (!res.ok) throw new Error(`latency sample failed: ${res.status}`);
      await res.text();
      durations.push(performance.now() - start);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  durations.sort((a, b) => a - b);
  return {
    sampleCount: durations.length,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
  };
}

/** Cool down after winrk, then histogram — avoids Windows localhost socket exhaustion skew. */
export async function samplePostWinrkLatency(
  options: LatencySampleOptions,
): Promise<LatencyPercentiles> {
  const sampleCount = options.sampleCount ?? benchLatencySampleCount();
  if (sampleCount <= 0) {
    return { sampleCount: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0 };
  }
  await prepareForPostWinrkLatencySample(options.url);
  return sampleLatencyPercentiles({ ...options, sampleCount });
}
