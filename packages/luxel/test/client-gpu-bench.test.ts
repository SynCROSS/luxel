import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runClientGpuBench } from "../src/bench/client-gpu-bench.ts";

const repoRoot = join(import.meta.dir, "../../..");
const preflightPath = join(repoRoot, "packages/luxel/.cache/webgpu-e2e-preflight.json");

describe("runClientGpuBench", () => {
  const prevSkip = process.env.LUXEL_WEBGPU_SKIP;

  beforeEach(() => {
    mkdirSync(join(repoRoot, "packages/luxel/.cache"), { recursive: true });
    rmSync(preflightPath, { force: true });
    delete process.env.LUXEL_WEBGPU_SKIP;
    delete process.env.LUXEL_BENCH_CLIENT_GPU_OK;
  });

  afterEach(() => {
    rmSync(preflightPath, { force: true });
    if (prevSkip === undefined) delete process.env.LUXEL_WEBGPU_SKIP;
    else process.env.LUXEL_WEBGPU_SKIP = prevSkip;
  });

  test("emits CPU layout metrics and webgpu parity row", async () => {
    const lines = await runClientGpuBench(repoRoot);
    expect(lines.every((line) => line.fixture === "client-gpu")).toBe(true);
    expect(lines.some((line) => line.metric === "cpu_layout_tile_count")).toBe(true);
    expect(lines.some((line) => line.metric === "webgpu_parity_ok")).toBe(true);
    expect(lines.find((line) => line.metric === "cpu_layout_tile_count")!.value).toBeGreaterThan(0);
  });

  test("preflight pass marks webgpu_parity_ok true without runtime WebGPU", async () => {
    writeFileSync(preflightPath, JSON.stringify({ skip: false }));
    const lines = await runClientGpuBench(repoRoot);
    expect(lines.find((line) => line.metric === "webgpu_parity_ok")?.value).toBe(1);
  });

  test("preflight skip marks webgpu_parity_ok false", async () => {
    writeFileSync(preflightPath, JSON.stringify({ skip: true, reason: "launch timeout" }));
    const lines = await runClientGpuBench(repoRoot);
    expect(lines.find((line) => line.metric === "webgpu_parity_ok")?.value).toBe(0);
  });
});
