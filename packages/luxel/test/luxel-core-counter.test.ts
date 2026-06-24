import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ensureCoreNodeBuilt } from "./helpers/ensure-core-node.ts";
import { compileRoute } from "../src/compiler/compile-route.ts";
import { createLoadContext } from "../src/resource-store/load-context.ts";
import { ResourceStore } from "../src/resource-store/store.ts";
import { getLuxelRepoRoot } from "../src/paths.ts";

const repoRoot = getLuxelRepoRoot();
const genRoot = join(repoRoot, "packages/luxel/src/.generated");
const counterRoute = join(repoRoot, "examples/counter/src/routes/index.luxel");

describe("luxel-core native counter SSR", () => {
  beforeAll(() => ensureCoreNodeBuilt(), 300_000);

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
