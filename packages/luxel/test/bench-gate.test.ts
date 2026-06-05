import { describe, expect, test } from "bun:test";
import {
  BENCH_GATE_THRESHOLD,
  evaluateBenchGate,
  evaluateSsrTier,
  geometricMean,
} from "../src/bench/gate.ts";
import type { BenchJsonLine } from "../src/bench/registry.ts";

describe("bench gate", () => {
  test("geometricMean computes ratio product", () => {
    expect(geometricMean([1, 1.08])).toBeCloseTo(1.039, 2);
    expect(geometricMean([2])).toBe(2);
  });

  test("ssr tier passes when luxel within 8% of fastest", () => {
    const lines: BenchJsonLine[] = [
      { fixture: "counter", framework: "luxel", metric: "ssr_throughput_rps", value: 1000 },
      { fixture: "counter", framework: "react", metric: "ssr_throughput_rps", value: 1050 },
      { fixture: "counter", framework: "vue-vdom", metric: "ssr_throughput_rps", value: 1080 },
    ];
    const tier = evaluateSsrTier(lines);
    expect(tier.status).toBe("pass");
    expect(tier.geo_mean_factor).toBeLessThanOrEqual(BENCH_GATE_THRESHOLD);
  });

  test("ssr tier fails when luxel far behind", () => {
    const lines: BenchJsonLine[] = [
      { fixture: "counter", framework: "luxel", metric: "ssr_throughput_rps", value: 500 },
      { fixture: "counter", framework: "react", metric: "ssr_throughput_rps", value: 2000 },
    ];
    const tier = evaluateSsrTier(lines);
    expect(tier.status).toBe("fail");
    expect(tier.geo_mean_factor).toBeGreaterThan(BENCH_GATE_THRESHOLD);
  });

  test("bench_gate ok follows active ssr tier only", () => {
    const pass: BenchJsonLine[] = [
      { fixture: "counter", framework: "luxel", metric: "ssr_throughput_rps", value: 1000 },
      { fixture: "counter", framework: "react", metric: "ssr_throughput_rps", value: 1080 },
    ];
    expect(evaluateBenchGate(pass).ok).toBe(true);

    const fail: BenchJsonLine[] = [
      { fixture: "counter", framework: "luxel", metric: "ssr_throughput_rps", value: 400 },
      { fixture: "counter", framework: "react", metric: "ssr_throughput_rps", value: 2000 },
    ];
    expect(evaluateBenchGate(fail).ok).toBe(false);
  });
});
