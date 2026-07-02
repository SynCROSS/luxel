import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ensureCoreNodeBuilt } from "./helpers/ensure-core-node.ts";
import { getLuxelCoreNodeModule } from "../src/bench/ensure-core-node.ts";
import { compileRoute } from "../src/compiler/compile-route.ts";
import { createLoadContext } from "../src/resource-store/load-context.ts";
import { ResourceStore } from "../src/resource-store/store.ts";
import { ensureSpiralFixture } from "../src/bench/ensure-spiral-fixture.ts";
import { buildSpiralLuxelSfc } from "../src/bench/fixtures/spiral-sfc.ts";
import { computeSpiralTiles, spiralTileCount } from "../src/bench/fixtures/spiral-html.ts";
import { getLuxelRepoRoot } from "../src/paths.ts";
import { compileApp } from "../src/route/compile-app.ts";
import { mkdir, rm, writeFile } from "node:fs/promises";

const repoRoot = getLuxelRepoRoot();
const baseGenRoot = join(repoRoot, "packages/luxel/src/.generated");

function withRenderBodyFromIrCallCounter<T>(fn: () => T): { result: T; calls: number } {
  const mod = getLuxelCoreNodeModule();
  if (!mod) throw new Error("core-node missing");
  let calls = 0;
  const original = mod.renderBodyFromIr;
  mod.renderBodyFromIr = ((...args: unknown[]) => {
    calls += 1;
    return (original as (...a: unknown[]) => string)(...args);
  }) as typeof mod.renderBodyFromIr;
  try {
    return { result: fn(), calls };
  } finally {
    mod.renderBodyFromIr = original;
  }
}

describe("native hot path avoids generic JSON IR interpreter", () => {
  beforeAll(() => ensureCoreNodeBuilt(), 300_000);

  test("counter native renderFromStore never calls renderBodyFromIr", async () => {
    const counterRoute = join(repoRoot, "examples/counter/src/routes/index.luxel");
    const route = await compileRoute(counterRoute, {
      routeId: "route:index",
      path: "/",
      source: "examples/counter/src/routes/index.luxel",
      componentId: "sfc:counter",
      slug: "index",
      genRoot: join(baseGenRoot, "native-hot-path-no-json-ir-counter"),
      ssrBackend: "native",
    });
    const store = new ResourceStore();
    await route.load(createLoadContext(store));

    const { result: html, calls } = withRenderBodyFromIrCallCounter(() => route.renderFromStore(store));
    expect(calls).toBe(0);
    expect(html).toContain("<h1>Hello Luxel</h1>");
    expect(html).toContain('data-luxel-text="count"');
  }, 180_000);

  test("spiral native renderFromStore never calls renderBodyFromIr", async () => {
    await ensureSpiralFixture(repoRoot);
    const routesDir = join(baseGenRoot, "native-hot-path-no-json-ir-spiral-routes");
    await Bun.write(join(routesDir, "index.luxel"), buildSpiralLuxelSfc());

    const route = await compileRoute(join(routesDir, "index.luxel"), {
      routeId: "route:index",
      path: "/",
      source: "examples/spiral/src/routes/index.luxel",
      componentId: "sfc:spiral",
      slug: "index",
      genRoot: join(baseGenRoot, "native-hot-path-no-json-ir-spiral"),
      ssrBackend: "native",
    });
    const store = new ResourceStore();
    store.set("route:index:tiles", computeSpiralTiles(), { tags: ["spiral"] });
    await route.load(createLoadContext(store));

    const { result: html, calls } = withRenderBodyFromIrCallCounter(() => route.renderFromStore(store));
    expect(calls).toBe(0);
    expect(html.match(/class="tile"/g)?.length).toBe(spiralTileCount());
  }, 180_000);
});

describe("native.mode off keeps TS SSR fallback", () => {
  test("counter app with native.mode off renders through TS without renderBodyFromIr", async () => {
    const rel = `examples/.tmp-native-off-${Date.now()}`;
    const appDir = join(repoRoot, rel);
    await mkdir(join(appDir, "src/routes"), { recursive: true });
    await writeFile(
      join(appDir, "luxel.config.ts"),
      `export default {
  root: ".",
  routesDir: "src/routes",
  outDir: "dist",
  native: { mode: "off" },
};`,
      "utf8",
    );
    await Bun.write(
      join(appDir, "src/routes/index.luxel"),
      await Bun.file(join(repoRoot, "examples/counter/src/routes/index.luxel")).text(),
    );

    try {
      const app = await compileApp(repoRoot, rel);
      expect(app.manifest.native?.effective).toBe("off");
      const route = app.getRoute("/");
      expect(route?.manifestRoute.ssr).toBeUndefined();

      const store = new ResourceStore();
      await route!.load(createLoadContext(store));
      const { result: html, calls } = withRenderBodyFromIrCallCounter(() => route!.renderFromStore(store));
      expect(calls).toBe(0);
      expect(html).toContain("<h1>Hello Luxel</h1>");
    } finally {
      await rm(appDir, { recursive: true, force: true });
    }
  }, 180_000);
});
