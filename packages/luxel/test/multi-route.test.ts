import { describe, expect, test } from "bun:test";
import { createTestServer } from "../src/test/server.ts";

describe("multi-route app", () => {
  test("GET /about returns about page HTML", async () => {
    const server = await createTestServer();
    try {
      const res = await fetch(`${server.url}/about`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("About Luxel");
      expect(html).toContain('data-luxel-route="/about"');
    } finally {
      server.close();
    }
  });
});
