import { describe, expect, test } from "bun:test";
import { runBenchRegistry } from "../src/bench/registry.ts";

describe.skipIf(process.env.CI === "1")("competitor matrix", () => {
  test(
    "counter fixture emits throughput for luxel, static-http, fastify-html, react, vue-vdom",
    async () => {
    const lines = [];
    for await (const line of runBenchRegistry({ skipInp: true, skipSpiral: true })) {
      lines.push(line);
    }
    for (const framework of ["luxel", "static-http", "fastify-html", "react", "vue-vdom"] as const) {
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
    },
    120_000,
  );
});
