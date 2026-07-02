import { benchWorkerUrl } from "../bench-worker-url.ts";
import { createSelectedBenchRenderWorkerPool } from "../luxel-bench-render-pool.ts";
import { benchRenderWorkerCountForFixture, type BenchRenderWorkerPool } from "./render-worker-pool.ts";
import { precompileInlineSsr } from "./precompile-inline-ssr.ts";
import type { SpiralInlineFramework } from "./spiral-inline-render.ts";

const WORKER_URLS: Record<SpiralInlineFramework, URL> = {
  react: benchWorkerUrl("react-spiral-render.worker.ts"),
  "vue-vdom": benchWorkerUrl("vue-vdom-spiral-render.worker.ts"),
  "vue-vapor": benchWorkerUrl("vue-vapor-spiral-render.worker.ts"),
  solid: benchWorkerUrl("solid-spiral-render.worker.ts"),
  svelte: benchWorkerUrl("svelte-spiral-render.worker.ts"),
};

const POOLED_HTML_RENDERERS: Record<
  SpiralInlineFramework,
  () => Promise<string | null>
> = {
  react: async () => (await import("./ssr-render.ts")).renderReactSpiralDocument(),
  "vue-vdom": async () => (await import("./ssr-render.ts")).renderVueVdomSpiralDocument(),
  "vue-vapor": async () => (await import("./ssr-render.ts")).renderVueVaporSpiralDocument(),
  solid: async () => (await import("./ssr-render.ts")).renderSolidSpiralDocument(),
  svelte: async () => (await import("./ssr-render.ts")).renderSvelteSpiralDocument(),
};

export async function createSpiralInlineRenderPool(
  framework: SpiralInlineFramework,
): Promise<BenchRenderWorkerPool> {
  await precompileInlineSsr("spiral", framework);
  const pooledHtml = await POOLED_HTML_RENDERERS[framework]();
  if (!pooledHtml) {
    throw new Error(`spiral pooled html unavailable for ${framework}`);
  }
  return createSelectedBenchRenderWorkerPool(WORKER_URLS[framework], {}, {
    sequentialWarmup: true,
    pooledHtml,
  }, benchRenderWorkerCountForFixture("spiral"));
}
