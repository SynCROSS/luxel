import { parentPort, workerData as nodeWorkerData } from "node:worker_threads";

export type BenchWorkerResult =
  | { ok: true; html?: string }
  | { ok: false; error: string };

type GlobalWorkerScope = {
  onmessage?: ((event: MessageEvent<unknown>) => void) | null;
  postMessage?: (message: BenchWorkerResult) => void;
};

export function benchWorkerData<T>(): T {
  return nodeWorkerData as T;
}

export function postBenchWorkerResult(result: BenchWorkerResult): void {
  if (parentPort) {
    parentPort.postMessage(result);
    return;
  }
  (globalThis as GlobalWorkerScope).postMessage?.(result);
}

export function onBenchWorkerMessage(handler: () => void | Promise<void>): void {
  if (parentPort) {
    parentPort.on("message", () => void handler());
    return;
  }
  (globalThis as GlobalWorkerScope).onmessage = () => void handler();
}
