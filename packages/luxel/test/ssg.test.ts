import { describe, expect, test } from "bun:test";
import { buildApp } from "../src/build/build-app.ts";
import { loadAppFromDist } from "../src/deploy/load-app.ts";
import { createAppFetch } from "../src/server/handler.ts";
import { join } from "node:path";
import { existsSync } from "node:fs";

const repoRoot = join(import.meta.dir, "../../..");

describe("SSG prerender", () => {
  test("about route writes static HTML and handler serves it", async () => {
    const outDir = await buildApp(repoRoot, "examples/counter");
    const staticFile = join(outDir, "static", "about", "index.html");
    expect(existsSync(staticFile)).toBe(true);

    const { app, clientBundle } = await loadAppFromDist(outDir);
    const fetch = createAppFetch({
      app,
      clientBundle,
      staticRoot: join(outDir, "static"),
    });
    const res = await fetch(new Request("http://test.local/about"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-luxel-static")).toBe("1");
    expect(await res.text()).toContain("About Luxel");
  });
});
