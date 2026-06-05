import { describe, expect, test } from "bun:test";
import { runBenchRegistry } from "../src/bench/registry.ts";

describe("competitor matrix", () => {
  test("counter fixture emits throughput for luxel, static-http, fastify, react, vue", async () => {
    const lines = [];
    for await (const line of runBenchRegistry()) {
      lines.push(line);
    }
    for (const framework of ["luxel", "static-http", "fastify", "react", "vue"] as const) {
      expect(
        lines.some(
          (l) =>
            l.fixture === "counter" &&
            l.framework === framework &&
            l.metric === "ssr_throughput_rps" &&
            "value" in l,
        ),
      ).toBe(true);
    }
  });
});
