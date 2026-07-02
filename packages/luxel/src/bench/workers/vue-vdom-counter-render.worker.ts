import "../competitors/bench-env.ts";
import { competitorSource } from "../competitors/sources-path.ts";
import { importPrecompiledVueSfc } from "../competitors/compile-vue-sfc.ts";
import { onBenchWorkerMessage, postBenchWorkerResult } from "./bench-worker-runtime.ts";

type VueComponent = Awaited<ReturnType<typeof importPrecompiledVueSfc>>;
type CreateSSRApp = typeof import("vue").createSSRApp;
type RenderToString = typeof import("vue/server-renderer").renderToString;

let component: VueComponent | null = null;
let createSSRAppFn: CreateSSRApp | null = null;
let renderToStringFn: RenderToString | null = null;

async function ensureVueVdomSsr(): Promise<void> {
  if (!createSSRAppFn || !renderToStringFn) {
    const vue = await import("vue");
    const serverRenderer = await import("vue/server-renderer");
    createSSRAppFn = vue.createSSRApp;
    renderToStringFn = serverRenderer.renderToString;
  }
}

async function renderOnce(): Promise<void> {
  await ensureVueVdomSsr();
  component ??= await importPrecompiledVueSfc(competitorSource("counter", "vue-vdom.vue"), "counter-vue-vdom");
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
