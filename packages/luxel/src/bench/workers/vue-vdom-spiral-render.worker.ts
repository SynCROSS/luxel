import "../competitors/bench-env.ts";
import { spiralDocumentFromBody } from "../fixtures/spiral-contract.ts";
import { competitorSource } from "../competitors/sources-path.ts";
import { importPrecompiledVueSfc } from "../competitors/compile-vue-sfc.ts";
import { onBenchWorkerMessage, postBenchWorkerResult } from "./bench-worker-runtime.ts";

let component: Awaited<ReturnType<typeof importPrecompiledVueSfc>> | null = null;

async function renderOnce(): Promise<string> {
  component ??= await importPrecompiledVueSfc(competitorSource("spiral", "vue-vdom.vue"), "spiral-vue-vdom");
  const { createSSRApp } = await import("vue");
  const { renderToString } = await import("vue/server-renderer");
  const body = await renderToString(createSSRApp(component));
  return spiralDocumentFromBody(body);
}

onBenchWorkerMessage(async () => {
  try {
    const html = await renderOnce();
    postBenchWorkerResult({ ok: true, html });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    postBenchWorkerResult({ ok: false, error: message });
  }
});
