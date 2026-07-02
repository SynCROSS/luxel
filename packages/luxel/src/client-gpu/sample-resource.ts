import type { GpuResourceSample } from "../config/native-gpu.ts";
import { evaluateGpuResourceGates } from "../config/native-gpu.ts";
import type { ClientGpuMetrics } from "./capabilities.ts";
import { computeSpiralLayoutCoords } from "./spiral-layout.ts";
import type { SpiralLayoutOptions } from "./spiral-layout.ts";
import { computeSpiralTileCoordsCpu } from "./spiral-layout-cpu.ts";

export type BatteryManagerLike = {
  charging: boolean;
  level: number;
};

export type NavigatorWithBattery = Navigator & {
  getBattery?: () => Promise<BatteryManagerLike>;
};

/** Battery API proxy when available; undefined when API missing (no gate). */
export async function readBatteryDrainProxy(
  nav: NavigatorWithBattery,
  gpuComputeMs: number,
  cpuComputeMs: number,
): Promise<number | undefined> {
  if (typeof nav.getBattery !== "function") return undefined;
  const battery = await nav.getBattery();
  const computeDelta = Math.max(0, gpuComputeMs - cpuComputeMs);
  const unpluggedPenalty = battery.charging ? 0 : (1 - battery.level) * 20;
  return computeDelta * 10 + unpluggedPenalty;
}

export function buildGpuResourceSample(input: {
  metrics: ClientGpuMetrics;
  cpuComputeMs: number;
  inpProxyMs?: number;
  memoryMb?: number;
  batteryDrainProxy?: number;
}): GpuResourceSample {
  return {
    warmupMs: input.metrics.warmupMs,
    computeMs: input.metrics.computeMs,
    cpuComputeMs: input.cpuComputeMs,
    inpProxyMs: input.inpProxyMs ?? 0,
    memoryMb: input.memoryMb ?? 0,
    batteryDrainProxy: input.batteryDrainProxy,
  };
}

export async function sampleSpiralLayoutGpuGates(
  options: SpiralLayoutOptions,
  nav: NavigatorWithBattery = globalThis.navigator,
): Promise<{
  metrics: ClientGpuMetrics;
  sample: GpuResourceSample;
  gates: ReturnType<typeof evaluateGpuResourceGates>;
}> {
  const cpuStart = performance.now();
  computeSpiralTileCoordsCpu();
  const cpuComputeMs = performance.now() - cpuStart;

  const { coords, metrics } = await computeSpiralLayoutCoords(options);
  void coords;
  const batteryDrainProxy = await readBatteryDrainProxy(nav, metrics.computeMs, cpuComputeMs);
  const sample = buildGpuResourceSample({
    metrics,
    cpuComputeMs,
    batteryDrainProxy,
  });
  return { metrics, sample, gates: evaluateGpuResourceGates(sample) };
}
