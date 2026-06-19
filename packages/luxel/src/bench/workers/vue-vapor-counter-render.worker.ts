import "../competitors/bench-env.ts";
import { counterDocumentFromBody } from "../fixtures/counter-contract.ts";
import { competitorSource } from "../competitors/sources-path.ts";
import { importPrecompiledVueSfc } from "../competitors/compile-vue-sfc.ts";
import { onBenchWorkerMessage, postBenchWorkerResult } from "./bench-worker-runtime.ts";

let component: Awaited<ReturnType<typeof importPrecompiledVueSfc>> | null = null;

async function renderOnce(): Promise<string> {
  component ??= await importPrecompiledVueSfc(
    competitorSource("counter", "vue-vapor.vue"),
    "counter-vue-vapor",
    true,
  );
  const { createSSRApp } = await import("vue-vapor");
  const { renderToString } = await import("vue-vapor/server-renderer");
  const body = await renderToString(createSSRApp(component));
  return counterDocumentFromBody(body);
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
