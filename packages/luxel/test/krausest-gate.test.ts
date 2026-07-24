import { describe, expect, test } from "bun:test";
import { evaluateKrausestTier } from "../src/bench/gate.ts";
import type { BenchJsonLine } from "../src/bench/registry.ts";
import { krausestMemoryMetricId, krausestScenarioMetricId } from "../src/bench/krausest/contract.ts";

const LUXEL = "luxel-v0.0.0-non-keyed";
const REACT = "react-hooks-v19.2.0-keyed";

describe("evaluateKrausestTier", () => {
  test("computes weighted geo-mean from raw krausest_*_ms lines", () => {
    const prev = process.env.LUXEL_KRAUSEST_GATE_ENFORCE;
    process.env.LUXEL_KRAUSEST_GATE_ENFORCE = "1";
    const lines: BenchJsonLine[] = [
      { fixture: "krausest", framework: LUXEL, metric: krausestScenarioMetricId("create_rows"), value: 110 },
      { fixture: "krausest", framework: REACT, metric: krausestScenarioMetricId("create_rows"), value: 100 },
      { fixture: "krausest", framework: LUXEL, metric: krausestScenarioMetricId("clear_rows"), value: 55 },
      { fixture: "krausest", framework: REACT, metric: krausestScenarioMetricId("clear_rows"), value: 50 },
    ];
    const tier = evaluateKrausestTier(lines);
    expect(tier.tier).toBe("krausest");
    expect(tier.geo_mean_factor).toBeCloseTo(1.1, 5);
    expect(tier.status).toBe("inactive");
    expect(tier.reason).toContain("duration geo-mean");
    process.env.LUXEL_KRAUSEST_GATE_ENFORCE = prev;
  });

  test("wiring-only gate reports inactive while duration geo exceeds threshold", () => {
    const prev = process.env.LUXEL_KRAUSEST_GATE_ENFORCE;
    process.env.LUXEL_KRAUSEST_GATE_ENFORCE = "0";
    const lines: BenchJsonLine[] = [
      { fixture: "krausest", framework: LUXEL, metric: krausestScenarioMetricId("create_rows"), value: 110 },
      { fixture: "krausest", framework: REACT, metric: krausestScenarioMetricId("create_rows"), value: 100 },
      { fixture: "krausest", framework: LUXEL, metric: krausestScenarioMetricId("clear_rows"), value: 55 },
      { fixture: "krausest", framework: REACT, metric: krausestScenarioMetricId("clear_rows"), value: 50 },
    ];
    const tier = evaluateKrausestTier(lines);
    expect(tier.status).toBe("inactive");
    expect(tier.geo_mean_factor).toBeCloseTo(1.1, 5);
    process.env.LUXEL_KRAUSEST_GATE_ENFORCE = prev;
  });

  test("memory ceiling fails when luxel exceeds 1.5x fastest", () => {
    const prev = process.env.LUXEL_KRAUSEST_GATE_ENFORCE;
    process.env.LUXEL_KRAUSEST_GATE_ENFORCE = "1";
    const lines: BenchJsonLine[] = [
      { fixture: "krausest", framework: LUXEL, metric: krausestScenarioMetricId("create_rows"), value: 100 },
      { fixture: "krausest", framework: REACT, metric: krausestScenarioMetricId("create_rows"), value: 100 },
      { fixture: "krausest", framework: LUXEL, metric: krausestMemoryMetricId("ready_memory"), value: 20 },
      { fixture: "krausest", framework: REACT, metric: krausestMemoryMetricId("ready_memory"), value: 10 },
    ];
    const tier = evaluateKrausestTier(lines);
    expect(tier.status).toBe("inactive");
    expect(tier.reason).toContain("memory ceiling");
    process.env.LUXEL_KRAUSEST_GATE_ENFORCE = prev;
  });
});
