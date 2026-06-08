import { describe, expect, test } from "bun:test";
import { WINRK_SPIRAL_STACKS } from "./registry.ts";

describe("winrk spiral stacks", () => {
  test("each stack serves ~2398 tiles", async () => {
    for (const row of WINRK_SPIRAL_STACKS) {
      const server = await row.start();
      expect(server, row.id).not.toBeNull();
      if (!server) continue;
      try {
        const res = await fetch(server.url);
        expect(res.ok, row.id).toBe(true);
        const html = await res.text();
        const tiles = html.match(/class="tile"/g)?.length ?? 0;
        expect(tiles, row.id).toBeGreaterThan(2000);
        expect(tiles, row.id).toBeLessThan(2800);
      } finally {
        await server.close();
      }
    }
  }, 120_000);
});
