import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { compileCounterApp } from "../src/route/compile-app.ts";
import { readStreamToText } from "../src/compiler/stream-document.ts";
import { createTestServer } from "../src/test/server.ts";
import { createLoadContext } from "../src/resource-store/load-context.ts";
import { ResourceStore } from "../src/resource-store/store.ts";

const repoRoot = join(import.meta.dir, "../../..");

describe("streaming SSR spike", () => {
  test("streamed document matches buffered render", async () => {
    const app = await compileCounterApp(repoRoot);
    const route = app.getRoute("/");
    if (!route) throw new Error("missing / route");
    const store = new ResourceStore();
    await route.load(createLoadContext(store));
    const html = route.renderFromStore(store);
    const streamed = await readStreamToText(route.renderStreamFromStore(store));
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
