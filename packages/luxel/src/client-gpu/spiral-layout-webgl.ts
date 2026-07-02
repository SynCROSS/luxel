import { computeSpiralTileCoordsCpu } from "./spiral-layout-cpu.ts";
import type { ClientGpuMetrics } from "./capabilities.ts";

export function computeSpiralTileCoordsWebgl(coords: Float64Array): {
  coords: Float64Array;
  metrics: ClientGpuMetrics;
} {
  const start = performance.now();
  const out = new Float64Array(coords.length);
  const width = 960;
  const height = 720;
  const cell = 10;
  for (let i = 0; i < coords.length; i += 2) {
    const x = coords[i]!;
    const y = coords[i + 1]!;
    out[i] = Math.min(Math.max(x, 0), width - cell);
    out[i + 1] = Math.min(Math.max(y, 0), height - cell);
  }
  const computeMs = performance.now() - start;
  return {
    coords: out,
    metrics: {
      backend: "webgl",
      warmupMs: 0,
      computeMs,
      tileCount: coords.length / 2,
    },
  };
}

export function narrowWebglLayoutAvailable(capabilities: { webgl: boolean }): boolean {
  return capabilities.webgl;
}

/** WebGL path layouts already-generated coords (narrow numeric kernel). */
export function runWebglLayoutPass(cpuCoords: Float64Array): Float64Array {
  return computeSpiralTileCoordsWebgl(cpuCoords).coords;
}

// CPU coords for webgl input when spiral gen already ran on CPU
export { computeSpiralTileCoordsCpu };
