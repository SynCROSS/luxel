import { benchFetch } from "@luxel/luxel/bench";

export type ResourceSample = {
  atMs: number;
  cpuPercent: number;
  memoryMb: number;
};

export type ResourceSummary = {
  samples: ResourceSample[];
  cpuAvgPercent: number;
  cpuPeakPercent: number;
  memoryAvgMb: number;
  memoryPeakMb: number;
};

export type LatencySampleSummary = {
  sampleCount: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
};

export type LatencySampleResult = LatencySampleSummary & {
  minMs: number;
  avgMs: number;
  maxMs: number;
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

export function benchResourceIntervalMs(): number {
  return parsePositiveInt(process.env.BENCH_RESOURCE_INTERVAL_MS, 500);
}

export function formatResponseBytesLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx]!;
}

export function summarizeResourceSamples(samples: ResourceSample[]): ResourceSummary {
  if (samples.length === 0) {
    return {
      samples: [],
      cpuAvgPercent: 0,
      cpuPeakPercent: 0,
      memoryAvgMb: 0,
      memoryPeakMb: 0,
    };
  }
  let cpuSum = 0;
  let cpuPeak = 0;
  let memSum = 0;
  let memPeak = 0;
  for (const sample of samples) {
    cpuSum += sample.cpuPercent;
    memSum += sample.memoryMb;
    if (sample.cpuPercent > cpuPeak) cpuPeak = sample.cpuPercent;
    if (sample.memoryMb > memPeak) memPeak = sample.memoryMb;
  }
  return {
    samples,
    cpuAvgPercent: cpuSum / samples.length,
    cpuPeakPercent: cpuPeak,
    memoryAvgMb: memSum / samples.length,
    memoryPeakMb: memPeak,
  };
}

/** Poll bench process CPU/RSS while load test runs (one stack server per process). */
export async function measureWithResourceSampling<T>(
  run: () => Promise<T>,
): Promise<{ result: T; resources: ResourceSummary }> {
  const samples: ResourceSample[] = [];
  const intervalMs = benchResourceIntervalMs();
  const t0 = performance.now();
  let lastCpu = process.cpuUsage();
  let lastAt = t0;

  const timer = setInterval(() => {
    const now = performance.now();
    const cpuNow = process.cpuUsage();
    const elapsedUs = (now - lastAt) * 1000;
    const delta = process.cpuUsage(lastCpu);
    const cpuPercent = elapsedUs > 0 ? ((delta.user + delta.system) / elapsedUs) * 100 : 0;
    samples.push({
      atMs: now - t0,
      cpuPercent,
      memoryMb: process.memoryUsage().rss / (1024 * 1024),
    });
    lastCpu = cpuNow;
    lastAt = now;
  }, intervalMs);

  try {
    const result = await run();
    return { result, resources: summarizeResourceSamples(samples) };
  } finally {
    clearInterval(timer);
  }
}

export async function measureResponseBytes(url: string): Promise<number> {
  const target = url.endsWith("/") ? url : `${url}/`;
  const res = await benchFetch(target);
  if (!res.ok) throw new Error(`response bytes probe failed: ${res.status} ${target}`);
  const body = await res.text();
  return new TextEncoder().encode(body).byteLength;
}

export async function samplePostWinrkLatency(
  url: string,
  sampleCount: number,
  concurrency: number,
): Promise<LatencySampleResult> {
  const target = url.endsWith("/") ? url : `${url}/`;
  const latencies: number[] = new Array(sampleCount);
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= sampleCount) return;
      const t0 = performance.now();
      const res = await benchFetch(target);
      if (!res.ok) throw new Error(`latency sample failed: ${res.status} ${target}`);
      await res.text();
      latencies[i] = performance.now() - t0;
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, sampleCount) }, () => worker());
  await Promise.all(workers);

  const sorted = latencies.filter((v) => v !== undefined).sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    sampleCount: sorted.length,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    minMs: sorted[0] ?? 0,
    avgMs: sorted.length ? sum / sorted.length : 0,
    maxMs: sorted[sorted.length - 1] ?? 0,
  };
}
