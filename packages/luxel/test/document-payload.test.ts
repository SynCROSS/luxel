import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { compileApp, compileCounterApp } from "../src/route/compile-app.ts";
import { compileRoute } from "../src/compiler/compile-route.ts";
import { LuxelCompileError } from "../src/compiler/diagnostics.ts";
import { createRenderWorker } from "../src/server/render-worker.ts";
import { ensureSpiralFixture } from "../src/bench/ensure-spiral-fixture.ts";
import { getLuxelRepoRoot } from "../src/paths.ts";
import { assertSsrContainsRequiredParts } from "../src/contracts/assert.ts";

const repoRoot = getLuxelRepoRoot();
const neverExportGenRoot = join(repoRoot, "packages/luxel/src/.generated/document-payload-never");
const configNeverGenRoot = join(repoRoot, "packages/luxel/src/.generated/document-payload-config");
const sfcWinsGenRoot = join(repoRoot, "packages/luxel/src/.generated/document-payload-sfc-wins");

describe("document payload policy", () => {
  test("spiral SSR omits luxel sidecars and client script", async () => {
    const appDir = await ensureSpiralFixture(repoRoot);
    const app = await compileApp(repoRoot, appDir);
    const worker = createRenderWorker(app);
    const { html } = await worker.render("/");

    expect(html).toContain('id="wrapper"');
    expect(html).not.toContain('id="luxel-data"');
    expect(html).not.toContain('id="luxel-hydration"');
    expect(html).not.toMatch(/<script type="module"/);
  });

  test("spiral manifest records zero-client shipSidecars", async () => {
    const appDir = await ensureSpiralFixture(repoRoot);
    const app = await compileApp(repoRoot, appDir);
    const route = app.manifest.routes.find((r) => r.path === "/");
    expect(route?.client).toEqual({ hydration: "auto" });
    expect(route?.shipSidecars).toEqual({
      data: false,
      hydration: false,
      clientScript: false,
    });
  });

  test("client hydration never export strips sidecars", async () => {
    const routesDir = join(neverExportGenRoot, "routes");
    await mkdir(routesDir, { recursive: true });
    const sfcPath = join(routesDir, "index.luxel");
    await writeFile(
      sfcPath,
      `<template>
  <h1>{msg}</h1>
</template>
<script>
export const client = { hydration: 'never' };
export async function load(ctx) {
  ctx.store.set("route:plain:msg", "hi");
}
</script>`,
      "utf8",
    );

    const route = await compileRoute(sfcPath, {
      routeId: "route:plain",
      path: "/",
      source: "test/document-payload/never-export/index.luxel",
      componentId: "sfc:plain",
      slug: "plain",
      genRoot: neverExportGenRoot,
    });

    expect(route.manifestRoute.client).toEqual({ hydration: "never" });
    expect(route.manifestRoute.shipSidecars).toEqual({
      data: false,
      hydration: false,
      clientScript: false,
    });
  });

  test("config hydration never applies when SFC omits client export", async () => {
    const routesDir = join(configNeverGenRoot, "routes");
    await mkdir(routesDir, { recursive: true });
    const sfcPath = join(routesDir, "index.luxel");
    await writeFile(
      sfcPath,
      `<template>
  <h1>{msg}</h1>
</template>
<script>
export async function load(ctx) {
  ctx.store.set("route:cfg:msg", "hi");
}
</script>`,
      "utf8",
    );

    const route = await compileRoute(sfcPath, {
      routeId: "route:cfg",
      path: "/",
      source: "test/document-payload/config-never/index.luxel",
      componentId: "sfc:cfg",
      slug: "cfg",
      genRoot: configNeverGenRoot,
      configClientHydration: "never",
    });

    expect(route.manifestRoute.client).toEqual({ hydration: "never" });
    expect(route.manifestRoute.shipSidecars).toEqual({
      data: false,
      hydration: false,
      clientScript: false,
    });
  });

  test("SFC client export wins over config hydration", async () => {
    const routesDir = join(sfcWinsGenRoot, "routes");
    await mkdir(routesDir, { recursive: true });
    const sfcPath = join(routesDir, "index.luxel");
    await writeFile(
      sfcPath,
      `<template>
  <h1>{msg}</h1>
</template>
<script>
export const client = { hydration: 'never' };
export async function load(ctx) {
  ctx.store.set("route:win:msg", "hi");
}
</script>`,
      "utf8",
    );

    const route = await compileRoute(sfcPath, {
      routeId: "route:win",
      path: "/",
      source: "test/document-payload/sfc-wins/index.luxel",
      componentId: "sfc:win",
      slug: "win",
      genRoot: sfcWinsGenRoot,
      configClientHydration: "auto",
    });

    expect(route.manifestRoute.client).toEqual({ hydration: "never" });
    expect(route.manifestRoute.shipSidecars).toEqual({
      data: false,
      hydration: false,
      clientScript: false,
    });
  });

  test("hydration never plus hydrate boundary is compile error", async () => {
    const dir = await mkdtemp(join(tmpdir(), "luxel-payload-"));
    const sfcPath = join(dir, "index.luxel");
    await writeFile(
      sfcPath,
      `<template>
  <div hydrate:load>{x}</div>
</template>
<script>
export const client = { hydration: 'never' };
export async function load(ctx) {
  ctx.store.set("route:conflict:x", 1);
}
</script>`,
      "utf8",
    );

    await expect(
      compileRoute(sfcPath, {
        routeId: "route:conflict",
        path: "/",
        source: "index.luxel",
        componentId: "sfc:conflict",
        slug: "conflict",
        genRoot: join(dir, ".luxel-gen"),
      }),
    ).rejects.toThrow(LuxelCompileError);
  });

  test("counter SSR keeps luxel sidecars and client script", async () => {
    const app = await compileCounterApp(repoRoot);
    const worker = createRenderWorker(app);
    const { html } = await worker.renderIndex();

    assertSsrContainsRequiredParts(html);
    expect(html).toMatch(/<script type="module"/);
  });
});
