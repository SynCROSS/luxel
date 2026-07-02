import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ensureCoreNodeBuilt } from "./helpers/ensure-core-node.ts";
import { getLuxelCoreNodeModule } from "../src/bench/ensure-core-node.ts";
import { compileRoute } from "../src/compiler/compile-route.ts";
import { createLoadContext } from "../src/resource-store/load-context.ts";
import { ResourceStore } from "../src/resource-store/store.ts";
import { getLuxelRepoRoot } from "../src/paths.ts";
import { compileCounterApp } from "../src/route/compile-app.ts";

const repoRoot = getLuxelRepoRoot();
const genRoot = join(repoRoot, "packages/luxel/src/.generated");
const counterRoute = join(repoRoot, "examples/counter/src/routes/index.luxel");

describe("luxel-core native counter SSR", () => {
  beforeAll(() => ensureCoreNodeBuilt(), 300_000);

  test("renderCounterBody(message) emits bench counter markup without JSON snapshot", () => {
    const mod = getLuxelCoreNodeModule();
    const renderCounterBody = mod?.renderCounterBody;
    expect(typeof renderCounterBody).toBe("function");
    const body = (renderCounterBody as (message: string) => string)("Hello Luxel");
    expect(body).toContain("<h1>Hello Luxel</h1>");
    expect(body).toContain('data-luxel-text="count"');
    expect(body).toContain(">0</button>");
  });

  test("native counter renderFromStore survives renderBodyFromIr failure", async () => {
    const mod = getLuxelCoreNodeModule();
    if (!mod) throw new Error("core-node missing");
    const previousStrict = process.env.LUXEL_BENCH_STRICT_NATIVE;
    process.env.LUXEL_BENCH_STRICT_NATIVE = "1";
    const original = mod.renderBodyFromIr;
    mod.renderBodyFromIr = () => {
      throw new Error("IR path blocked");
    };
    try {
      const route = await compileRoute(counterRoute, {
        routeId: "route:index",
        path: "/",
        source: "examples/counter/src/routes/index.luxel",
        componentId: "sfc:counter",
        slug: "index",
        genRoot: join(genRoot, "luxel-core-counter-hot-path"),
        ssrBackend: "native",
      });
      const store = new ResourceStore();
      await route.load(createLoadContext(store));
      const html = route.renderFromStore(store);
      expect(html).toContain("<h1>Hello Luxel</h1>");
      expect(html).toContain('data-luxel-text="count"');
    } finally {
      mod.renderBodyFromIr = original;
      if (previousStrict === undefined) delete process.env.LUXEL_BENCH_STRICT_NATIVE;
      else process.env.LUXEL_BENCH_STRICT_NATIVE = previousStrict;
    }
  }, 180_000);

  test("native counter static-load route precomputes document at compile time", async () => {
    const route = await compileRoute(counterRoute, {
      routeId: "route:index",
      path: "/",
      source: "examples/counter/src/routes/index.luxel",
      componentId: "sfc:counter",
      slug: "index",
      genRoot: join(genRoot, "luxel-core-counter-native-precompute"),
      ssrBackend: "native",
    });

    expect(route.precomputedHtml).toBeDefined();
    expect(route.precomputedData).toBeDefined();
    expect(route.precomputedHtml).toContain("<h1>Hello Luxel</h1>");
    expect(route.precomputedHtml).toContain('data-luxel-text="count"');

    const store = new ResourceStore();
    await route.load(createLoadContext(store));
    expect(route.renderFromStore(store)).toBe(route.precomputedHtml);
  }, 180_000);

  test("explicit native lab compile skips static precompute", async () => {
    const app = await compileCounterApp(repoRoot, {
      genRootSuffix: "luxel-core-counter-native-lab",
      routeSsrBackends: { "/": "native" },
      benchNativeLab: true,
    });
    const route = app.getRoute("/");
    expect(route?.manifestRoute.ssr).toBe("native");
    expect(route?.precomputedHtml).toBeUndefined();
  }, 180_000);

  test("compileCounterApp auto-selects native ssr when core-node loadable", async () => {
    const app = await compileCounterApp(repoRoot, {
      genRootSuffix: "luxel-core-counter-auto-merge",
    });
    const route = app.getRoute("/");
    expect(route?.manifestRoute.ssr).toBe("native");
    expect(route?.precomputedHtml).toBeDefined();
  }, 180_000);

  test("native renderFromStore matches TS compiled counter HTML", async () => {
    const routeOpts = {
      routeId: "route:index",
      path: "/",
      source: "examples/counter/src/routes/index.luxel",
      componentId: "sfc:counter",
      slug: "index",
    } as const;

    const tsRoute = await compileRoute(counterRoute, {
      ...routeOpts,
      genRoot: join(genRoot, "luxel-core-counter-ts"),
      ssrBackend: "ts",
    });
    const nativeRoute = await compileRoute(counterRoute, {
      ...routeOpts,
      genRoot: join(genRoot, "luxel-core-counter-native"),
      ssrBackend: "native",
    });

    const store = new ResourceStore();
    await tsRoute.load(createLoadContext(store));

    const tsHtml = tsRoute.renderFromStore(store);
    const nativeHtml = nativeRoute.renderFromStore(store);
    expect(nativeHtml).toBe(tsHtml);
  }, 180_000);

  test("native render escapes attacker-shaped message in HTML", async () => {
    const route = await compileRoute(counterRoute, {
      routeId: "route:index",
      path: "/",
      source: "examples/counter/src/routes/index.luxel",
      componentId: "sfc:counter",
      slug: "index",
      genRoot: join(genRoot, "luxel-core-counter-native-escape"),
      ssrBackend: "native",
    });

    const store = new ResourceStore();
    await route.load(createLoadContext(store));
    store.set(
      "route:index:message",
      { message: '<img src=x onerror="alert(1)">' },
      { tags: ["home"] },
    );

    const html = route.renderFromStore(store);
    expect(html).toContain("&lt;img");
    expect(html).not.toContain('<img src=x onerror="alert(1)">');
  }, 180_000);
});
