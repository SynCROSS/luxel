import { benchWorkerUrl } from "./bench-worker-url.ts";
import { createSelectedBenchRenderWorkerPool } from "./luxel-bench-render-pool.ts";
import { benchRenderWorkerCountForFixture, type BenchRenderWorkerPool } from "./competitors/render-worker-pool.ts";
import { spiralMinimalDocument } from "./fixtures/spiral-contract.ts";

export function createFastifyHtmlSpiralRenderPool(): BenchRenderWorkerPool {
  const pooledHtml = spiralMinimalDocument();
  return createSelectedBenchRenderWorkerPool(
    benchWorkerUrl("fastify-html-spiral-render.worker.ts"),
    {},
    { pooledHtml, sequentialWarmup: true },
    benchRenderWorkerCountForFixture("spiral"),
  );
}
