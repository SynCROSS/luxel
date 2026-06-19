import { describe, expect, test } from "bun:test";
import { createBenchRenderWorkerPool, benchRenderWorkerCountForFixture, benchRenderWorkerCountForHardwareConcurrency } from "../src/bench/competitors/render-worker-pool.ts";
import { createSelectedBenchRenderWorkerPool } from "../src/bench/luxel-bench-render-pool.ts";

const echoWorkerUrl = new URL("../src/bench/workers/echo.worker.ts", import.meta.url);

function captureProcessWarnings() {
  const messages: string[] = [];
  const onWarning = (warning: Error) => {
    messages.push(warning.message);
  };
  process.on("warning", onWarning);
  return {
    messages,
    stop() {
      process.off("warning", onWarning);
    },
  };
}

function expectNoMaxListenersWarning(messages: string[]) {
  expect(messages.some((message) => message.includes("MaxListeners"))).toBe(false);
}

describe("bench render worker pool", () => {
  test("dispatches jobs to bun workers", async () => {
    process.env.BENCH_RENDER_WORKER_COUNT = "2";
    const pool = createBenchRenderWorkerPool(
      new URL("../src/bench/workers/echo.worker.ts", import.meta.url),
      {},
      2,
    );
    try {
      const html = await pool.run();
      expect(html).toContain("wrapper");
    } finally {
      await pool.close();
    }
  });

  test("dispatches sequential jobs round-robin across workers", async () => {
    const pool = createBenchRenderWorkerPool(
      new URL("../src/bench/workers/dispatch-index.worker.ts", import.meta.url),
      {},
      3,
    );
    try {
      const indices: number[] = [];
      for (let i = 0; i < 6; i++) {
        const html = await pool.run();
        indices.push(Number(html.replace("worker:", "")));
      }
      expect(indices).toEqual([0, 1, 2, 0, 1, 2]);
    } finally {
      await pool.close();
    }
  });

  test("dispatches jobs through selected node worker backend", async () => {
    const previousBackend = process.env.BENCH_RENDER_WORKER_BACKEND;
    process.env.BENCH_RENDER_WORKER_BACKEND = "node";
    const pool = createSelectedBenchRenderWorkerPool(
      new URL("../src/bench/workers/echo.worker.ts", import.meta.url),
      {},
    );
    try {
      const html = await pool.run();
      expect(html).toContain("wrapper");
    } finally {
      await pool.close();
      if (previousBackend === undefined) delete process.env.BENCH_RENDER_WORKER_BACKEND;
      else process.env.BENCH_RENDER_WORKER_BACKEND = previousBackend;
    }
  });

  test("dispatches sequential jobs round-robin through node worker backend", async () => {
    const previousBackend = process.env.BENCH_RENDER_WORKER_BACKEND;
    const previousCount = process.env.BENCH_RENDER_WORKER_COUNT;
    process.env.BENCH_RENDER_WORKER_BACKEND = "node";
    process.env.BENCH_RENDER_WORKER_COUNT = "3";
    const pool = createSelectedBenchRenderWorkerPool(
      new URL("../src/bench/workers/dispatch-index.worker.ts", import.meta.url),
      {},
    );
    try {
      const indices: number[] = [];
      for (let i = 0; i < 6; i++) {
        const html = await pool.run();
        indices.push(Number(html.replace("worker:", "")));
      }
      expect(indices).toEqual([0, 1, 2, 0, 1, 2]);
    } finally {
      await pool.close();
      if (previousBackend === undefined) delete process.env.BENCH_RENDER_WORKER_BACKEND;
      else process.env.BENCH_RENDER_WORKER_BACKEND = previousBackend;
      if (previousCount === undefined) delete process.env.BENCH_RENDER_WORKER_COUNT;
      else process.env.BENCH_RENDER_WORKER_COUNT = previousCount;
    }
  });

  test("single worker resolves many concurrent jobs", async () => {
    const pool = createBenchRenderWorkerPool(
      new URL("../src/bench/workers/echo.worker.ts", import.meta.url),
      {},
      1,
    );
    try {
      const results = await Promise.all(Array.from({ length: 24 }, () => pool.run()));
      expect(results).toHaveLength(24);
      for (const html of results) expect(html).toContain("wrapper");
    } finally {
      await pool.close();
    }
  });

  test("single node worker resolves many concurrent jobs", async () => {
    const previousBackend = process.env.BENCH_RENDER_WORKER_BACKEND;
    process.env.BENCH_RENDER_WORKER_BACKEND = "node";
    const pool = createSelectedBenchRenderWorkerPool(
      new URL("../src/bench/workers/echo.worker.ts", import.meta.url),
      {},
      1,
    );
    try {
      const results = await Promise.all(Array.from({ length: 24 }, () => pool.run()));
      expect(results).toHaveLength(24);
      for (const html of results) expect(html).toContain("wrapper");
    } finally {
      await pool.close();
      if (previousBackend === undefined) delete process.env.BENCH_RENDER_WORKER_BACKEND;
      else process.env.BENCH_RENDER_WORKER_BACKEND = previousBackend;
    }
  });

  test("single bun worker concurrent jobs emit no MaxListeners warning", async () => {
    const warnings = captureProcessWarnings();
    const pool = createBenchRenderWorkerPool(echoWorkerUrl, {}, 1);
    try {
      await Promise.all(Array.from({ length: 24 }, () => pool.run()));
      expectNoMaxListenersWarning(warnings.messages);
    } finally {
      await pool.close();
      warnings.stop();
    }
  });

  test("single node worker concurrent jobs emit no MaxListeners warning", async () => {
    const previousBackend = process.env.BENCH_RENDER_WORKER_BACKEND;
    process.env.BENCH_RENDER_WORKER_BACKEND = "node";
    const warnings = captureProcessWarnings();
    const pool = createSelectedBenchRenderWorkerPool(echoWorkerUrl, {}, 1);
    try {
      await Promise.all(Array.from({ length: 24 }, () => pool.run()));
      expectNoMaxListenersWarning(warnings.messages);
    } finally {
      await pool.close();
      warnings.stop();
      if (previousBackend === undefined) delete process.env.BENCH_RENDER_WORKER_BACKEND;
      else process.env.BENCH_RENDER_WORKER_BACKEND = previousBackend;
    }
  });

  test("resolves pooledHtml when worker acks without html", async () => {
    const pooledHtml = "<html>pooled</html>";
    const pool = createBenchRenderWorkerPool(
      new URL("../src/bench/workers/ack-only.worker.ts", import.meta.url),
      {},
      2,
      { pooledHtml },
    );
    try {
      expect(await pool.run()).toBe(pooledHtml);
    } finally {
      await pool.close();
    }
  });

  test("counter fixture defaults to one worker for micro-render parity", () => {
    expect(benchRenderWorkerCountForHardwareConcurrency(16, "counter")).toBe(1);
    expect(benchRenderWorkerCountForHardwareConcurrency(8, "counter")).toBe(1);
    expect(benchRenderWorkerCountForHardwareConcurrency(16, "spiral")).toBe(16);
  });

  test("BENCH_RENDER_WORKER_COUNT env overrides counter cap", () => {
    const previous = process.env.BENCH_RENDER_WORKER_COUNT;
    process.env.BENCH_RENDER_WORKER_COUNT = "16";
    try {
      expect(benchRenderWorkerCountForFixture("counter")).toBe(16);
    } finally {
      if (previous === undefined) delete process.env.BENCH_RENDER_WORKER_COUNT;
      else process.env.BENCH_RENDER_WORKER_COUNT = previous;
    }
  });
});
