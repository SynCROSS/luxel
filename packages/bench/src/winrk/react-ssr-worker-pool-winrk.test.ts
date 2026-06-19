import { describe, expect, test } from "bun:test";
import "./apply-bench-host-env.ts";
import { runWinrkStack, WINRK_COUNTER_STACKS } from "./registry.ts";
import { resolveWinrk } from "./resolve.ts";

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

    const row = WINRK_COUNTER_STACKS.find((stack) => stack.id === "react-ssr-worker-pool");
    if (!row) throw new Error("react-ssr-worker-pool missing from registry");

    const previousBackend = process.env.BENCH_RENDER_WORKER_BACKEND;
    const previousCount = process.env.BENCH_RENDER_WORKER_COUNT;
    const previousDuration = process.env.WINRK_DURATION;
    process.env.BENCH_RENDER_WORKER_BACKEND = "bun";
    process.env.BENCH_RENDER_WORKER_COUNT = "1";
    process.env.WINRK_DURATION = "8";

    const warnings = captureProcessWarnings();
    try {
      const result = await runWinrkStack(row);
      expect(result.status).toBe("ok");
      expect(result.errorRatePercent).toBe(0);
      expect(warnings.messages.some((message) => message.includes("MaxListeners"))).toBe(false);
    } finally {
      warnings.stop();
      if (previousBackend === undefined) delete process.env.BENCH_RENDER_WORKER_BACKEND;
      else process.env.BENCH_RENDER_WORKER_BACKEND = previousBackend;
      if (previousCount === undefined) delete process.env.BENCH_RENDER_WORKER_COUNT;
      else process.env.BENCH_RENDER_WORKER_COUNT = previousCount;
      if (previousDuration === undefined) delete process.env.WINRK_DURATION;
      else process.env.WINRK_DURATION = previousDuration;
    }
  }, 180_000);
});
