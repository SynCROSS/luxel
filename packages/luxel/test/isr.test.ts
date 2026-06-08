import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createNavDemoTestServer } from "../src/test/server.ts";
import { FsHtmlCacheAdapter } from "../src/server/html-cache-fs.ts";
import { TieredHtmlCacheAdapter } from "../src/server/html-cache-tiered.ts";
import type { HtmlCacheAdapter, HtmlCacheEntry } from "../src/server/html-cache.ts";
import { compileApp } from "../src/route/compile-app.ts";
import { bundleClient } from "../src/build/client-bundle.ts";
import { createAppFetch } from "../src/server/handler.ts";
import { createRenderWorker, type RenderWorker } from "../src/server/render-worker.ts";
import { createListenFetchServer } from "../src/test/http-server.ts";
import { getLuxelRepoRoot } from "../src/paths.ts";
import { createIsrBenchServer } from "../src/bench/fixture-server.ts";

function headlineFromHtml(html: string): string {
  const match = html.match(/<h1>([^<]*)<\/h1>/);
  if (!match) throw new Error("headline h1 not found");
  return match[1]!;
}

describe("ISR html cache", () => {
  test("cache hit does not invoke render worker", async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), "luxel-isr-"));
    const repoRoot = getLuxelRepoRoot();
    const app = await compileApp(repoRoot, "examples/nav-demo");
    for (const route of app.routes) {
      if (route.path === "/") {
        route.mode = "isr";
        route.revalidateSeconds = 60;
        route.manifestRoute.mode = "isr";
        route.manifestRoute.revalidateSeconds = 60;
      }
    }
    const genRoot = await app.writeCache();
    const { js } = await bundleClient(genRoot);
    let renderCalls = 0;
    const createSpyWorker = (runtime: typeof app): RenderWorker => {
      const base = createRenderWorker(runtime);
      return {
        ...base,
        async render(path) {
          renderCalls++;
          return base.render(path);
        },
        async renderStream(path) {
          renderCalls++;
          return base.renderStream(path);
        },
      };
    };
    const appFetch = createAppFetch({
      app,
      clientBundle: js,
      internalRoutes: true,
      htmlCache: new FsHtmlCacheAdapter(cacheDir),
      createRenderWorker: createSpyWorker,
    });
    const server = await createListenFetchServer(appFetch, { port: 0, hostname: "127.0.0.1" });
    try {
      const miss = await fetch(`${server.url}/`);
      expect(miss.headers.get("x-luxel-cache")).toBe("miss");
      expect(renderCalls).toBe(1);

      const hit = await fetch(`${server.url}/`);
      expect(hit.headers.get("x-luxel-cache")).toBe("hit");
      expect(renderCalls).toBe(1);
    } finally {
      server.close();
    }
  });

  test("ISR bench server warms html cache before sustained hits", async () => {
    const server = await createIsrBenchServer();
    try {
      const res = await fetch(`${server.url}/`);
      expect(res.headers.get("x-luxel-cache")).toBe("hit");
    } finally {
      await server.close();
    }
  });

  test("memory tier serves ISR hit without reading backing cache", async () => {
    let backingGets = 0;
    const store = new Map<string, HtmlCacheEntry>();
    const backing: HtmlCacheAdapter = {
      async get(path) {
        backingGets++;
        return store.get(path) ?? null;
      },
      async set(path, entry) {
        store.set(path, entry);
      },
      async invalidateByTag() {},
    };
    const cache = new TieredHtmlCacheAdapter(backing);
    const entry: HtmlCacheEntry = {
      html: "<html>cached</html>",
      body: new TextEncoder().encode("<html>cached</html>"),
      writtenAt: Date.now(),
      revalidateSeconds: 60,
      tags: ["nav"],
    };
    await cache.set("/", entry);
    backingGets = 0;
    expect(await cache.get("/")).toEqual(entry);
    expect(backingGets).toBe(0);
  });

  test("tag revalidate busts cache before TTL", async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), "luxel-isr-"));
    const server = await createNavDemoTestServer(0, { htmlCacheDir: cacheDir });
    try {
      const first = await fetch(server.url);
      expect(first.headers.get("x-luxel-cache")).toBe("miss");
      expect(headlineFromHtml(await first.text())).toBe("A");

      const hit = await fetch(server.url);
      expect(hit.headers.get("x-luxel-cache")).toBe("hit");
      expect(headlineFromHtml(await hit.text())).toBe("A");

      await fetch(`${server.url}/__luxel/revalidate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tag: "nav" }),
      });

      const after = await fetch(server.url);
      expect(after.headers.get("x-luxel-cache")).toBe("miss");
      expect(headlineFromHtml(await after.text())).toBe("B");
    } finally {
      server.close();
    }
  });

  test("TTL expiry regenerates after revalidate seconds", async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), "luxel-isr-"));
    const adapter = new FsHtmlCacheAdapter(cacheDir);
    const server = await createNavDemoTestServer(0, {
      htmlCacheDir: cacheDir,
      routeRevalidateSeconds: { "/": 1 },
    });
    try {
      await fetch(server.url);
      await Bun.sleep(1_100);
      const res = await fetch(server.url);
      expect(res.headers.get("x-luxel-cache")).toBe("miss");
      expect(await adapter.get("/")).not.toBeNull();
    } finally {
      server.close();
    }
  });
});
