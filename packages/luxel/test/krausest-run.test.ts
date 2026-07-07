import { describe, expect, test } from "bun:test";
import { parseKrausestResultsJson } from "../src/bench/krausest/run.ts";

describe("parseKrausestResultsJson", () => {
  test("maps chrome148 benchmark ids to luxel scenario slugs", () => {
    const rows = parseKrausestResultsJson([
      {
        framework: "luxel-v0.0.0-non-keyed",
        benchmark: "01_run1k",
        values: { total: [42.5, 41.0] },
      },
      {
        framework: "react-hooks-v19.2.0-non-keyed",
        benchmark: "09_clear1k_x8",
        values: { total: [12.1, 11.8] },
      },
      {
        framework: "luxel-v0.0.0-non-keyed",
        benchmark: "21_ready-memory",
        values: { DEFAULT: [1.8, 1.7] },
      },
    ]);
    expect(rows).toEqual([
      { framework: "luxel", scenario: "create_rows", durationMs: 41.75 },
      { framework: "react", scenario: "clear_rows", durationMs: 11.95 },
      { framework: "luxel", scenario: "ready_memory", durationMs: 0, memoryMb: 1.75 },
    ]);
  });
});
