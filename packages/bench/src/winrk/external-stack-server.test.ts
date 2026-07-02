import { describe, expect, test } from "bun:test";
import { usesExternalStackServer } from "./external-stack-server.ts";

describe("external stack server", () => {
  test("luxel worker pools in-process by default", () => {
    const previous = process.env.BENCH_LUXEL_EXTERNAL_SERVER;
    delete process.env.BENCH_LUXEL_EXTERNAL_SERVER;
    try {
      expect(usesExternalStackServer("luxel-spiral-ssr-worker-pool")).toBe(false);
      expect(usesExternalStackServer("react-spiral-ssr-worker-pool")).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.BENCH_LUXEL_EXTERNAL_SERVER;
      else process.env.BENCH_LUXEL_EXTERNAL_SERVER = previous;
    }
  });

  test("BENCH_LUXEL_EXTERNAL_SERVER=1 opts into subprocess", () => {
    const previous = process.env.BENCH_LUXEL_EXTERNAL_SERVER;
    process.env.BENCH_LUXEL_EXTERNAL_SERVER = "1";
    try {
      expect(usesExternalStackServer("luxel-ssr-worker-pool")).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.BENCH_LUXEL_EXTERNAL_SERVER;
      else process.env.BENCH_LUXEL_EXTERNAL_SERVER = previous;
    }
  });
});
