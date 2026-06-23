import "../competitors/bench-env.ts";
import { spiralDocumentFromBody } from "../fixtures/spiral-contract.ts";
import { competitorSource } from "../competitors/sources-path.ts";
import { importPrecompiledSvelteSfc } from "../competitors/compile-svelte-sfc.ts";
import { onBenchWorkerMessage, postBenchWorkerResult } from "./bench-worker-runtime.ts";

let renderFn: Awaited<ReturnType<typeof importPrecompiledSvelteSfc>> | null = null;

async function renderOnce(): Promise<string> {
  renderFn ??= await importPrecompiledSvelteSfc(competitorSource("spiral", "svelte.svelte"), "spiral");
  const body = renderFn().body;
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
