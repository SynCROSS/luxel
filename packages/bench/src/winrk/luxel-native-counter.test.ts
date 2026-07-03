import { describe, expect, test } from "bun:test";
import {
  isLuxelCoreNodeLoadable,
  prepareLuxelCounterNativeBench,
} from "@luxel/luxel/bench";
import {
  startLuxelSsrNativeServer,
  startLuxelSsrServer,
} from "./servers/luxel.ts";

describe("luxel counter winrk", () => {
  test("default luxel-ssr uses TS backend", async () => {
    const server = await startLuxelSsrServer();
    try {
      const res = await fetch(server.url);
      expect(res.ok).toBe(true);
      const html = await res.text();
      expect(html).toContain("Hello Luxel");
      expect(html).toContain('data-luxel-text="count"');
    } finally {
      await server.close();
    }
  }, 120_000);

  test("native row requires loadable core-node", async () => {
    await prepareLuxelCounterNativeBench();
    expect(isLuxelCoreNodeLoadable()).toBe(true);
    const server = await startLuxelSsrNativeServer();
    try {
      const res = await fetch(server.url);
      expect(res.ok).toBe(true);
      const html = await res.text();
      expect(html).toContain("Hello Luxel");
      expect(html).toContain('data-luxel-text="count"');
      expect(html).toContain("luxel-data");
      expect(html).toContain("luxel-hydration");
    } finally {
      await server.close();
    }
  }, 300_000);
});
