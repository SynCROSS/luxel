import { describe, expect, test } from "bun:test";
import { formatWinrkStackProgress } from "./stack-progress.ts";
import type { WinrkBenchResult } from "./registry.ts";

describe("formatWinrkStackProgress", () => {
  test("formats ok row with rps and p50", () => {
    const row = {
      id: "react-fastify-ssr",
      status: "ok",
      requestsPerSec: 1234.5,
      latencyP50Ms: 2.34,
    } as WinrkBenchResult;
    expect(formatWinrkStackProgress(0, 1, row)).toBe(
      "[1/1] react-fastify-ssr: ok — 1234.50 rps, p50 2.34ms",
    );
  });

  test("formats pending row", () => {
    const row = {
      id: "react-rsc",
      status: "pending",
      reason: "run competitors build",
    } as WinrkBenchResult;
    expect(formatWinrkStackProgress(2, 5, row)).toBe(
      "[3/5] react-rsc: pending — run competitors build",
    );
  });
});
