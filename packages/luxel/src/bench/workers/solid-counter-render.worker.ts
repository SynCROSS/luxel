import "../competitors/bench-env.ts";
import { counterDocumentFromBody } from "../fixtures/counter-contract.ts";
import { onBenchWorkerMessage, postBenchWorkerResult } from "./bench-worker-runtime.ts";

let CounterApp: (() => unknown) | null = null;

async function renderOnce(): Promise<string> {
  if (!CounterApp) {
    const mod = await import("../competitors/sources/counter/solid.ts");
    CounterApp = mod.CounterApp;
  }
  const { renderToString } = await import("solid-js/web");
  const body = renderToString(CounterApp!) as string;
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
