import { afterEach, describe, expect, test } from "bun:test";
import {
  benchLatencySampleCount,
  benchLatencySampleCountForFixture,
  postWinrkCooldownMs,
  benchLatencyConcurrency,
  usesWinrkLatencyStatsOnly,
} from "./bench-latency-config.ts";

const ENV_KEYS = ["BENCH_LATENCY_SAMPLES", "BENCH_POST_WINRK_COOLDOWN_MS"] as const;

function clearEnv(): void {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("bench latency config", () => {
  afterEach(clearEnv);

  test("usesWinrkLatencyStatsOnly when sample count is zero", () => {
    expect(usesWinrkLatencyStatsOnly(0)).toBe(true);
    expect(usesWinrkLatencyStatsOnly(1)).toBe(false);
  });

  test("env overrides platform defaults", () => {
    process.env.BENCH_LATENCY_SAMPLES = "250";
    process.env.BENCH_POST_WINRK_COOLDOWN_MS = "0";
    expect(benchLatencySampleCount()).toBe(250);
    expect(postWinrkCooldownMs()).toBe(0);
  });

  test("platform sample + cooldown defaults when env unset", () => {
    if (process.platform === "win32") {
      expect(benchLatencySampleCount()).toBe(1000);
      expect(postWinrkCooldownMs()).toBe(5000);
    } else {
      expect(benchLatencySampleCount()).toBe(5000);
      expect(postWinrkCooldownMs()).toBe(1000);
    }
  });

  test("platform latency concurrency default", () => {
    if (process.platform === "win32") {
      expect(benchLatencyConcurrency()).toBe(10);
    } else {
      expect(benchLatencyConcurrency()).toBe(50);
    }
  });

  test("spiral fixture defaults to winrk histogram only", () => {
    expect(benchLatencySampleCountForFixture("spiral")).toBe(0);
    expect(benchLatencySampleCountForFixture("counter")).toBe(benchLatencySampleCount());
  });
});
