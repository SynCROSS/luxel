import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ensureCoreNodeBuilt } from "./helpers/ensure-core-node.ts";
import { compileRoute } from "../src/compiler/compile-route.ts";
import { compileApp } from "../src/route/compile-app.ts";
import { createLoadContext } from "../src/resource-store/load-context.ts";
import { ResourceStore } from "../src/resource-store/store.ts";
import { createRenderWorker } from "../src/server/render-worker.ts";
import { ensureSpiralFixture } from "../src/bench/ensure-spiral-fixture.ts";
import { buildSpiralLuxelSfc } from "../src/bench/fixtures/spiral-sfc.ts";
import { spiralTileCount } from "../src/bench/fixtures/spiral-html.ts";
import { getLuxelRepoRoot } from "../src/paths.ts";

const repoRoot = getLuxelRepoRoot();
const genRoot = join(repoRoot, "packages/luxel/src/.generated/luxel-core-spiral");

describe("luxel-core native spiral SSR", () => {
  beforeAll(() => ensureCoreNodeBuilt(), 300_000);

  test("native renderRouteDocumentFromStore matches TS compiled spiral HTML", async () => {
    const { renderSpiralRouteFromStore } = await import("@luxel/core-node");

    await ensureSpiralFixture(repoRoot);
    const routesDir = join(genRoot, "routes");
    await Bun.write(join(routesDir, "index.luxel"), buildSpiralLuxelSfc());

    const route = await compileRoute(join(routesDir, "index.luxel"), {
      routeId: "route:index",
      path: "/",
      source: "examples/spiral/src/routes/index.luxel",
      componentId: "sfc:spiral",
      slug: "index",
      genRoot,
    });

    const store = new ResourceStore();
    await route.load(createLoadContext(store));
    const tsHtml = route.renderFromStore(store);

    const nativeHtml = renderSpiralRouteFromStore(JSON.stringify(store.snapshot()));
    expect(nativeHtml).toBe(tsHtml);
  }, 180_000);

  test("manifest ssr native delegates render worker to luxel-core", async () => {
    const appDir = await ensureSpiralFixture(repoRoot);
    const app = await compileApp(repoRoot, appDir);
    const route = app.manifest.routes.find((r) => r.path === "/");
    expect(route?.ssr).toBe("native");

    const worker = createRenderWorker(app);
    const { html } = await worker.render("/");
    expect(html.match(/class="tile"/g)?.length).toBe(spiralTileCount());
    expect(html).not.toContain('id="luxel-data"');
  }, 180_000);
});
