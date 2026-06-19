import "../competitors/bench-env.ts";
import { spiralBodyMarkup } from "../fixtures/spiral-html.ts";
import { onBenchWorkerMessage, postBenchWorkerResult } from "./bench-worker-runtime.ts";

onBenchWorkerMessage(async () => {
  await Promise.resolve();
  try {
    spiralBodyMarkup();
    postBenchWorkerResult({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    postBenchWorkerResult({ ok: false, error: message });
  }
});
