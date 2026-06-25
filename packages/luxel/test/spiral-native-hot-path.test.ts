import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ensureCoreNodeBuilt } from "./helpers/ensure-core-node.ts";
import { compileRoute } from "../src/compiler/compile-route.ts";
import { createLoadContext } from "../src/resource-store/load-context.ts";
import { ResourceStore } from "../src/resource-store/store.ts";
import { ensureSpiralFixture } from "../src/bench/ensure-spiral-fixture.ts";
import { buildSpiralLuxelSfc } from "../src/bench/fixtures/spiral-sfc.ts";
import { computeSpiralTiles, spiralTileCount } from "../src/bench/fixtures/spiral-html.ts";
import { getLuxelRepoRoot } from "../src/paths.ts";

const repoRoot = getLuxelRepoRoot();
const genRoot = join(repoRoot, "packages/luxel/src/.generated/spiral-native-hot-path");

describe("spiral native hot path", () => {
  beforeAll(() => ensureCoreNodeBuilt(), 300_000);

  test("compileRoute native uses renderBodyFromIr for spiral tiles", async () => {
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
      ssrBackend: "native",
    });

    const store = new ResourceStore();
    store.set("route:index:tiles", computeSpiralTiles(), { tags: ["spiral"] });
    await route.load(createLoadContext(store));

    const html = route.renderFromStore(store);
    expect(html.match(/class="tile"/g)?.length).toBe(spiralTileCount());
    expect(html).toContain('id="wrapper"');
  }, 180_000);
});
