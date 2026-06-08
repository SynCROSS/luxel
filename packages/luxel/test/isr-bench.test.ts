import { describe, expect, test } from "bun:test";
import { runIsrBench } from "../src/bench/isr.ts";
import { runBenchRegistry } from "../src/bench/registry.ts";

describe("ISR throughput bench", () => {
  test("warmed server sustains cache hits under load", async () => {
    const result = await runIsrBench();
    expect(result.cacheHit).toBe(true);
    expect(result.throughputRps).toBeGreaterThan(0);
  });

  test("registry emits luxel nav-demo isr throughput", async () => {
    const lines = [];
    for await (const line of runBenchRegistry({ skipInp: true, skipSpiral: true })) {
      lines.push(line);
    }
    const isr = lines.find(
      (line) =>
        line.fixture === "nav-demo" &&
        line.framework === "luxel" &&
        line.metric === "isr_throughput_rps" &&
        "value" in line,
    );
    expect(isr).toBeDefined();
    expect((isr as { value: number }).value).toBeGreaterThan(0);
  });
});
