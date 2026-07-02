import { availableParallelism, cpus } from "node:os";
import {
  createRoundRobinDispatcher,
  rejectAllPending,
  type WorkerDispatchSlot,
  type WorkerPoolJob,
} from "./worker-round-robin-dispatch.ts";

export type BenchRenderWorkerPool = {
  run: () => Promise<string>;
  /** Compile/render once per worker before load testing. */
  warmup: () => Promise<void>;
  close: () => Promise<void>;
};

export type BenchRenderWorkerPoolOptions = {
  /** One warmup job at a time ??avoids parallel compile races on shared bench artifacts. */
  sequentialWarmup?: boolean;
  /** Worker may ack without html; pool resolves with this shared document. */
  pooledHtml?: string;
};

type WorkerResult =
  | { ok: true; html?: string }
  | { ok: false; error: string };

type RenderWorkerSlot = WorkerDispatchSlot<null> & { worker: Worker };

function wireRenderWorkerSlot(
  slot: RenderWorkerSlot,
  options: BenchRenderWorkerPoolOptions,
): void {
  slot.worker.addEventListener("message", (event: MessageEvent<WorkerResult>) => {
    const job = slot.pending.shift() as WorkerPoolJob<string> | undefined;
    if (!job) return;
    const data = event.data;
    if (data.ok) job.resolve(data.html ?? options.pooledHtml ?? "");
    else job.reject(new Error(data.error));
  });
  slot.worker.addEventListener("error", (event) => {
    const err = event.error instanceof Error ? event.error : new Error(String(event.error));
    rejectAllPending(slot.pending as WorkerPoolJob<string>[], err);
  });
}

function poolSizeFromEnv(): number {
  const raw = process.env.BENCH_RENDER_WORKER_COUNT;
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  const nav = globalThis.navigator as { hardwareConcurrency?: number } | undefined;
  if (nav?.hardwareConcurrency && nav.hardwareConcurrency > 0) {
    return nav.hardwareConcurrency;
  }
  return availableParallelism() ?? cpus().length;
}

export function benchRenderWorkerCount(): number {
  return poolSizeFromEnv();
}

export type BenchWorkerPoolFixture = "counter" | "spiral";

/** Upper bound when bisecting counter worker counts (min with hardwareConcurrency). */
export const COUNTER_RENDER_WORKER_SEARCH_CAP = 12;

/** WinRK-tuned smallest count passing react-ssr-worker-pool ??react-ssr gate. */
export const COUNTER_RENDER_WORKER_CAP = 1;

/** Testable default sizing ??env override handled by benchRenderWorkerCountForFixture. */
export function benchRenderWorkerCountForHardwareConcurrency(
  hardwareConcurrency: number,
  fixture: BenchWorkerPoolFixture,
): number {
  if (fixture === "spiral") return hardwareConcurrency;
  return COUNTER_RENDER_WORKER_CAP;
}

export function benchRenderWorkerCountForFixture(fixture: BenchWorkerPoolFixture): number {
  const raw = process.env.BENCH_RENDER_WORKER_COUNT;
  if (raw !== undefined && raw !== "") {
    return benchRenderWorkerCount();
  }
  return benchRenderWorkerCountForHardwareConcurrency(benchRenderWorkerCount(), fixture);
}

export function createBenchRenderWorkerPool(
  workerUrl: string | URL,
  workerData: unknown,
  size = benchRenderWorkerCount(),
  options: BenchRenderWorkerPoolOptions = {},
): BenchRenderWorkerPool {
  const slots: RenderWorkerSlot[] = [];
  const dispatch = createRoundRobinDispatcher(size);

  for (let i = 0; i < size; i++) {
    const worker = new Worker(workerUrl, {
      workerData:
        workerData !== null && typeof workerData === "object"
          ? { ...workerData, workerIndex: i }
          : { workerData, workerIndex: i },
    });
    const slot: RenderWorkerSlot = { worker, pending: [], postMessage: () => worker.postMessage(null) };
    wireRenderWorkerSlot(slot, options);
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
      await Promise.allSettled(slots.map((slot) => Promise.resolve(slot.worker.terminate())));
      slots.length = 0;
    },
  };
  return pool;
}
