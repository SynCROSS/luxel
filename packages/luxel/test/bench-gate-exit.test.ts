import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runBenchCommand } from "../src/host/host-runtime.ts";

const repoRoot = join(import.meta.dir, "../../..");
const counterApp = join(repoRoot, "examples/counter");

describe("luxel bench --gate exit", () => {
  test(
    "bench --gate exits 0 with spiral and isr tiers",
    async () => {
      const prevInp = process.env.LUXEL_BENCH_SKIP_INP;
      const prevSpiral = process.env.LUXEL_BENCH_SKIP_SPIRAL;
      const prevCwd = process.cwd();
      process.env.LUXEL_BENCH_SKIP_INP = "1";
      delete process.env.LUXEL_BENCH_SKIP_SPIRAL;
      process.env.LUXEL_BENCH_GATE_SSR_FIXTURES = "counter";
      process.chdir(counterApp);
      try {
        const code = await runBenchCommand(["bench", "--gate"]);
        expect(code).toBe(0);
      } finally {
        process.chdir(prevCwd);
        if (prevInp === undefined) delete process.env.LUXEL_BENCH_SKIP_INP;
        else process.env.LUXEL_BENCH_SKIP_INP = prevInp;
        if (prevSpiral === undefined) delete process.env.LUXEL_BENCH_SKIP_SPIRAL;
        else process.env.LUXEL_BENCH_SKIP_SPIRAL = prevSpiral;
        delete process.env.LUXEL_BENCH_GATE_SSR_FIXTURES;
      }
    },
    600_000,
  );
});
