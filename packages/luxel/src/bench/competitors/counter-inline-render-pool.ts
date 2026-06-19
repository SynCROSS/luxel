import { benchWorkerUrl } from "../bench-worker-url.ts";
import { createSelectedBenchRenderWorkerPool } from "../luxel-bench-render-pool.ts";
import { benchRenderWorkerCountForFixture } from "./render-worker-pool.ts";
import type { BenchRenderWorkerPool } from "./render-worker-pool.ts";
import { precompileInlineSsr } from "./precompile-inline-ssr.ts";
import type { SpiralInlineFramework } from "./spiral-inline-render.ts";

export type CounterInlineFramework = SpiralInlineFramework;

const WORKER_URLS: Record<CounterInlineFramework, URL> = {
  react: benchWorkerUrl("react-counter-render.worker.ts"),
  "vue-vdom": benchWorkerUrl("vue-vdom-counter-render.worker.ts"),
  "vue-vapor": benchWorkerUrl("vue-vapor-counter-render.worker.ts"),
  solid: benchWorkerUrl("solid-counter-render.worker.ts"),
  svelte: benchWorkerUrl("svelte-counter-render.worker.ts"),
};

const POOLED_HTML_RENDERERS: Record<
  CounterInlineFramework,
  () => Promise<string | null>
> = {
  react: async () => (await import("./ssr-render.ts")).renderReactCounterDocument(),
  "vue-vdom": async () => (await import("./ssr-render.ts")).renderVueVdomCounterDocument(),
  "vue-vapor": async () => (await import("./ssr-render.ts")).renderVueVaporCounterDocument(),
  solid: async () => (await import("./ssr-render.ts")).renderSolidCounterDocument(),
  svelte: async () => (await import("./ssr-render.ts")).renderSvelteCounterDocument(),
};

export async function createCounterInlineRenderPool(
  framework: CounterInlineFramework,
): Promise<BenchRenderWorkerPool> {
  await precompileInlineSsr("counter", framework);
  const pooledHtml = await POOLED_HTML_RENDERERS[framework]();
  if (!pooledHtml) {
    throw new Error(`counter pooled html unavailable for ${framework}`);
  }
  return createSelectedBenchRenderWorkerPool(WORKER_URLS[framework], {}, {
    sequentialWarmup: true,
    pooledHtml,
  }, benchRenderWorkerCountForFixture("counter"));
}
