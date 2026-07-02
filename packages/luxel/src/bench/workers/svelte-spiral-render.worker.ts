import "../competitors/bench-env.ts";
import { competitorSource } from "../competitors/sources-path.ts";
import { importPrecompiledSvelteSfc } from "../competitors/compile-svelte-sfc.ts";
import { onBenchWorkerMessage, postBenchWorkerResult } from "./bench-worker-runtime.ts";

let renderFn: Awaited<ReturnType<typeof importPrecompiledSvelteSfc>> | null = null;

async function renderOnce(): Promise<void> {
  renderFn ??= await importPrecompiledSvelteSfc(competitorSource("spiral", "svelte.svelte"), "spiral");
  renderFn();
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
