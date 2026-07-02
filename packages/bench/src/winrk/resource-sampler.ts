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

export type SampleResourcesOptions = {
  intervalMs?: number;
  signal?: AbortSignal;
};

const DEFAULT_INTERVAL_MS = Number(process.env.BENCH_RESOURCE_INTERVAL_MS ?? "500");

function rssMb(): number {
  return process.memoryUsage().rss / (1024 * 1024);
}

function cpuPercentSince(previous: NodeJS.CpuUsage, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  const usage = process.cpuUsage(previous);
  const usedMs = (usage.user + usage.system) / 1000;
  return (usedMs / elapsedMs) * 100;
}

/** Poll server process RSS + CPU while an async bench phase runs. */
export async function sampleResourcesDuring<T>(
  run: () => Promise<T>,
  options: SampleResourcesOptions = {},
): Promise<{ result: T; resources: ResourceSummary }> {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const samples: ResourceSample[] = [];
  const startedAt = performance.now();
  let previousCpu = process.cpuUsage();
  let previousAt = startedAt;
  const controller = new AbortController();
  const signal = options.signal ?? controller.signal;

  const timer = setInterval(() => {
    const now = performance.now();
    const elapsed = now - previousAt;
    samples.push({
      atMs: now - startedAt,
      cpuPercent: cpuPercentSince(previousCpu, elapsed),
      memoryMb: rssMb(),
    });
    previousCpu = process.cpuUsage();
    previousAt = now;
  }, intervalMs);

  if (signal.aborted) clearInterval(timer);
  signal.addEventListener("abort", () => clearInterval(timer), { once: true });

  try {
    const result = await run();
    return { result, resources: summarizeResourceSamples(samples) };
  } finally {
    controller.abort();
    clearInterval(timer);
  }
}

export function summarizeResourceSamples(samples: ResourceSample[]): ResourceSummary {
  if (samples.length === 0) {
    const memoryMb = rssMb();
    return {
      samples: [{ atMs: 0, cpuPercent: 0, memoryMb }],
      cpuAvgPercent: 0,
      cpuPeakPercent: 0,
      memoryAvgMb: memoryMb,
      memoryPeakMb: memoryMb,
    };
  }
  const cpuValues = samples.map((s) => s.cpuPercent);
  const memValues = samples.map((s) => s.memoryMb);
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  return {
    samples,
    cpuAvgPercent: sum(cpuValues) / cpuValues.length,
    cpuPeakPercent: Math.max(...cpuValues),
    memoryAvgMb: sum(memValues) / memValues.length,
    memoryPeakMb: Math.max(...memValues),
  };
}
