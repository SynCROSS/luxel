import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { compileCounterApp } from "../src/route/compile-app.ts";
import { readStreamToText } from "../src/compiler/stream-document.ts";
import { createTestServer } from "../src/test/server.ts";

const repoRoot = join(import.meta.dir, "../../..");

describe("streaming SSR spike", () => {
  test("streamed document matches buffered render", async () => {
    const app = await compileCounterApp(repoRoot);
    const route = app.getRoute("/");
    if (!route) throw new Error("missing / route");
    const data = await route.load();
    const html = route.renderDocument(data);
    const streamed = await readStreamToText(route.renderStream(data));
    expect(streamed).toBe(html);
  });

  test("GET /?stream=1 returns HTML body", async () => {
    const server = await createTestServer();
    try {
      const buffered = await fetch(server.url);
      const streamed = await fetch(`${server.url}/?stream=1`);
      expect(streamed.status).toBe(200);
      const a = await buffered.text();
      const b = await streamed.text();
      expect(b).toBe(a);
    } finally {
      server.close();
    }
  });
});
