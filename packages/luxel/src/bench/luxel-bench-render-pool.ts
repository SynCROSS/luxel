import { createBenchRenderWorkerPool, benchRenderWorkerCount } from "./competitors/render-worker-pool.ts";
import { createNodeBenchRenderWorkerPool } from "./competitors/render-worker-pool-node.ts";
import { benchUsesNodeRenderWorkers } from "./competitors/bench-render-worker-backend.ts";
import type { BenchRenderWorkerPool, BenchRenderWorkerPoolOptions } from "./competitors/render-worker-pool.ts";

/** Shared bench render pool selector. Bun Worker default; opt into node:worker_threads via env. */
export function createSelectedBenchRenderWorkerPool(
  workerUrl: string | URL,
  workerData: unknown,
  options: BenchRenderWorkerPoolOptions = {},
  size = benchRenderWorkerCount(),
): BenchRenderWorkerPool {
  if (benchUsesNodeRenderWorkers()) {
    return createNodeBenchRenderWorkerPool(workerUrl, workerData, size, options);
  }
  return createBenchRenderWorkerPool(workerUrl, workerData, size, options);
}

export const createLuxelBenchRenderWorkerPool = createSelectedBenchRenderWorkerPool;
