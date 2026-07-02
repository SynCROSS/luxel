import { benchWorkerUrl } from "./bench-worker-url.ts";
import { createLuxelBenchRenderWorkerPool } from "./luxel-bench-render-pool.ts";
import { hydrateLuxelBenchApp } from "./hydrate-compiled-app.ts";
import type { BenchRenderWorkerPool } from "./competitors/render-worker-pool.ts";
import { benchRenderWorkerCountForFixture } from "./competitors/render-worker-pool.ts";
import { ensureSpiralFixture } from "./ensure-spiral-fixture.ts";
import { prepareLuxelSpiralNativeBench } from "./ensure-core-node.ts";
import { getLuxelRepoRoot } from "../paths.ts";
import { precompileLuxelAppForPool } from "./precompile-luxel-bench.ts";
import { stripLuxelBenchSidecars } from "./strip-bench-html.ts";

export type LuxelSpiralRenderPoolOptions = {
  ssrBackend?: "ts" | "native";
};

async function sampleLuxelSpiralHtml(genRoot: string): Promise<string> {
  const { getLuxelCoreNodeModule } = await import("./ensure-core-node.ts");
  const { spiralNativeStreamShell } = await import("../luxel-core/native-route-document.ts");
  const mod = getLuxelCoreNodeModule();
  if (typeof mod?.renderSpiralBody === "function") {
    const body = (mod.renderSpiralBody as () => string)();
    const { prefix, suffix } = spiralNativeStreamShell("/", SPIRAL_HEAD_STYLE);
    return `${prefix}${body}${suffix}`;
  }
  const app = await hydrateLuxelBenchApp(genRoot);
  const { createRenderWorker } = await import("../server/render-worker.ts");
  const worker = createRenderWorker(app);
  return (await worker.render("/")).html;
}

const SPIRAL_HEAD_STYLE = `#wrapper {
  position: relative;
  width: 960px;
  height: 720px;
}
.tile {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #333;
}`;

export async function createLuxelSpiralRenderPool(
  options: LuxelSpiralRenderPoolOptions = {},
): Promise<BenchRenderWorkerPool> {
  const ssrBackend = options.ssrBackend;
  const repoRoot = getLuxelRepoRoot();
  const appDir = await ensureSpiralFixture(repoRoot);
  if (ssrBackend === "native" || ssrBackend === undefined) {
    await prepareLuxelSpiralNativeBench();
  }
  const app = await precompileLuxelAppForPool(repoRoot, appDir, {
    ...(ssrBackend ? { routeSsrBackends: { "/": ssrBackend } } : {}),
  });
  const pooledHtml = stripLuxelBenchSidecars(await sampleLuxelSpiralHtml(app.genRoot));
  return createLuxelBenchRenderWorkerPool(
    benchWorkerUrl("luxel-spiral-render.worker.ts"),
    {
      repoRoot,
      appDir,
      genRoot: app.genRoot,
      ...(ssrBackend ? { ssrBackend } : { ssrBackend: "native" as const }),
    },
    { sequentialWarmup: true, pooledHtml },
    benchRenderWorkerCountForFixture("spiral"),
  );
}
