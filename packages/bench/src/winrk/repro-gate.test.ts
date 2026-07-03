import { describe, expect, test } from "bun:test";
import { evaluateWinrkReproGate } from "./repro-gate.ts";
import type { WinrkBenchResult } from "./registry.ts";

const okRow = (id: string): WinrkBenchResult =>
  ({
    id,
    framework: "luxel",
    mode: "ssr",
    role: "framework",
    optimizations: [],
    status: "ok",
    url: "http://127.0.0.1:1",
    requestsPerSec: 1,
    errorRatePercent: 0,
    responseBytes: 1,
    responseBytesLabel: "1 B",
    resources: { cpuAvgPercent: 0, cpuPeakPercent: 0, memoryAvgMb: 0, memoryPeakMb: 0, samples: [] },
    latencySample: { sampleCount: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0 },
    winrk: { requestsPerSec: 1, errorRatePercent: 0, totalRequests: 1, totalErrors: 0 },
  }) as WinrkBenchResult;

describe("evaluateWinrkReproGate", () => {
  test("fails incomplete fixture", () => {
    const gate = evaluateWinrkReproGate("spiral", [okRow("static-http-spiral")]);
    expect(gate.ok).toBe(false);
    expect(gate.failures.some((f) => f.id === "luxel-spiral-ssr")).toBe(true);
  });

  test("fails pending framework row", () => {
    const gate = evaluateWinrkReproGate("counter", [
      {
        id: "react-rsc",
        framework: "next",
        mode: "rsc",
        role: "framework",
        optimizations: [],
        status: "pending",
        reason: "run competitors build",
      },
    ]);
    expect(gate.ok).toBe(false);
    expect(gate.failures.some((f) => f.id === "react-rsc" && f.reason.startsWith("pending:"))).toBe(
      true,
    );
  });

  test("fails framework row with winrk error count", () => {
    const row = okRow("luxel-ssr-worker-pool");
    row.winrk.totalErrors = 5;
    const gate = evaluateWinrkReproGate("counter", [row]);
    expect(gate.ok).toBe(false);
    expect(
      gate.failures.find((f) => f.id === "luxel-ssr-worker-pool")?.reason,
    ).toContain("5");
  });

  test("fails framework row with winrk error rate when count is unavailable", () => {
    const row = okRow("luxel-ssr-worker-pool");
    row.winrk.totalErrors = undefined;
    row.errorRatePercent = 5;
    const gate = evaluateWinrkReproGate("counter", [row]);
    expect(gate.ok).toBe(false);
    expect(
      gate.failures.find((f) => f.id === "luxel-ssr-worker-pool")?.reason,
    ).toContain("5%");
  });
});
