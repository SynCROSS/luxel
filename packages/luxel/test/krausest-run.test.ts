import { describe, expect, test } from "bun:test";
import {
  appendKrausestDriverOutputTail,
  chunkKrausestFrameworks,
  filterKrausestRows,
  krausestFrameworkBatchSize,
  KRAUSEST_DRIVER_OUTPUT_TAIL_MAX,
  parseKrausestResultsJson,
} from "../src/bench/krausest/run.ts";

describe("parseKrausestResultsJson", () => {
  test("keeps upstream official framework labels", () => {
    const officialFrameworks = [
      "luxel-v0.0.0-non-keyed",
      "react-hooks-v19.2.0-keyed",
      "vue-vapor-v3.6.0-alpha.2-non-keyed",
    ];
    const rows = parseKrausestResultsJson(
      [
      {
        framework: "luxel-v0.0.0-non-keyed",
        benchmark: "01_run1k",
        values: { total: [42.5, 41.0] },
      },
      {
        framework: "react-hooks-v19.2.0-keyed",
        benchmark: "09_clear1k_x8",
        values: { total: [12.1, 11.8] },
      },
      {
        framework: "vue-vapor-v3.6.0-alpha.2-non-keyed",
        benchmark: "01_run1k",
        values: { total: [20] },
      },
      {
        framework: "luxel-v0.0.0-non-keyed",
        benchmark: "21_ready-memory",
        values: { DEFAULT: [1.8, 1.7] },
      },
      {
        framework: "luxel-v0.0.0-non-keyed",
        benchmark: "41_size-uncompressed",
        values: { DEFAULT: [42.1, 43.0] },
      },
      {
        framework: "luxel-v0.0.0-non-keyed",
        benchmark: "43_first-paint",
        values: { DEFAULT: [118.5] },
      },
      {
        framework: "hand-rolled-react",
        benchmark: "01_run1k",
        values: { total: [1] },
      },
      ],
      officialFrameworks,
    );
    expect(rows).toEqual([
      { framework: "luxel-v0.0.0-non-keyed", scenario: "create_rows", durationMs: 41.75 },
      { framework: "react-hooks-v19.2.0-keyed", scenario: "clear_rows", durationMs: 11.95 },
      {
        framework: "vue-vapor-v3.6.0-alpha.2-non-keyed",
        scenario: "create_rows",
        durationMs: 20,
      },
      {
        framework: "luxel-v0.0.0-non-keyed",
        scenario: "ready_memory",
        durationMs: 0,
        memoryMb: 1.75,
      },
      {
        framework: "luxel-v0.0.0-non-keyed",
        scenario: "uncompressed_size",
        durationMs: 0,
        transferKb: 42.55,
      },
      {
        framework: "luxel-v0.0.0-non-keyed",
        scenario: "first_paint",
        durationMs: 0,
        transferKb: 118.5,
      },
    ]);
  });

  test("filters stale rows from previous driver runs", () => {
    const rows = [
      { framework: "react-hooks-v19.2.0-keyed", scenario: "create_rows", durationMs: 110 },
      { framework: "luxel-v0.0.0-non-keyed", scenario: "create_rows", durationMs: 170 },
      { framework: "react-hooks-v19.2.0-keyed", scenario: "clear_rows", durationMs: 12 },
    ];

    expect(filterKrausestRows(rows, ["create_rows"], ["react-hooks-v19.2.0-keyed"])).toEqual([
      { framework: "react-hooks-v19.2.0-keyed", scenario: "create_rows", durationMs: 110 },
    ]);
  });
});

describe("krausest driver batching", () => {
  test("appendKrausestDriverOutputTail caps retained log bytes", () => {
    const max = 16;
    let acc = "";
    for (let i = 0; i < 100; i++) {
      acc = appendKrausestDriverOutputTail(acc, "x", max);
    }
    expect(acc.length).toBe(max);
    expect(acc).toBe("x".repeat(max));
  });

  test("default batch size keeps compare-sized runs in one process", () => {
    const prev = process.env.KRAUSEST_FRAMEWORK_BATCH_SIZE;
    delete process.env.KRAUSEST_FRAMEWORK_BATCH_SIZE;
    expect(krausestFrameworkBatchSize(5)).toBe(5);
    expect(krausestFrameworkBatchSize(12)).toBe(12);
    expect(krausestFrameworkBatchSize(67)).toBe(8);
    process.env.KRAUSEST_FRAMEWORK_BATCH_SIZE = prev;
  });

  test("chunkKrausestFrameworks splits full matrix into batches", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    expect(chunkKrausestFrameworks(items, 8)).toEqual([
      [0, 1, 2, 3, 4, 5, 6, 7],
      [8, 9],
    ]);
  });

  test("KRAUSEST_DRIVER_OUTPUT_TAIL_MAX is bounded", () => {
    expect(KRAUSEST_DRIVER_OUTPUT_TAIL_MAX).toBeLessThanOrEqual(65_536);
  });
});
