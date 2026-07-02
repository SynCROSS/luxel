import { describe, expect, test } from "bun:test";
import {
  assertNativeDefaultReleaseReady,
  evaluateNativeDefaultGate,
  NATIVE_DEFAULT_GATE_THRESHOLDS,
  parseNativeDefaultGateFromJsonl,
} from "../src/bench/native-default-gate.ts";
import type { NativeGateInputLine } from "../src/bench/native-default-gate.ts";

function passingLines(): NativeGateInputLine[] {
  return [
    { fixture: "counter", framework: "luxel", metric: "ssr_throughput_rps", value: 1000 },
    { fixture: "counter", framework: "react", metric: "ssr_throughput_rps", value: 1080 },
    { fixture: "spiral", framework: "luxel", metric: "ssr_throughput_rps", value: 900 },
    { fixture: "spiral", framework: "react", metric: "ssr_throughput_rps", value: 950 },
    { fixture: "nav-demo", framework: "luxel", metric: "isr_throughput_rps", value: 4000 },
    { fixture: "nav-demo", framework: "svelte", metric: "isr_throughput_rps", value: 4200 },
    { fixture: "counter", framework: "luxel", metric: "inp_ms", value: 40, interaction: "increment" },
    { fixture: "counter", framework: "react", metric: "inp_ms", value: 42, interaction: "increment" },
    { fixture: "boundary", runtime: "node", metric: "native_null_call_p50_us", value: 120 },
    { fixture: "boundary", runtime: "node", metric: "typed_array_cross_p50_us", value: 800 },
    { fixture: "native-resource", metric: "rss_mb", value: 128 },
    { fixture: "native-resource", metric: "cold_start_ms", value: 400 },
    { fixture: "native-resource", metric: "install_size_mb", value: 24 },
    { fixture: "schema-stream", metric: "cache_hit_ratio_bytes", value: 0.6 },
    { fixture: "ipc", metric: "null_roundtrip_p50_us", value: 50 },
    { fixture: "client-gpu", metric: "webgpu_parity_ok", value: 1 },
  ];
}

describe("native default enablement gate", () => {
  test("passes when WinRK, INP, boundary, RSS, and cold-start within limits", () => {
    const gate = evaluateNativeDefaultGate(passingLines());
    expect(gate.ok).toBe(true);
    expect(gate.auto_default_enabled).toBe(true);
    expect(gate.checks.find((c) => c.metric === "winrk_ssr")?.status).toBe("pass");
    expect(gate.checks.find((c) => c.metric === "rss_mb")?.status).toBe("pass");
    expect(gate.slices).toContain("hot-path");
    expect(gate.slices).toContain("runtime");
    expect(gate.slices).toContain("schema-cache");
    expect(gate.slices).toContain("client-gpu");
  });

  test("blocks auto default when WinRK SSR regresses", () => {
    const lines = passingLines().map((line) =>
      line.fixture === "counter" && line.metric === "ssr_throughput_rps" && line.framework === "luxel"
        ? { ...line, value: 200 }
        : line,
    );
    const gate = evaluateNativeDefaultGate(lines);
    expect(gate.ok).toBe(false);
    expect(gate.auto_default_enabled).toBe(false);
    expect(gate.checks.find((c) => c.metric === "winrk_ssr")?.status).toBe("fail");
  });

  test("blocks auto default when RSS exceeds cap", () => {
    const lines = passingLines().map((line) =>
      line.metric === "rss_mb" ? { ...line, value: NATIVE_DEFAULT_GATE_THRESHOLDS.rssMb + 1 } : line,
    );
    const gate = evaluateNativeDefaultGate(lines);
    expect(gate.ok).toBe(false);
    expect(gate.checks.find((c) => c.metric === "rss_mb")?.status).toBe("fail");
  });

  test("pending INP blocks auto default but not ok when skip env", () => {
    const lines = passingLines().filter((line) => line.metric !== "inp_ms");
    const gate = evaluateNativeDefaultGate(lines);
    expect(gate.ok).toBe(true);
    expect(gate.auto_default_enabled).toBe(false);
    expect(gate.checks.find((c) => c.metric === "inp")?.status).toBe("pending");
  });

  test("luxel-only INP passes abs gate when competitors not wired", () => {
    const lines = passingLines()
      .filter((line) => !(line.metric === "inp_ms" && line.framework === "react"))
      .map((line) =>
        line.metric === "inp_ms" && line.framework === "luxel"
          ? { ...line, interaction: "counter_click", value: 80 }
          : line,
      );
    const gate = evaluateNativeDefaultGate(lines);
    expect(gate.checks.find((c) => c.metric === "inp")?.status).toBe("pass");
    expect(gate.auto_default_enabled).toBe(true);
  });

  test("luxel-only INP fails abs gate when over cap", () => {
    const lines = passingLines()
      .filter((line) => !(line.metric === "inp_ms" && line.framework === "react"))
      .map((line) =>
        line.metric === "inp_ms" && line.framework === "luxel"
          ? { ...line, interaction: "counter_click", value: NATIVE_DEFAULT_GATE_THRESHOLDS.inpLuxelMs + 1 }
          : line,
      );
    const gate = evaluateNativeDefaultGate(lines);
    expect(gate.checks.find((c) => c.metric === "inp")?.status).toBe("fail");
    expect(gate.auto_default_enabled).toBe(false);
  });
});

describe("native default gate release verify", () => {
  test("parseNativeDefaultGateFromJsonl finds gate line in bench output", () => {
    const gate = evaluateNativeDefaultGate(passingLines());
    const text = [`{"fixture":"counter","metric":"ssr_throughput_rps","value":1}`, JSON.stringify(gate)].join(
      "\n",
    );
    expect(parseNativeDefaultGateFromJsonl(text)).toEqual(gate);
  });

  test("assertNativeDefaultReleaseReady throws when auto default blocked", () => {
    const gate = evaluateNativeDefaultGate(passingLines().filter((line) => line.metric !== "inp_ms"));
    expect(() => assertNativeDefaultReleaseReady(gate)).toThrow(/auto_default_enabled/);
  });
});
