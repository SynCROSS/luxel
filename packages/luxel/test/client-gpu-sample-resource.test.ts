import { describe, expect, test } from "bun:test";
import { evaluateGpuResourceGates } from "../src/config/native-gpu.ts";
import {
  buildGpuResourceSample,
  readBatteryDrainProxy,
} from "../src/client-gpu/sample-resource.ts";

describe("readBatteryDrainProxy", () => {
  test("returns undefined when Battery API missing", async () => {
    const proxy = await readBatteryDrainProxy({} as Navigator, 5, 1);
    expect(proxy).toBeUndefined();
  });

  test("higher proxy when unplugged and gpu slower than cpu", async () => {
    const nav = {
      getBattery: async () => ({ charging: false, level: 0.5 }),
    } as Navigator & { getBattery: () => Promise<{ charging: boolean; level: number }> };
    const proxy = await readBatteryDrainProxy(nav, 10, 2);
    expect(proxy).toBeGreaterThan(50);
    const gates = evaluateGpuResourceGates(
      buildGpuResourceSample({
        metrics: { backend: "webgpu", warmupMs: 1, computeMs: 10, tileCount: 1 },
        cpuComputeMs: 2,
        batteryDrainProxy: proxy,
      }),
    );
    expect(gates.ok).toBe(false);
  });

  test("charging battery keeps proxy under gate when compute delta small", async () => {
    const nav = {
      getBattery: async () => ({ charging: true, level: 0.2 }),
    } as Navigator & { getBattery: () => Promise<{ charging: boolean; level: number }> };
    const proxy = await readBatteryDrainProxy(nav, 3, 2);
    expect(proxy).toBeLessThanOrEqual(50);
  });
});
