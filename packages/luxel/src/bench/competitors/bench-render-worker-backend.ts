export type BenchRenderWorkerBackend = "bun" | "node";

function parseBenchRenderWorkerBackend(
  raw: string | undefined,
): BenchRenderWorkerBackend | undefined {
  const norm = raw?.trim().toLowerCase();
  if (norm === "node") return "node";
  if (norm === "bun") return "bun";
  return undefined;
}

/** Explicit env wins; Windows defaults to node (Bun Worker churn crashes harness). */
export function resolveBenchRenderWorkerBackend(): BenchRenderWorkerBackend {
  return (
    parseBenchRenderWorkerBackend(process.env.BENCH_RENDER_WORKER_BACKEND) ??
    (process.platform === "win32" ? "node" : "bun")
  );
}

export function benchUsesNodeRenderWorkers(): boolean {
  return resolveBenchRenderWorkerBackend() === "node";
}

/** Pin BENCH_RENDER_WORKER_BACKEND before any worker-pool stack starts. */
export function applyDefaultBenchRenderWorkerBackendEnv(): void {
  if (parseBenchRenderWorkerBackend(process.env.BENCH_RENDER_WORKER_BACKEND) !== undefined) {
    return;
  }
  process.env.BENCH_RENDER_WORKER_BACKEND = process.platform === "win32" ? "node" : "bun";
}
