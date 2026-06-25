import { describe, expect, test } from "bun:test";
import { stackObservabilityFromResult } from "./run-output.ts";
import type { WinrkBenchResult } from "./registry.ts";

describe("stackObservabilityFromResult", () => {
  test("ok row includes parsed metrics and raw load-tester output", () => {
    const row = {
      id: "react-fastify-ssr",
      status: "ok",
      requestsPerSec: 1234.5,
      latencyP50Ms: 2.3,
      latencyP95Ms: 4.5,
      errorRatePercent: 0,
      winrk: { requestsPerSec: 1234.5, raw: "Requests/sec: 1234.50" },
    } as WinrkBenchResult;

    expect(stackObservabilityFromResult(row, "2026-01-01T00:00:00.000Z")).toEqual({
      stackId: "react-fastify-ssr",
      status: "ok",
      generatedAt: "2026-01-01T00:00:00.000Z",
      requestsPerSec: 1234.5,
      latencyP50Ms: 2.3,
      latencyP95Ms: 4.5,
      errorRatePercent: 0,
      raw: "Requests/sec: 1234.50",
    });
  });

  test("pending row keeps reason without metrics", () => {
    const row = {
      id: "react-rsc",
      status: "pending",
      reason: "run competitors build",
    } as WinrkBenchResult;

    expect(stackObservabilityFromResult(row, "2026-01-01T00:00:00.000Z")).toEqual({
      stackId: "react-rsc",
      status: "pending",
      generatedAt: "2026-01-01T00:00:00.000Z",
      reason: "run competitors build",
    });
  });
});
