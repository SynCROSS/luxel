import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createNavDemoTestServer } from "../src/test/server.ts";
import { FsHtmlCacheAdapter } from "../src/server/html-cache-fs.ts";

function headlineFromHtml(html: string): string {
  const match = html.match(/<h1>([^<]*)<\/h1>/);
  if (!match) throw new Error("headline h1 not found");
  return match[1]!;
}

describe("ISR html cache", () => {
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
