import { describe, expect, test } from "bun:test";
import { evaluateWinrkGeoGate, WINRK_GEO_GATE_THRESHOLD } from "./winrk-geo-gate.ts";
import type { WinrkBenchResult } from "./registry.ts";

function okRow(id: string, rps: number, framework = id.split("-")[0]!): WinrkBenchResult {
  return {
    id,
    framework,
    mode: "ssr",
    role: "framework",
    gateClass: "framework",
    deploymentTier: id.includes("rsc") || id.includes("sveltekit") || id.includes("solidstart")
      ? "prod-stack"
      : "inline",
    status: "ok",
    fixture: "counter",
    requestsPerSec: rps,
    errorRatePercent: 0,
    winrk: { totalErrors: 0 },
  } as WinrkBenchResult;
}

describe("winrk geo gate", () => {
  test("includes prod-stack competitor rows in fastest denominator", () => {
    const gate = evaluateWinrkGeoGate("counter", [
      okRow("luxel-ssr", 1000, "luxel"),
      okRow("react-ssr", 800, "react"),
      okRow("react-rsc", 1200, "react"),
    ]);
    expect(gate.fastest_rps).toBe(1200);
    expect(gate.luxel_rows[0]?.factor).toBeCloseTo(1.2);
  });

  test("passes when luxel within threshold vs all framework rows", () => {
    const gate = evaluateWinrkGeoGate("counter", [
      okRow("luxel-ssr", 1000, "luxel"),
      okRow("luxel-ssr-worker-pool", 1050, "luxel"),
      okRow("react-ssr", 1100, "react"),
      okRow("sveltekit-ssr", 1080, "sveltekit"),
    ]);
    expect(gate.ok).toBe(true);
    expect(gate.geo_mean_factor).toBeLessThanOrEqual(WINRK_GEO_GATE_THRESHOLD);
  });
});
