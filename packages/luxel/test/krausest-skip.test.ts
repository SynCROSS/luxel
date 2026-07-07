import { describe, expect, test } from "bun:test";
import { runKrausestRegistryLines } from "../src/bench/krausest.ts";

describe("krausest registry skip", () => {
  test("LUXEL_BENCH_SKIP_KRAUSEST=1 yields no krausest lines", async () => {
    const prev = process.env.LUXEL_BENCH_SKIP_KRAUSEST;
    process.env.LUXEL_BENCH_SKIP_KRAUSEST = "1";
    try {
      const lines = [];
      for await (const line of runKrausestRegistryLines(import.meta.dir)) {
        lines.push(line);
      }
      expect(lines.length).toBe(0);
    } finally {
      if (prev === undefined) delete process.env.LUXEL_BENCH_SKIP_KRAUSEST;
      else process.env.LUXEL_BENCH_SKIP_KRAUSEST = prev;
    }
  });
});
