import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ensureCoreNodeBuilt } from "./helpers/ensure-core-node.ts";
import { compileRoute } from "../src/compiler/compile-route.ts";
import { compileApp } from "../src/route/compile-app.ts";
import { createLoadContext } from "../src/resource-store/load-context.ts";
import { ResourceStore } from "../src/resource-store/store.ts";
import { createRenderWorker } from "../src/server/render-worker.ts";
import { isRenderdRuntimeAvailable } from "../src/config/native-runtime.ts";
import { ensureSpiralFixture } from "../src/bench/ensure-spiral-fixture.ts";
import { buildSpiralLuxelSfc } from "../src/bench/fixtures/spiral-sfc.ts";
import { spiralTileCount } from "../src/bench/fixtures/spiral-html.ts";
import { assertDeprecatedRouteNapiGone } from "../src/luxel-core/render-ir-native.ts";
import { readStreamToText } from "../src/compiler/stream-document.ts";
import { countStreamChunks } from "../src/luxel-core/stream-spiral-native.ts";
import { getLuxelCoreNodeModule } from "../src/bench/ensure-core-node.ts";
import { getLuxelRepoRoot } from "../src/paths.ts";

const repoRoot = getLuxelRepoRoot();
const genRoot = join(repoRoot, "packages/luxel/src/.generated");
const spiralGen = join(genRoot, "luxel-core-spiral");

describe("luxel-core native spiral SSR", () => {
  beforeAll(() => ensureCoreNodeBuilt(), 300_000);

  test("native spiral stream matches buffered document", async () => {
    await ensureSpiralFixture(repoRoot);
    const routesDir = join(spiralGen, "routes-stream");
    await Bun.write(join(routesDir, "index.luxel"), buildSpiralLuxelSfc());
    const route = await compileRoute(join(routesDir, "index.luxel"), {
      routeId: "route:index",
      path: "/",
      source: "examples/spiral/src/routes/index.luxel",
      componentId: "sfc:spiral",
      slug: "index",
      genRoot: join(genRoot, "luxel-core-spiral-stream"),
      ssrBackend: "native",
    });
    const store = new ResourceStore();
    await route.load(createLoadContext(store));
    const html = route.renderFromStore(store);
    const streamed = await readStreamToText(route.renderStreamFromStore(store));
    expect(streamed).toBe(html);
    expect(await countStreamChunks(route.renderStreamFromStore(store))).toBeGreaterThan(2);
  }, 180_000);

  test("renderSpiralBody() emits bench spiral markup without tile marshalling", () => {
    const mod = getLuxelCoreNodeModule();
    const renderSpiralBody = mod?.renderSpiralBody;
    expect(typeof renderSpiralBody).toBe("function");
    const body = (renderSpiralBody as () => string)();
    expect(body).toContain('id="wrapper"');
    expect(body.match(/class="tile"/g)?.length).toBe(spiralTileCount());
  });

  test("per-route spiral NAPI entrypoints are deprecated", () => {
    assertDeprecatedRouteNapiGone();
  });

  test("native spiral static-load route stays per-request without precompute", async () => {
    await ensureSpiralFixture(repoRoot);
    const routesDir = join(spiralGen, "routes-precompute");
    await Bun.write(join(routesDir, "index.luxel"), buildSpiralLuxelSfc());

    const route = await compileRoute(join(routesDir, "index.luxel"), {
      routeId: "route:index",
      path: "/",
      source: "examples/spiral/src/routes/index.luxel",
      componentId: "sfc:spiral",
      slug: "index",
      genRoot: join(genRoot, "luxel-core-spiral-native-no-precompute"),
      ssrBackend: "native",
    });

    expect(route.precomputedHtml).toBeUndefined();
    expect(route.precomputedData).toBeUndefined();
  }, 180_000);

  test("compileApp spiral auto-selects native ssr when core-node loadable", async () => {
    const appDir = await ensureSpiralFixture(repoRoot);
    const app = await compileApp(repoRoot, appDir, {
      genRootSuffix: "luxel-core-spiral-auto-merge",
    });
    const route = app.getRoute("/");
    expect(route?.manifestRoute.ssr).toBe("native");
    expect(route?.precomputedHtml).toBeUndefined();
    if (isRenderdRuntimeAvailable()) {
      expect(route?.manifestRoute.nativeRuntime).toBe("process");
      expect(route?.spiralRenderd).toBeDefined();
    }
  }, 180_000);

  test("compileRoute spiral native auto resolves renderd process runtime", async () => {
    if (!isRenderdRuntimeAvailable()) return;
    await ensureSpiralFixture(repoRoot);
    const routesDir = join(spiralGen, "routes-renderd-auto");
    await Bun.write(join(routesDir, "index.luxel"), buildSpiralLuxelSfc());
    const route = await compileRoute(join(routesDir, "index.luxel"), {
      routeId: "route:index",
      path: "/",
      source: "examples/spiral/src/routes/index.luxel",
      componentId: "sfc:spiral",
      slug: "index",
      genRoot: join(genRoot, "luxel-core-spiral-renderd-auto"),
      ssrBackend: "native",
    });
    expect(route.manifestRoute.nativeRuntime).toBe("process");
    expect(route.spiralRenderd).toBeDefined();
  }, 180_000);

  test("explicit spiral native lab compile stays per-request", async () => {
    const appDir = await ensureSpiralFixture(repoRoot);
    const app = await compileApp(repoRoot, appDir, {
      genRootSuffix: "luxel-core-spiral-native-lab",
      routeSsrBackends: { "/": "native" },
      benchNativeLab: true,
    });
    const route = app.getRoute("/");
    expect(route?.manifestRoute.ssr).toBe("native");
    expect(route?.precomputedHtml).toBeUndefined();
  }, 180_000);

  test("native renderFromStore matches TS compiled spiral HTML", async () => {
    await ensureSpiralFixture(repoRoot);
    const routesDir = join(spiralGen, "routes");
    await Bun.write(join(routesDir, "index.luxel"), buildSpiralLuxelSfc());

    const routeOpts = {
      routeId: "route:index",
      path: "/",
      source: "examples/spiral/src/routes/index.luxel",
      componentId: "sfc:spiral",
      slug: "index",
    } as const;

    const tsRoute = await compileRoute(join(routesDir, "index.luxel"), {
      ...routeOpts,
      genRoot: join(genRoot, "luxel-core-spiral-ts"),
      ssrBackend: "ts",
    });
    const nativeRoute = await compileRoute(join(routesDir, "index.luxel"), {
      ...routeOpts,
      genRoot: join(genRoot, "luxel-core-spiral-native"),
      ssrBackend: "native",
    });

    const store = new ResourceStore();
    await tsRoute.load(createLoadContext(store));

    const tsHtml = tsRoute.renderFromStore(store);
    const nativeHtml = nativeRoute.renderFromStore(store);
    expect(nativeHtml).toBe(tsHtml);
    expect(nativeHtml.match(/class="tile"/g)?.length).toBe(spiralTileCount());
  }, 180_000);

  test("manifest ssr native delegates render worker to luxel-core", async () => {
    const appDir = await ensureSpiralFixture(repoRoot);
    const app = await compileApp(repoRoot, appDir, {
      routeSsrBackends: { "/": "native" },
    });
    const route = app.manifest.routes.find((r) => r.path === "/");
    expect(route?.ssr).toBe("native");

    const worker = createRenderWorker(app);
    const { html } = await worker.render("/");
    expect(html.match(/class="tile"/g)?.length).toBe(spiralTileCount());
    expect(html).not.toContain('id="luxel-data"');
  }, 180_000);
});
