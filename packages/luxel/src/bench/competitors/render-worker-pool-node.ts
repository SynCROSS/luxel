import { Worker as NodeWorker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import {
  benchRenderWorkerCount,
  type BenchRenderWorkerPool,
  type BenchRenderWorkerPoolOptions,
} from "./render-worker-pool.ts";
import {
  createRoundRobinDispatcher,
  rejectAllPending,
  type WorkerDispatchSlot,
  type WorkerPoolJob,
} from "./worker-round-robin-dispatch.ts";

type WorkerResult =
  | { ok: true; html?: string }
  | { ok: false; error: string };
type NodeRenderWorkerSlot = WorkerDispatchSlot<null> & { worker: NodeWorker };

function workerEntry(workerUrl: string | URL): string {
  if (workerUrl instanceof URL) return fileURLToPath(workerUrl);
  if (workerUrl.startsWith("file:")) return fileURLToPath(workerUrl);
  return workerUrl;
}

function wireNodeRenderWorkerSlot(
  slot: NodeRenderWorkerSlot,
  options: BenchRenderWorkerPoolOptions,
): void {
  slot.worker.on("message", (data: WorkerResult) => {
    const job = slot.pending.shift() as WorkerPoolJob<string> | undefined;
    if (!job) return;
    if (data.ok) job.resolve(data.html ?? options.pooledHtml ?? "");
    else job.reject(new Error(data.error));
  });
  slot.worker.on("error", (err) => {
    const error = err instanceof Error ? err : new Error(String(err));
    rejectAllPending(slot.pending as WorkerPoolJob<string>[], error);
  });
}

/** node:worker_threads pool — avoids Bun Worker + luxel compile crash under WinRK load on Windows. */
export function createNodeBenchRenderWorkerPool(
  workerUrl: string | URL,
  workerData: unknown,
  size = benchRenderWorkerCount(),
  options: BenchRenderWorkerPoolOptions = {},
): BenchRenderWorkerPool {
  const slots: NodeRenderWorkerSlot[] = [];
  const dispatch = createRoundRobinDispatcher(size);
  const entry = workerEntry(workerUrl);

  for (let i = 0; i < size; i++) {
    const worker = new NodeWorker(entry, {
      workerData:
        workerData !== null && typeof workerData === "object"
          ? { ...workerData, workerIndex: i }
          : { workerData, workerIndex: i },
    });
    const slot: NodeRenderWorkerSlot = {
      worker,
      pending: [],
      postMessage: () => worker.postMessage(null),
    };
    wireNodeRenderWorkerSlot(slot, options);
    slots.push(slot);
  }

  const pool: BenchRenderWorkerPool = {
    run() {
      return new Promise<string>((resolve, reject) => {
        const slot = slots[dispatch.next()]!;
        slot.pending.push({ resolve, reject });
        slot.postMessage(null);
      });
    },
    async warmup() {
      if (options.sequentialWarmup) {
        for (let i = 0; i < slots.length; i++) await pool.run();
        return;
      }
      await Promise.all(slots.map(() => pool.run()));
    },
    async close() {
      for (const slot of slots) {
        rejectAllPending(slot.pending as WorkerPoolJob<string>[], new Error("render worker pool closed"));
      }
      await Promise.allSettled(slots.map((slot) => slot.worker.terminate()));
      slots.length = 0;
    },
  };
  return pool;
}
