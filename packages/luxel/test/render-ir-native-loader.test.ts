import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ensureCoreNodeBuilt } from "./helpers/ensure-core-node.ts";
import { compileRoute } from "../src/compiler/compile-route.ts";
import { createLoadContext } from "../src/resource-store/load-context.ts";
import { ResourceStore } from "../src/resource-store/store.ts";
import { buildSpiralLuxelSfc } from "../src/bench/fixtures/spiral-sfc.ts";
import { computeSpiralTiles } from "../src/bench/fixtures/spiral-html.ts";
import { getLuxelRepoRoot } from "../src/paths.ts";

const genRoot = join(getLuxelRepoRoot(), "packages/luxel/src/.generated/render-ir-native-loader");

describe("render-ir-native loader", () => {
  beforeAll(() => ensureCoreNodeBuilt(), 300_000);

  test("native renderFromStore resolves core-node without package name in bundle cwd", async () => {
    const routesDir = join(genRoot, "routes");
    await Bun.write(join(routesDir, "index.luxel"), buildSpiralLuxelSfc());

    const route = await compileRoute(join(routesDir, "index.luxel"), {
      routeId: "route:index",
      path: "/",
      source: "examples/spiral/src/routes/index.luxel",
      componentId: "sfc:spiral",
      slug: "index",
      genRoot,
      ssrBackend: "native",
    });

    const store = new ResourceStore();
    store.set("route:index:tiles", computeSpiralTiles(), { tags: ["spiral"] });
    await route.load(createLoadContext(store));

    const html = route.renderFromStore(store);
    expect(html).toContain('id="wrapper"');
    expect(html.match(/class="tile"/g)?.length).toBeGreaterThan(2000);
  }, 180_000);
});
