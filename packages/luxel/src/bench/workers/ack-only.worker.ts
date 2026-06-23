import { onBenchWorkerMessage, postBenchWorkerResult } from "./bench-worker-runtime.ts";

onBenchWorkerMessage(() => {
  postBenchWorkerResult({ ok: true });
});
