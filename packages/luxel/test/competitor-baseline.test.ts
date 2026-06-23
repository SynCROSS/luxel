import { describe, expect, test } from "bun:test";
import { runBenchRegistry } from "../src/bench/registry.ts";

describe("competitor baseline bench", () => {
  test(
    "counter fixture includes luxel and static-http baseline metrics",
    async () => {
    const lines = [];
    for await (const line of runBenchRegistry({ skipInp: true, skipSpiral: true })) {
      lines.push(line);
    }
    expect(
      lines.some(
        (l) =>
          l.fixture === "counter" &&
          l.framework === "luxel" &&
          l.metric === "ssr_throughput_rps" &&
          "value" in l,
      ),
    ).toBe(true);
    expect(
      lines.some(
        (l) =>
          l.fixture === "counter" &&
          l.framework === "static-http" &&
          l.metric === "ssr_throughput_rps" &&
          "value" in l,
      ),
    ).toBe(true);
    },
    120_000,
  );
});
