import type { NativeGpuResolution } from "../config/native-gpu.ts";
import type { GpuCapabilities } from "../config/native-gpu.ts";
import { computeSpiralTileCoordsCpu } from "./spiral-layout-cpu.ts";
import { computeSpiralTileCoordsWebgpu } from "./spiral-layout-webgpu.ts";
import {
  computeSpiralTileCoordsWebgl,
  narrowWebglLayoutAvailable,
} from "./spiral-layout-webgl.ts";
import type { ClientGpuMetrics } from "./capabilities.ts";

export type SpiralLayoutOptions = {
  gpu: NativeGpuResolution;
  capabilities: GpuCapabilities;
};

export type SpiralLayoutResult = {
  coords: Float64Array;
  metrics: ClientGpuMetrics;
};

function cpuResult(): SpiralLayoutResult {
  const start = performance.now();
  const coords = computeSpiralTileCoordsCpu();
  return {
    coords,
    metrics: {
      backend: "cpu",
      warmupMs: 0,
      computeMs: performance.now() - start,
      tileCount: coords.length / 2,
    },
  };
}

export function computeSpiralLayoutCoordsSync(options: SpiralLayoutOptions): SpiralLayoutResult {
  if (options.gpu.effective === "off") {
    return cpuResult();
  }

  if (options.gpu.effective === "on" && narrowWebglLayoutAvailable(options.capabilities)) {
    const cpu = computeSpiralTileCoordsCpu();
    return computeSpiralTileCoordsWebgl(cpu);
  }

  return cpuResult();
}

export async function computeSpiralLayoutCoords(
  options: SpiralLayoutOptions,
): Promise<SpiralLayoutResult> {
  if (options.gpu.effective === "off") {
    return cpuResult();
  }

  if (options.gpu.effective === "on" && options.capabilities.webgpu) {
    try {
      return await computeSpiralTileCoordsWebgpu();
    } catch (err) {
      if (options.gpu.configured === "strict") {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`luxel-native strict client gpu failed: ${msg}`);
      }
    }
  }

  return computeSpiralLayoutCoordsSync(options);
}
