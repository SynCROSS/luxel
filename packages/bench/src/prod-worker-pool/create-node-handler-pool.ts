import { benchRenderWorkerCountForFixture, benchUsesNodeRenderWorkers } from "@luxel/luxel/bench";
import { Worker as NodeWorker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import type { SerializedNodeRequest } from "./serialize-node-request.ts";
import type { CapturedNodeResponse } from "./capture-node-response.ts";
import {
  createRoundRobinDispatcher,
  rejectAllPending,
  type WorkerDispatchSlot,
  type WorkerPoolJob,
} from "@luxel/luxel/bench";

export type NodeHandlerWorkerPool = {
  run: (req: SerializedNodeRequest) => Promise<CapturedNodeResponse>;
  close: () => Promise<void>;
};

type WorkerResult =
  | { ok: true; statusCode: number; headers: Record<string, string | string[] | undefined>; bodyBase64: string }
  | { ok: false; error: string };

type HandlerWorkerSlot = WorkerDispatchSlot<SerializedNodeRequest> & {
  terminate: () => Promise<unknown> | void;
};

function captureFromResult(data: WorkerResult): CapturedNodeResponse {
  if (!data.ok) throw new Error(data.error);
  return {
    statusCode: data.statusCode,
    headers: data.headers,
    body: Buffer.from(data.bodyBase64, "base64"),
  };
}

function createHandlerWorkerSlot(workerUrl: URL, bootstrapPath: string, workerIndex: number): HandlerWorkerSlot {
  if (benchUsesNodeRenderWorkers()) {
    const worker = new NodeWorker(fileURLToPath(workerUrl), {
      workerData: { bootstrapPath, workerIndex },
    });
    const slot: HandlerWorkerSlot = {
      pending: [],
      postMessage: (req) => worker.postMessage(req),
      terminate: () => worker.terminate(),
    };
    worker.on("message", (data: WorkerResult) => {
      const job = slot.pending.shift() as WorkerPoolJob<CapturedNodeResponse> | undefined;
      if (!job) return;
      try {
        job.resolve(captureFromResult(data));
      } catch (err) {
        job.reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
    worker.on("error", (err) => {
      const error = err instanceof Error ? err : new Error(String(err));
      rejectAllPending(slot.pending as WorkerPoolJob<CapturedNodeResponse>[], error);
    });
    return slot;
  }

  const worker = new Worker(workerUrl, { workerData: { bootstrapPath, workerIndex } });
  const slot: HandlerWorkerSlot = {
    pending: [],
    postMessage: (req) => worker.postMessage(req),
    terminate: () => worker.terminate(),
  };
  worker.addEventListener("message", (event: MessageEvent<WorkerResult>) => {
    const job = slot.pending.shift() as WorkerPoolJob<CapturedNodeResponse> | undefined;
    if (!job) return;
    try {
      job.resolve(captureFromResult(event.data));
    } catch (err) {
      job.reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
  worker.addEventListener("error", (event) => {
    const err = event.error instanceof Error ? event.error : new Error(String(event.error));
    rejectAllPending(slot.pending as WorkerPoolJob<CapturedNodeResponse>[], err);
  });
  return slot;
}

export function createNodeHandlerWorkerPool(
  bootstrapPath: string,
  size = benchRenderWorkerCountForFixture("counter"),
): NodeHandlerWorkerPool {
  const workerUrl = new URL("./node-prod-handler.worker.ts", import.meta.url);
  const slots: HandlerWorkerSlot[] = [];
  const dispatch = createRoundRobinDispatcher(size);

  for (let i = 0; i < size; i++) {
    slots.push(createHandlerWorkerSlot(workerUrl, bootstrapPath, i));
  }

  return {
    run(req) {
      return new Promise<CapturedNodeResponse>((resolve, reject) => {
        const slot = slots[dispatch.next()]!;
        slot.pending.push({ resolve, reject });
        slot.postMessage(req);
      });
    },
    async close() {
      for (const slot of slots) {
        rejectAllPending(
          slot.pending as WorkerPoolJob<CapturedNodeResponse>[],
          new Error("node handler worker pool closed"),
        );
      }
      await Promise.allSettled(slots.map((slot) => Promise.resolve(slot.terminate())));
      slots.length = 0;
    },
  };
}
