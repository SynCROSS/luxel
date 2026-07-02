import { describe, expect, test } from "bun:test";
import * as esbuild from "esbuild";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getLuxelPkgSrc } from "../src/paths.ts";

describe("webgpu browser harness bundle", () => {
  test("esbuild emits browser parity harness with WebGPU entrypoint", () => {
    const entry = join(getLuxelPkgSrc(), "client-gpu/browser-parity.harness.ts");
    const out = join(getLuxelPkgSrc(), "../.cache/e2e-webgpu/harness.js");
    mkdirSync(join(getLuxelPkgSrc(), "../.cache/e2e-webgpu"), { recursive: true });
    const result = esbuild.buildSync({
      entryPoints: [entry],
      bundle: true,
      format: "iife",
      globalName: "LuxelWebgpuHarness",
      platform: "browser",
      target: ["chrome100"],
      outfile: out,
      logLevel: "silent",
    });
    expect(result.errors).toHaveLength(0);
    const js = readFileSync(out, "utf8");
    expect(js).toContain("hydrateSpiralClientGpuLayout");
    expect(js).toContain("applySpiralLayoutCoordsToDom");
  });
});
