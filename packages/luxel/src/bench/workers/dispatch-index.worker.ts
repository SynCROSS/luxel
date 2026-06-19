import {
  benchWorkerData,
  onBenchWorkerMessage,
  postBenchWorkerResult,
} from "./bench-worker-runtime.ts";

onBenchWorkerMessage(() => {
  const { workerIndex } = benchWorkerData<{ workerIndex: number }>();
  postBenchWorkerResult({ ok: true, html: `worker:${workerIndex}` });
});
