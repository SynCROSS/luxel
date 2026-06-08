import { describe, expect, test } from "bun:test";
import {
  BENCH_GATE_THRESHOLD,
  evaluateBenchGate,
  evaluateIsrTier,
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
      { fixture: "spiral", framework: "luxel", metric: "ssr_throughput_rps", value: 900 },
      { fixture: "spiral", framework: "react", metric: "ssr_throughput_rps", value: 950 },
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

  test("isr tier passes when luxel within 8% of fastest", () => {
    const lines: BenchJsonLine[] = [
      { fixture: "nav-demo", framework: "luxel", metric: "isr_throughput_rps", value: 4000 },
      { fixture: "nav-demo", framework: "svelte", metric: "isr_throughput_rps", value: 4200 },
    ];
    const tier = evaluateIsrTier(lines);
    expect(tier.status).toBe("pass");
    expect(tier.geo_mean_factor).toBeLessThanOrEqual(BENCH_GATE_THRESHOLD);
  });

  test("bench_gate ok when isr tier pending without competitor", () => {
    const lines: BenchJsonLine[] = [
      { fixture: "counter", framework: "luxel", metric: "ssr_throughput_rps", value: 1000 },
      { fixture: "counter", framework: "react", metric: "ssr_throughput_rps", value: 1080 },
      { fixture: "spiral", framework: "luxel", metric: "ssr_throughput_rps", value: 680 },
      { fixture: "spiral", framework: "svelte", metric: "ssr_throughput_rps", value: 693 },
      { fixture: "nav-demo", framework: "luxel", metric: "isr_throughput_rps", value: 4000 },
    ];
    const gate = evaluateBenchGate(lines);
    expect(evaluateIsrTier(lines).status).toBe("pending");
    expect(gate.ok).toBe(true);
  });

  test("post-Phase-0 WinRK factors pass ssr and isr tiers", () => {
    const lines: BenchJsonLine[] = [
      { fixture: "spiral", framework: "luxel", metric: "ssr_throughput_rps", value: 841 },
      { fixture: "spiral", framework: "vue-vdom", metric: "ssr_throughput_rps", value: 598 },
      { fixture: "spiral", framework: "svelte", metric: "ssr_throughput_rps", value: 433 },
      { fixture: "counter", framework: "luxel", metric: "ssr_throughput_rps", value: 22_900 },
      { fixture: "counter", framework: "react", metric: "ssr_throughput_rps", value: 20_000 },
      { fixture: "nav-demo", framework: "luxel", metric: "isr_throughput_rps", value: 4_458 },
      { fixture: "nav-demo", framework: "svelte", metric: "isr_throughput_rps", value: 1_809 },
    ];
    const gate = evaluateBenchGate(lines);
    expect(gate.ok).toBe(true);
    expect(evaluateSsrTier(lines).geo_mean_factor).toBeLessThanOrEqual(BENCH_GATE_THRESHOLD);
    expect(evaluateIsrTier(lines).geo_mean_factor).toBeLessThanOrEqual(BENCH_GATE_THRESHOLD);
  });

  test("bench_gate ok requires active ssr and isr tiers", () => {
    const pass: BenchJsonLine[] = [
      { fixture: "counter", framework: "luxel", metric: "ssr_throughput_rps", value: 1000 },
      { fixture: "counter", framework: "react", metric: "ssr_throughput_rps", value: 1080 },
      { fixture: "spiral", framework: "luxel", metric: "ssr_throughput_rps", value: 680 },
      { fixture: "spiral", framework: "svelte", metric: "ssr_throughput_rps", value: 693 },
      { fixture: "nav-demo", framework: "luxel", metric: "isr_throughput_rps", value: 4000 },
      { fixture: "nav-demo", framework: "svelte", metric: "isr_throughput_rps", value: 4200 },
    ];
    expect(evaluateBenchGate(pass).ok).toBe(true);

    const fail: BenchJsonLine[] = [
      { fixture: "counter", framework: "luxel", metric: "ssr_throughput_rps", value: 1000 },
      { fixture: "counter", framework: "react", metric: "ssr_throughput_rps", value: 1080 },
      { fixture: "spiral", framework: "luxel", metric: "ssr_throughput_rps", value: 680 },
      { fixture: "spiral", framework: "svelte", metric: "ssr_throughput_rps", value: 693 },
      { fixture: "nav-demo", framework: "luxel", metric: "isr_throughput_rps", value: 1000 },
      { fixture: "nav-demo", framework: "svelte", metric: "isr_throughput_rps", value: 4784 },
    ];
    expect(evaluateBenchGate(fail).ok).toBe(false);
  });
});
