export type WorkerPoolJob<TResult> = {
  resolve: (value: TResult) => void;
  reject: (reason: Error) => void;
};

export type WorkerDispatchSlot<TPayload> = {
  pending: WorkerPoolJob<unknown>[];
  postMessage: (payload: TPayload) => void;
};

export function createRoundRobinDispatcher(slotCount: number) {
  let nextWorkerIndex = 0;
  return {
    next(): number {
      const index = nextWorkerIndex;
      nextWorkerIndex = (nextWorkerIndex + 1) % slotCount;
      return index;
    },
  };
}

export function rejectAllPending<T>(pending: WorkerPoolJob<T>[], error: Error): void {
  while (pending.length > 0) {
    pending.shift()?.reject(error);
  }
}
