import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  KRAUSEST_DURATION_SCENARIOS,
  KRAUSEST_SCENARIO_WEIGHTS,
  KRAUSEST_UPSTREAM_BENCHMARK_IDS,
} from "../src/bench/krausest/contract.ts";

const weightsPath = join(import.meta.dir, "../src/bench/krausest/upstream-weights.json");

describe("krausest scenario weights", () => {
  test("vendored weights match upstream-weights.json at chrome148 pin", async () => {
    const raw = JSON.parse(await readFile(weightsPath, "utf8")) as {
      pin: string;
      weights: Record<string, number>;
    };
    expect(raw.pin).toBe("chrome148");
    for (const scenario of KRAUSEST_DURATION_SCENARIOS) {
      const benchId = KRAUSEST_UPSTREAM_BENCHMARK_IDS[scenario];
      expect(raw.weights[benchId]).toBe(KRAUSEST_SCENARIO_WEIGHTS[scenario]);
    }
  });
});
