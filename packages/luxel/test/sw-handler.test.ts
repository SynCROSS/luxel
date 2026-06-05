import { describe, expect, test } from "bun:test";
import { createNavDemoTestServer } from "../src/test/server.ts";

describe("luxel-sw handler", () => {
  test("GET /luxel-sw.js embeds offline policies from manifest", async () => {
    const server = await createNavDemoTestServer();
    try {
      const res = await fetch(`${server.url}/luxel-sw.js`);
      expect(res.status).toBe(200);
      const js = await res.text();
      expect(js).toContain("OFFLINE");
      expect(js).toContain('"/detail"');
      expect(js).toContain('"none"');
    } finally {
      server.close();
    }
  });
});
