import "../competitors/bench-env.ts";
import { competitorSource } from "../competitors/sources-path.ts";
import { importPrecompiledSolidTs } from "../competitors/compile-solid-ts.ts";
import { onBenchWorkerMessage, postBenchWorkerResult } from "./bench-worker-runtime.ts";

let counterApp: (() => unknown) | null = null;
let renderToStringFn: ((component: () => unknown) => string) | null = null;

async function ensureSolidSsr(): Promise<void> {
  if (!renderToStringFn) {
    const { renderToString } = await import("solid-js/web");
    renderToStringFn = renderToString as (component: () => unknown) => string;
  }
}

async function renderOnce(): Promise<void> {
  await ensureSolidSsr();
  counterApp ??= await importPrecompiledSolidTs(competitorSource("counter", "solid.ts"), "counter-solid");
  renderToStringFn!(counterApp);
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
