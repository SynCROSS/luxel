import { describe, expect, test } from "bun:test";
import { createNavDemoTestServer } from "../src/test/server.ts";
import { revalidateTag } from "../src/resource-store/revalidate.ts";
import { createRenderWorker } from "../src/server/render-worker.ts";
import { compileNavDemoApp } from "../src/route/compile-app.ts";
import { join } from "node:path";

function headlineFromHtml(html: string): string {
  const match = html.match(/<h1>([^<]*)<\/h1>/);
  if (!match) throw new Error("headline h1 not found");
  return match[1]!;
}

describe("nav-demo revalidateTag", () => {
  test("first SSR returns A; after revalidate, next navigation returns B", async () => {
    const server = await createNavDemoTestServer();
    try {
      const first = await fetch(server.url);
      expect(first.status).toBe(200);
      expect(headlineFromHtml(await first.text())).toBe("A");

      const revalidate = await fetch(`${server.url}/__luxel/revalidate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tag: "nav" }),
      });
      expect(revalidate.status).toBe(204);

      const second = await fetch(server.url);
      expect(second.status).toBe(200);
      expect(headlineFromHtml(await second.text())).toBe("B");
    } finally {
      server.close();
    }
  });

  test("revalidateTag is server-only (not on client bundle entry)", async () => {
    const repoRoot = join(import.meta.dir, "../../..");
    const app = await compileNavDemoApp(repoRoot);
    const genRoot = await app.writeCache();
    const entryPath = join(genRoot, "client-entry.ts");
    const entry = await Bun.file(entryPath).text();
    expect(entry.includes("revalidateTag")).toBe(false);
  });

  test("server revalidateTag API invalidates tagged store entries", async () => {
    const repoRoot = join(import.meta.dir, "../../..");
    const app = await compileNavDemoApp(repoRoot);
    await app.writeCache();
    const worker = createRenderWorker(app);

    await worker.render("/");
    expect(worker.getStore().getGeneration("nav:headline")).toBe(0);

    revalidateTag(worker.getStore(), "nav");
    expect(worker.getStore().isStale("nav:headline")).toBe(true);
    expect(worker.getStore().getGeneration("nav:headline")).toBe(1);

    const { html } = await worker.render("/");
    expect(headlineFromHtml(html)).toBe("B");
  });
});
