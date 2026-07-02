import { benchWorkerUrl } from "./bench-worker-url.ts";
import { createLuxelBenchRenderWorkerPool } from "./luxel-bench-render-pool.ts";
import type { BenchRenderWorkerPool } from "./competitors/render-worker-pool.ts";
import { benchRenderWorkerCountForFixture } from "./competitors/render-worker-pool.ts";
import { getLuxelRepoRoot } from "../paths.ts";
import { precompileLuxelNavDemoForPool } from "./precompile-luxel-bench.ts";

export async function createLuxelNavDemoRenderPool(): Promise<BenchRenderWorkerPool> {
  const repoRoot = getLuxelRepoRoot();
  const app = await precompileLuxelNavDemoForPool(repoRoot);
  return createLuxelBenchRenderWorkerPool(
    benchWorkerUrl("luxel-nav-demo-render.worker.ts"),
    { repoRoot, genRoot: app.genRoot },
    { sequentialWarmup: true },
    benchRenderWorkerCountForFixture("counter"),
  );
}
