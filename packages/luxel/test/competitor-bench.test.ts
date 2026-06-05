import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runBenchRegistry } from "../src/bench/registry.ts";

const repoRoot = join(import.meta.dir, "../../..");

describe("competitor bench registry", () => {
  test("counter fixture includes luxel and fastify-html throughput", async () => {
    const lines: Array<{ fixture: string; framework?: string; status?: string; metric?: string }> = [];
    for await (const line of runBenchRegistry({ skipInp: true })) {
      lines.push(line as { fixture: string; framework?: string; status?: string; metric?: string });
    }
    expect(lines.some((l) => l.fixture === "counter" && l.framework === "luxel")).toBe(true);
    expect(
      lines.some(
        (l) =>
          l.fixture === "counter" &&
          (l.framework === "fastify-html" || l.framework === "fastify-static") &&
          l.metric === "ssr_throughput_rps" &&
          !("status" in l),
      ),
    ).toBe(true);
  });
});
