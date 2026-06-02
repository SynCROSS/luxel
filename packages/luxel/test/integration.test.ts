import { describe, expect, test } from "bun:test";
import { createTestServer } from "../src/test/server.ts";
import { assertSsrContainsRequiredParts, assertSsrDocumentMatches } from "../src/contracts/assert.ts";
import { loadSsrContract } from "../src/contracts/loader.ts";

describe("counter route integration", () => {
  test("GET / returns contract SSR", async () => {
    const server = await createTestServer();
    try {
      const res = await fetch(server.url);
      expect(res.status).toBe(200);
      const html = await res.text();
      assertSsrDocumentMatches(html, loadSsrContract());
      assertSsrContainsRequiredParts(html);
    } finally {
      server.close();
    }
  });
});
