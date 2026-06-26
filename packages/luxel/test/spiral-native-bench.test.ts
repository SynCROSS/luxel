import { beforeAll, describe, expect, test } from "bun:test";
import { runSpiralBenchCompare } from "../src/bench/spiral.ts";
import { ensureCoreNodeBuilt } from "./helpers/ensure-core-node.ts";

describe.skipIf(process.env.CI === "1")("spiral native bench", () => {
  beforeAll(() => ensureCoreNodeBuilt(), 300_000);

  test("native spiral throughput matches TS html contract", async () => {
    const { ts, native } = await runSpiralBenchCompare();

    expect(ts.ssrBackend).toBe("ts");
    expect(native.ssrBackend).toBe("native");
    expect(native.throughputRps).toBeGreaterThan(0);
    expect(native.renderWorkerRps).toBeGreaterThan(0);
    expect(native.htmlBytes).toBe(ts.htmlBytes);
    expect(native.tileCount).toBe(ts.tileCount);
  }, 300_000);
});
