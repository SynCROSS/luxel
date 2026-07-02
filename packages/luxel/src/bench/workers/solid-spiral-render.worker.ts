import "../competitors/bench-env.ts";
import { competitorSource } from "../competitors/sources-path.ts";
import { importPrecompiledSolidTs } from "../competitors/compile-solid-ts.ts";
import { onBenchWorkerMessage, postBenchWorkerResult } from "./bench-worker-runtime.ts";

let spiralApp: (() => unknown) | null = null;
let renderToStringFn: ((component: () => unknown) => string) | null = null;

async function ensureSolidSsr(): Promise<void> {
  if (!renderToStringFn) {
    const { renderToString } = await import("solid-js/web");
    renderToStringFn = renderToString as (component: () => unknown) => string;
  }
}

async function renderOnce(): Promise<void> {
  await ensureSolidSsr();
  spiralApp ??= await importPrecompiledSolidTs(competitorSource("spiral", "solid.ts"), "spiral-solid");
  renderToStringFn!(spiralApp);
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
