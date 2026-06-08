import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runBenchRegistry } from "../src/bench/registry.ts";

const repoRoot = join(import.meta.dir, "../../..");

const COMPARISON_FRAMEWORKS = [
  "react",
  "vue-vdom",
  "vue-vapor",
  "solid",
  "svelte",
  "fastify-html",
] as const;

describe("competitor bench registry", () => {
  test(
    "counter fixture includes luxel and fastify-html throughput",
    async () => {
    const lines: Array<{ fixture: string; framework?: string; status?: string; metric?: string }> = [];
    for await (const line of runBenchRegistry({ skipInp: true, skipSpiral: true })) {
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
    },
    120_000,
  );

  test("spiral fixture runs all comparison frameworks", async () => {
    const lines: Array<{ fixture: string; framework?: string; metric?: string; status?: string }> = [];
    for await (const line of runBenchRegistry({ skipInp: true, skipSpiral: false })) {
      if (line.fixture === "spiral") {
        lines.push(line as { fixture: string; framework?: string; metric?: string; status?: string });
      }
    }
    for (const framework of COMPARISON_FRAMEWORKS) {
      expect(
        lines.some(
          (l) =>
            l.framework === framework &&
            l.metric === "ssr_throughput_rps" &&
            !("status" in l),
        ),
        `missing spiral ${framework}`,
      ).toBe(true);
    }
  }, 180_000);
});
