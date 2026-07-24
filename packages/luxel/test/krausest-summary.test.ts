import { describe, expect, test } from "bun:test";
import { evaluateKrausestTier } from "../src/bench/gate.ts";
import type { BenchJsonLine } from "../src/bench/registry.ts";
import { formatKrausestRowsSummary, summarizeKrausestDriverFailure } from "../src/bench/krausest/summary.ts";

const SAMPLE_DRIVER_FAIL = `krausest benchmarkRunner exit 1:
PLEASE MAKE SURE THAT YOUR MOUSE IS OUTSIDE OF THE BROWSER WINDOW - and sorry for shouting :-)
Executing frameworks/non-keyed/luxel and benchmark 21_ready-memory failed: SecurityError: Failed to execute 'measureUserAgentSpecificMemory' on 'Performance': performance.measureUserAgentSpecificMemory is not available.
Executing frameworks/non-keyed/luxel and benchmark 22_run-memory failed: SecurityError: Failed to execute 'measureUserAgentSpecificMemory' on 'Performance': performance.measureUserAgentSpecificMemory is not available.
Error: Cannot compute stats on empty array
run was not completely sucessful Benchmarking failed with errors`;

describe("summarizeKrausestDriverFailure", () => {
  test("strips mouse warning and upstream log noise", () => {
    const summary = summarizeKrausestDriverFailure(SAMPLE_DRIVER_FAIL);
    expect(summary).toContain("driver exit 1");
    expect(summary).toContain("frameworks: non-keyed/luxel");
    expect(summary).toContain("21_ready-memory");
    expect(summary).toContain("measureUserAgentSpecificMemory");
    expect(summary).not.toContain("MOUSE IS OUTSIDE");
    expect(summary.length).toBeLessThan(500);
  });

  test("does not double-prefix krausest on framework build failures", () => {
    const summary = summarizeKrausestDriverFailure(
      "krausest framework build failed:\n> halogen build-prod\n(node:1) [DEP0190] DeprecationWarning: shell option true",
    );
    expect(summary.startsWith("krausest krausest")).toBe(false);
    expect(summary).toContain("framework build failed");
  });
});

describe("formatKrausestRowsSummary", () => {
  test("formats transfer rows in kb", () => {
    const summary = formatKrausestRowsSummary([
      {
        framework: "luxel-v0.0.0-non-keyed",
        scenario: "uncompressed_size",
        durationMs: 0,
        transferKb: 30.7,
      },
    ]);
    expect(summary).toContain("uncompressed_size=30.7kb");
  });
});

describe("evaluateKrausestTier runner reason", () => {
  test("surfaces krausest runner pending reason instead of generic wired message", () => {
    const reason = summarizeKrausestDriverFailure(SAMPLE_DRIVER_FAIL);
    const lines: BenchJsonLine[] = [
      { fixture: "krausest", metric: "runner", status: "pending", reason },
    ];
    const tier = evaluateKrausestTier(lines);
    expect(tier.reason).toBe(reason);
    expect(tier.reason).not.toBe("krausest scenarios not wired");
  });
});
