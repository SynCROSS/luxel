import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { computeSpiralTileCoordsCpu } from "../src/client-gpu/spiral-layout-cpu.ts";
import { computeSpiralTiles, spiralTileCount } from "../src/bench/fixtures/spiral-html.ts";
import {
  evaluateGpuResourceGates,
  resolveNativeGpuClient,
} from "../src/config/native-gpu.ts";
import { computeSpiralLayoutCoords, computeSpiralLayoutCoordsSync } from "../src/client-gpu/spiral-layout.ts";
import { SPIRAL_WEBGPU_PARAMS_BYTE_SIZE, assertWebgpuParity, WEBGPU_F32_REFERENCE_EPSILON_PX } from "../src/client-gpu/spiral-layout-webgpu.ts";
import { computeSpiralTileCoordsCpuF32 } from "../src/client-gpu/spiral-layout-cpu.ts";
import { detectClientGpuCapabilities } from "../src/client-gpu/capabilities.ts";
import { loadLuxelConfig } from "../src/config/load.ts";
import { compileApp } from "../src/route/compile-app.ts";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

const repoRoot = join(import.meta.dir, "../../..");

describe("spiral layout CPU source of truth", () => {
  test("webgpu uniform params buffer is 16-byte aligned", () => {
    expect(SPIRAL_WEBGPU_PARAMS_BYTE_SIZE % 16).toBe(0);
  });

  test("cpu coords match bench spiral fixture tiles", () => {
    const cpuCoords = computeSpiralTileCoordsCpu();
    const f32Coords = computeSpiralTileCoordsCpuF32();
    const tiles = computeSpiralTiles();
    expect(cpuCoords.length / 2).toBe(spiralTileCount());
    expect(f32Coords.length / 2).toBe(spiralTileCount());
    expect(cpuCoords.length / 2).toBe(tiles.length);
    for (let i = 0; i < tiles.length; i++) {
      expect(cpuCoords[i * 2]).toBeCloseTo(tiles[i]!.x, 5);
      expect(cpuCoords[i * 2 + 1]).toBeCloseTo(tiles[i]!.y, 5);
    }
  });
});

describe("resolveNativeGpuClient", () => {
  test("off disables client gpu", () => {
    const result = resolveNativeGpuClient({ client: "off" });
    expect(result.configured).toBe("off");
    expect(result.effective).toBe("off");
  });

  test("strict requires webgpu or webgl capability", () => {
    const result = resolveNativeGpuClient({ client: "strict" }, { webgpu: false, webgl: false });
    expect(result.configured).toBe("strict");
    expect(result.effective).toBe("off");
    expect(result.diagnostics.some((d) => d.includes("strict"))).toBe(true);
  });

  test("auto disables when resource gates regress", () => {
    const gates = evaluateGpuResourceGates({
      warmupMs: 50,
      computeMs: 2,
      cpuComputeMs: 1,
      inpProxyMs: 300,
      memoryMb: 64,
    });
    expect(gates.ok).toBe(false);
    const result = resolveNativeGpuClient(
      { client: "auto" },
      { webgpu: true, webgl: true },
      gates,
    );
    expect(result.effective).toBe("off");
    expect(result.diagnostics.some((d) => d.includes("gate"))).toBe(true);
  });

  test("auto disables when battery drain proxy regresses", () => {
    const gates = evaluateGpuResourceGates({
      warmupMs: 1,
      computeMs: 1,
      cpuComputeMs: 1,
      inpProxyMs: 1,
      memoryMb: 1,
      batteryDrainProxy: 51,
    });
    expect(gates.ok).toBe(false);
    const result = resolveNativeGpuClient(
      { client: "auto" },
      { webgpu: true, webgl: true },
      gates,
    );
    expect(result.effective).toBe("off");
    expect(result.diagnostics.some((d) => d.includes("battery"))).toBe(true);
  });
});

describe("computeSpiralLayoutCoords", () => {
  test("webgpu parity compares gpu coords to f32 cpu reference", () => {
    const ref = computeSpiralTileCoordsCpuF32();
    const gpu = new Float64Array(ref);
    gpu[1] = ref[1]! + WEBGPU_F32_REFERENCE_EPSILON_PX - 0.001;
    expect(() => assertWebgpuParity(gpu)).not.toThrow();
    gpu[1] = ref[1]! + WEBGPU_F32_REFERENCE_EPSILON_PX + 0.001;
    expect(() => assertWebgpuParity(gpu)).toThrow(/parity mismatch/i);
  });

  test("gpu.client off always uses cpu backend", async () => {
    const { coords, metrics } = await computeSpiralLayoutCoords({
      gpu: resolveNativeGpuClient({ client: "off" }),
      capabilities: { webgpu: true, webgl: true },
    });
    expect(metrics.backend).toBe("cpu");
    expect(coords.length / 2).toBe(spiralTileCount());
  });

  test("webgl narrow layout kernel preserves cpu spiral coords", () => {
    const cpu = computeSpiralTileCoordsCpu();
    const { coords, metrics } = computeSpiralLayoutCoordsSync({
      gpu: resolveNativeGpuClient({ client: "auto" }, { webgpu: false, webgl: true }),
      capabilities: { webgpu: false, webgl: true },
    });
    expect(metrics.backend).toBe("webgl");
    expect(coords).toEqual(cpu);
  });

  test("strict async path throws when WebGPU unavailable", async () => {
    await expect(
      computeSpiralLayoutCoords({
        gpu: resolveNativeGpuClient({ client: "strict" }, { webgpu: true, webgl: false }),
        capabilities: { webgpu: true, webgl: false },
      }),
    ).rejects.toThrow(/strict client gpu failed/i);
  });
});

describe("gpu.client config + manifest", () => {
  test("loadLuxelConfig reads native.gpu.client", async () => {
    const dir = await mkdtemp(join(tmpdir(), "luxel-gpu-config-"));
    await writeFile(
      join(dir, "luxel.config.ts"),
      `export default { root: ".", routesDir: "src/routes", outDir: "dist", native: { gpu: { client: "off" } } };`,
      "utf8",
    );
    const config = await loadLuxelConfig(dir);
    expect(config.native?.gpu?.client).toBe("off");
  });

  test("compileApp records gpu diagnostics in manifest", async () => {
    const app = await compileApp(repoRoot, "examples/counter");
    expect(app.manifest.gpu).toBeDefined();
    expect(app.manifest.gpu?.client).toBe("auto");
    expect(["on", "off"]).toContain(app.manifest.gpu?.effective);
    expect(detectClientGpuCapabilities().webgpu).toBe(false);
  });
});
