import { describe, expect, test } from "bun:test";
import { waitForServerReady } from "@luxel/luxel/bench";
import { runWinrk } from "./run.ts";
import { resolveWinrk } from "./resolve.ts";
import { startReactSsrWorkerPoolServer } from "./servers/inline-ssr-pooled.ts";

function canRunWinrk(): boolean {
  try {
    resolveWinrk();
    return true;
  } catch {
    return false;
  }
}

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

describe("react-ssr-worker-pool winrk smoke", () => {
  test("high concurrency load emits no MaxListeners warning", async () => {
    if (!canRunWinrk()) return;

    const previousBackend = process.env.BENCH_RENDER_WORKER_BACKEND;
    const previousCount = process.env.BENCH_RENDER_WORKER_COUNT;
    process.env.BENCH_RENDER_WORKER_BACKEND = "bun";
    process.env.BENCH_RENDER_WORKER_COUNT = "1";

    const warnings = captureProcessWarnings();
    const server = await startReactSsrWorkerPoolServer();
    try {
      await waitForServerReady(server.url);
      const stats = await runWinrk({
        url: server.url,
        durationSec: 8,
        connections: 400,
        threads: 8,
      });
      expect(stats.errorRatePercent).toBe(0);
      expect(warnings.messages.some((message) => message.includes("MaxListeners"))).toBe(false);
    } finally {
      await server.close();
      warnings.stop();
      if (previousBackend === undefined) delete process.env.BENCH_RENDER_WORKER_BACKEND;
      else process.env.BENCH_RENDER_WORKER_BACKEND = previousBackend;
      if (previousCount === undefined) delete process.env.BENCH_RENDER_WORKER_COUNT;
      else process.env.BENCH_RENDER_WORKER_COUNT = previousCount;
    }
  }, 180_000);
});
