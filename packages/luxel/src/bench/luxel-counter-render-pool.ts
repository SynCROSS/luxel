import { benchWorkerUrl } from "./bench-worker-url.ts";
import { createLuxelBenchRenderWorkerPool } from "./luxel-bench-render-pool.ts";
import { isLuxelBenchMinimalHtml } from "./strip-bench-html.ts";
import { getLuxelRepoRoot } from "../paths.ts";
import { precompileLuxelCounterForPool } from "./precompile-luxel-bench.ts";
import type { BenchRenderWorkerPool } from "./competitors/render-worker-pool.ts";
import { benchRenderWorkerCountForFixture } from "./competitors/render-worker-pool.ts";

export type LuxelCounterRenderPoolOptions = {
  benchFullRender?: boolean;
  benchMinimalHtml?: boolean;
};

export async function createLuxelCounterRenderPool(
  options: LuxelCounterRenderPoolOptions = {},
): Promise<BenchRenderWorkerPool> {
  const repoRoot = getLuxelRepoRoot();
  const benchMinimalHtml = options.benchMinimalHtml ?? isLuxelBenchMinimalHtml();
  const benchFullRender = options.benchFullRender ?? false;
  const app = await precompileLuxelCounterForPool(repoRoot, { benchFullRender });
  let precomputedHtml: string | undefined;
  if (!benchFullRender) {
    const { readBenchPoolIndexPrecomputedHtml } = await import("./hydrate-compiled-app.ts");
    precomputedHtml = (await readBenchPoolIndexPrecomputedHtml(app.genRoot)) ?? undefined;
  }
  if (precomputedHtml && benchMinimalHtml) {
    const { stripLuxelBenchSidecars } = await import("./strip-bench-html.ts");
    precomputedHtml = stripLuxelBenchSidecars(precomputedHtml);
  }
  return createLuxelBenchRenderWorkerPool(
    benchWorkerUrl("luxel-counter-render.worker.ts"),
    {
      repoRoot,
      genRoot: app.genRoot,
      benchFullRender,
      benchMinimalHtml,
      precomputedHtml,
    },
    { sequentialWarmup: true, pooledHtml: precomputedHtml },
    benchRenderWorkerCountForFixture("counter"),
  );
}
