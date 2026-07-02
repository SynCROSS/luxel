import "../competitors/bench-env.ts";
import { competitorSource } from "../competitors/sources-path.ts";
import { importPrecompiledVueSfc } from "../competitors/compile-vue-sfc.ts";
import { onBenchWorkerMessage, postBenchWorkerResult } from "./bench-worker-runtime.ts";

type VueComponent = Awaited<ReturnType<typeof importPrecompiledVueSfc>>;
type CreateSSRApp = typeof import("vue-vapor").createSSRApp;
type RenderToString = typeof import("vue-vapor/server-renderer").renderToString;

let component: VueComponent | null = null;
let createSSRAppFn: CreateSSRApp | null = null;
let renderToStringFn: RenderToString | null = null;

async function ensureVueVaporSsr(): Promise<void> {
  if (!createSSRAppFn || !renderToStringFn) {
    const vue = await import("vue-vapor");
    const serverRenderer = await import("vue-vapor/server-renderer");
    createSSRAppFn = vue.createSSRApp;
    renderToStringFn = serverRenderer.renderToString;
  }
}

async function renderOnce(): Promise<void> {
  await ensureVueVaporSsr();
  component ??= await importPrecompiledVueSfc(
    competitorSource("counter", "vue-vapor.vue"),
    "counter-vue-vapor",
    true,
  );
  await renderToStringFn!(createSSRAppFn!(component!));
}

onBenchWorkerMessage(async () => {
  try {
    await renderOnce();
    postBenchWorkerResult({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    postBenchWorkerResult({ ok: false, error: message });
  }
});
