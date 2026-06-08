import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { buildApp } from "../src/build/build-app.ts";
import { loadAppFromDist } from "../src/deploy/load-app.ts";
import { createAppFetch } from "../src/server/handler.ts";
import { createTestServer } from "../src/test/server.ts";
import { ResourceStore } from "../src/resource-store/store.ts";
import { createLoadContext } from "../src/resource-store/load-context.ts";

const repoRoot = join(import.meta.dir, "../../..");

describe("deploy render parity", () => {
  test("counter dev server HTML matches loadAppFromDist", async () => {
    const dev = await createTestServer();
    const devRes = await globalThis.fetch(`${dev.url}/`);
    expect(devRes.status).toBe(200);
    const devHtml = await devRes.text();
    await dev.close();

    const outDir = await buildApp(repoRoot, "examples/counter");
    const { app, clientBundle } = await loadAppFromDist(outDir);
    const deployFetch = createAppFetch({ app, clientBundle });
    const deployRes = await deployFetch(new Request("http://localhost/"));
    const deployHtml = await deployRes.text();

    expect(deployHtml).toContain("Hello Luxel");
    expect(deployHtml).toContain('id="luxel-data"');
    expect(normalizeHtml(deployHtml)).toBe(normalizeHtml(devHtml));
  });

  test("renderFromStore matches bundled route module for counter", async () => {
    const outDir = await buildApp(repoRoot, "examples/counter");
    const { app } = await loadAppFromDist(outDir);
    const route = app.getRoute("/");
    expect(route).toBeDefined();

    const store = new ResourceStore();
    const ctx = createLoadContext(store, null);
    await route!.load(ctx);

    const fromDeploy = route!.renderFromStore(store);
    expect(fromDeploy).toContain("Hello Luxel");
  });
});

function normalizeHtml(html: string): string {
  return html.replace(/\s+/g, " ").trim();
}
