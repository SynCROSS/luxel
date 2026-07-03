import { describe, expect, test } from "bun:test";
import {
  isLuxelCoreNodeLoadable,
  prepareLuxelSpiralNativeBench,
} from "@luxel/luxel/bench";
import {
  startLuxelSpiralSsrNativeServer,
  startLuxelSpiralSsrServer,
} from "./servers/luxel.ts";

describe("luxel spiral winrk", () => {
  test("default luxel-spiral-ssr uses TS backend", async () => {
    const server = await startLuxelSpiralSsrServer();
    try {
      const res = await fetch(server.url);
      expect(res.ok).toBe(true);
      const tiles = (await res.text()).match(/class="tile"/g)?.length ?? 0;
      expect(tiles).toBeGreaterThan(2000);
    } finally {
      await server.close();
    }
  }, 120_000);

  test("native row requires loadable core-node", async () => {
    await prepareLuxelSpiralNativeBench();
    expect(isLuxelCoreNodeLoadable()).toBe(true);
    const server = await startLuxelSpiralSsrNativeServer();
    try {
      const res = await fetch(server.url);
      expect(res.ok).toBe(true);
    } finally {
      await server.close();
    }
  }, 300_000);
});
