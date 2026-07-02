import { describe, expect, test } from "bun:test";
import {
  applyDefaultBenchRenderWorkerBackendEnv,
  resolveBenchRenderWorkerBackend,
} from "@luxel/luxel/bench";

describe("bench render worker backend", () => {
  test("applyDefaultBenchRenderWorkerBackendEnv pins env when unset", () => {
    const previous = process.env.BENCH_RENDER_WORKER_BACKEND;
    delete process.env.BENCH_RENDER_WORKER_BACKEND;
    try {
      applyDefaultBenchRenderWorkerBackendEnv();
      expect(process.env.BENCH_RENDER_WORKER_BACKEND).toBe(
        process.platform === "win32" ? "node" : "bun",
      );
      expect(resolveBenchRenderWorkerBackend()).toBe(
        process.platform === "win32" ? "node" : "bun",
      );
    } finally {
      if (previous === undefined) delete process.env.BENCH_RENDER_WORKER_BACKEND;
      else process.env.BENCH_RENDER_WORKER_BACKEND = previous;
    }
  });

  test("explicit BENCH_RENDER_WORKER_BACKEND wins over platform default", () => {
    const previous = process.env.BENCH_RENDER_WORKER_BACKEND;
    process.env.BENCH_RENDER_WORKER_BACKEND = "bun";
    try {
      expect(resolveBenchRenderWorkerBackend()).toBe("bun");
      applyDefaultBenchRenderWorkerBackendEnv();
      expect(process.env.BENCH_RENDER_WORKER_BACKEND).toBe("bun");
    } finally {
      if (previous === undefined) delete process.env.BENCH_RENDER_WORKER_BACKEND;
      else process.env.BENCH_RENDER_WORKER_BACKEND = previous;
    }
  });
});
