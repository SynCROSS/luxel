import { describe, expect, test } from "bun:test";
import { evaluateKrausestTier } from "../src/bench/gate.ts";
import type { BenchJsonLine } from "../src/bench/registry.ts";
import { krausestMemoryMetricId, krausestScenarioMetricId } from "../src/bench/krausest/contract.ts";

describe("evaluateKrausestTier", () => {
  test("computes weighted geo-mean from raw krausest_*_ms lines", () => {
    const lines: BenchJsonLine[] = [
      { fixture: "krausest", framework: "luxel", metric: krausestScenarioMetricId("create_rows"), value: 110 },
      { fixture: "krausest", framework: "react", metric: krausestScenarioMetricId("create_rows"), value: 100 },
      { fixture: "krausest", framework: "luxel", metric: krausestScenarioMetricId("clear_rows"), value: 55 },
      { fixture: "krausest", framework: "react", metric: krausestScenarioMetricId("clear_rows"), value: 50 },
    ];
    const tier = evaluateKrausestTier(lines);
    expect(tier.tier).toBe("krausest");
    expect(tier.geo_mean_factor).toBeCloseTo(1.1, 5);
    expect(tier.status).toBe("fail");
  });

  test("memory ceiling fails when luxel exceeds 1.5x fastest", () => {
    const lines: BenchJsonLine[] = [
      { fixture: "krausest", framework: "luxel", metric: krausestScenarioMetricId("create_rows"), value: 100 },
      { fixture: "krausest", framework: "react", metric: krausestScenarioMetricId("create_rows"), value: 100 },
      { fixture: "krausest", framework: "luxel", metric: krausestMemoryMetricId("ready_memory"), value: 20 },
      { fixture: "krausest", framework: "react", metric: krausestMemoryMetricId("ready_memory"), value: 10 },
    ];
    const tier = evaluateKrausestTier(lines);
    expect(tier.status).toBe("fail");
    expect(tier.reason).toContain("memory ceiling");
  });
});
