import { describe, expect, test } from "bun:test";
import { availableParallelism, cpus } from "node:os";
import { benchRenderWorkerCount, winrkDefaultThreads } from "./hardware-concurrency.ts";

function expectedHardwareConcurrency(): number {
  const nav = globalThis.navigator as { hardwareConcurrency?: number } | undefined;
  if (nav?.hardwareConcurrency && nav.hardwareConcurrency > 0) {
    return nav.hardwareConcurrency;
  }
  return availableParallelism() ?? cpus().length;
}

describe("bench hardware concurrency", () => {
  test("winrk default threads matches navigator.hardwareConcurrency when env unset", () => {
    const prevWinrk = process.env.WINRK_THREADS;
    const prevPool = process.env.BENCH_RENDER_WORKER_COUNT;
    delete process.env.WINRK_THREADS;
    delete process.env.BENCH_RENDER_WORKER_COUNT;
    try {
      expect(winrkDefaultThreads()).toBe(expectedHardwareConcurrency());
    } finally {
      if (prevWinrk === undefined) delete process.env.WINRK_THREADS;
      else process.env.WINRK_THREADS = prevWinrk;
      if (prevPool === undefined) delete process.env.BENCH_RENDER_WORKER_COUNT;
      else process.env.BENCH_RENDER_WORKER_COUNT = prevPool;
    }
  });

  test("render worker count matches winrk default when env unset", () => {
    const prevWinrk = process.env.WINRK_THREADS;
    const prevPool = process.env.BENCH_RENDER_WORKER_COUNT;
    delete process.env.WINRK_THREADS;
    delete process.env.BENCH_RENDER_WORKER_COUNT;
    try {
      expect(benchRenderWorkerCount()).toBe(winrkDefaultThreads());
    } finally {
      if (prevWinrk === undefined) delete process.env.WINRK_THREADS;
      else process.env.WINRK_THREADS = prevWinrk;
      if (prevPool === undefined) delete process.env.BENCH_RENDER_WORKER_COUNT;
      else process.env.BENCH_RENDER_WORKER_COUNT = prevPool;
    }
  });

  test("WINRK_THREADS env overrides default", () => {
    const prev = process.env.WINRK_THREADS;
    process.env.WINRK_THREADS = "3";
    try {
      expect(winrkDefaultThreads()).toBe(3);
    } finally {
      if (prev === undefined) delete process.env.WINRK_THREADS;
      else process.env.WINRK_THREADS = prev;
    }
  });
});
