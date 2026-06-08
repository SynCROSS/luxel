import { compileApp } from "../route/compile-app.ts";
import { createRenderWorker } from "../server/render-worker.ts";
import { createTestServerForApp } from "../test/server.ts";
import { ensureSpiralFixture } from "./ensure-spiral-fixture.ts";
import { spiralTileCount } from "./fixtures/spiral-html.ts";
import { BENCH_ITERATIONS, runFetchThroughputBench } from "./competitors/throughput-harness.ts";
import { getLuxelRepoRoot } from "../paths.ts";

const WORKER_ITERATIONS = 100;

export async function runSpiralBench(): Promise<{
  throughputRps: number;
  renderWorkerRps: number;
  htmlBytes: number;
  tileCount: number;
}> {
  const repoRoot = getLuxelRepoRoot();
  const appDir = await ensureSpiralFixture(repoRoot);
  const app = await compileApp(repoRoot, appDir);
  const worker = createRenderWorker(app);
  const sample = await worker.render("/");
  const htmlBytes = new TextEncoder().encode(sample.html).byteLength;

  const workerStart = performance.now();
  for (let i = 0; i < WORKER_ITERATIONS; i++) {
    await worker.render("/");
  }
  const renderWorkerRps = (WORKER_ITERATIONS / (performance.now() - workerStart)) * 1000;

  const server = await createTestServerForApp(appDir);
  try {
    const { throughputRps } = await runFetchThroughputBench(server.url, BENCH_ITERATIONS);
    return {
      throughputRps,
      renderWorkerRps,
      htmlBytes,
      tileCount: spiralTileCount(),
    };
  } finally {
    server.close();
  }
}
