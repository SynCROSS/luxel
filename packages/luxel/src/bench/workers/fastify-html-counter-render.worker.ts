import "../competitors/bench-env.ts";
import { onBenchWorkerMessage, postBenchWorkerResult } from "./bench-worker-runtime.ts";

onBenchWorkerMessage(async () => {
  await Promise.resolve();
  postBenchWorkerResult({ ok: true });
});
