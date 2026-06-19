import "../competitors/bench-env.ts";
import { spiralDocumentFromBody } from "../fixtures/spiral-contract.ts";
import { onBenchWorkerMessage, postBenchWorkerResult } from "./bench-worker-runtime.ts";

let SpiralApp: (() => unknown) | null = null;

async function renderOnce(): Promise<string> {
  if (!SpiralApp) {
    const mod = await import("../competitors/sources/spiral/solid.ts");
    SpiralApp = mod.SpiralApp;
  }
  const { renderToString } = await import("solid-js/web");
  const body = renderToString(SpiralApp!) as string;
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
