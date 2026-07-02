import { hydrateSpiralClientGpuLayout } from "./spiral-client-gpu.ts";
import { computeSpiralTileCoordsCpu, computeSpiralTileCoordsCpuF32, spiralTileCountFromCoords } from "./spiral-layout-cpu.ts";
import {
  assertWebgpuMatchesBenchCpu,
  assertWebgpuParity,
  computeSpiralTileCoordsWebgpu,
} from "./spiral-layout-webgpu.ts";
import { resolveNativeGpuClient } from "../config/native-gpu.ts";

function readBrowserGpuCapabilities(): { webgpu: boolean; webgl: boolean } {
  const nav = globalThis.navigator as Navigator & { gpu?: unknown };
  const webgpu = typeof nav?.gpu !== "undefined";
  const canvas = document.createElement("canvas");
  const webgl =
    typeof canvas.getContext === "function" &&
    (canvas.getContext("webgl") !== null || canvas.getContext("experimental-webgl") !== null);
  return { webgpu, webgl };
}

export async function runWebgpuSpiralParityInBrowser(): Promise<{
  ok: boolean;
  backend: string;
  tileCount: number;
  appliedTiles: number;
}> {
  const wrapper =
    document.getElementById("wrapper") ??
    (() => {
      const el = document.createElement("div");
      el.id = "wrapper";
      document.body.appendChild(el);
      return el;
    })();

  const capabilities = readBrowserGpuCapabilities();
  const gpu = resolveNativeGpuClient({ client: "strict" }, capabilities);
  const result = await hydrateSpiralClientGpuLayout(wrapper, { gpu, capabilities });

  if (result.metrics.backend === "webgpu") {
    assertWebgpuParity(result.coords);
    assertWebgpuMatchesBenchCpu(result.coords);
  }

  return {
    ok: true,
    backend: result.metrics.backend,
    tileCount: spiralTileCountFromCoords(result.coords),
    appliedTiles: result.appliedTiles,
  };
}

/** Browser-only drift probe for WebGPU parity tuning. */
export async function measureWebgpuSpiralDrift(): Promise<{
  maxPx: number;
  index: number;
  cpuAt: number;
  gpuAt: number;
  tileCount: number;
  layoutPxMismatches: number;
}> {
  const cpu = computeSpiralTileCoordsCpu();
  const ref = computeSpiralTileCoordsCpuF32();
  const { coords: gpu } = await computeSpiralTileCoordsWebgpu();
  let maxPx = 0;
  let index = -1;
  let layoutPxMismatches = 0;
  let refMismatches = 0;
  for (let i = 0; i < cpu.length; i++) {
    const d = Math.abs(cpu[i]! - gpu[i]!);
    if (d > maxPx) {
      maxPx = d;
      index = i;
    }
    if (cpu[i]!.toFixed(2) !== gpu[i]!.toFixed(2)) layoutPxMismatches += 1;
    if (Math.abs(ref[i]! - gpu[i]!) > 0.05) refMismatches += 1;
  }
  return {
    maxPx,
    index,
    cpuAt: cpu[index] ?? 0,
    gpuAt: gpu[index] ?? 0,
    tileCount: cpu.length / 2,
    layoutPxMismatches,
    refMismatches,
  };
}
