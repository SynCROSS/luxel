import { benchWorkerUrl } from "./bench-worker-url.ts";
import { createSelectedBenchRenderWorkerPool } from "./luxel-bench-render-pool.ts";
import { benchRenderWorkerCountForFixture, type BenchRenderWorkerPool } from "./competitors/render-worker-pool.ts";
import { counterDocumentFromBody, COUNTER_COUNTER_MARKUP } from "./fixtures/counter-contract.ts";

export function createFastifyHtmlCounterRenderPool(): BenchRenderWorkerPool {
  const pooledHtml = counterDocumentFromBody(COUNTER_COUNTER_MARKUP);
  return createSelectedBenchRenderWorkerPool(
    benchWorkerUrl("fastify-html-counter-render.worker.ts"),
    {},
    { pooledHtml, sequentialWarmup: true },
    benchRenderWorkerCountForFixture("counter"),
  );
}
