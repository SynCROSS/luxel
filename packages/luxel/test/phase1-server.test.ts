import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { compileCounterApp, compileNavDemoApp } from "../src/route/compile-app.ts";
import { createRenderWorker } from "../src/server/render-worker.ts";
import { isLuxelDataV2 } from "../src/resource-store/luxel-data.ts";

const repoRoot = join(import.meta.dir, "../../..");

describe("phase-1 server pipeline", () => {
  test("SSR embeds luxel-data v2 resource snapshot", async () => {
    const app = await compileCounterApp(repoRoot);
    const worker = createRenderWorker(app);
    const { html, data } = await worker.renderIndex();
    expect(isLuxelDataV2(data)).toBe(true);
    expect(html).toContain('"version":2');
    expect(html).toContain("route:index:message");
    expect(html).toContain("Hello Luxel");
  });

  test("manifest includes template binding map", async () => {
    const app = await compileCounterApp(repoRoot);
    const route = app.manifest.routes.find((r) => r.id === "route:index");
    expect(route?.bindings).toEqual([
      { templateId: "message", resourceKey: "route:index:message", field: "message" },
    ]);
  });

  test("nav-demo index exports prefetch beside load", async () => {
    const app = await compileNavDemoApp(repoRoot);
    const index = app.manifest.routes.find((r) => r.id === "route:index");
    expect(index?.hasPrefetch).toBe(true);
    expect(app.getRoute("/")?.prefetch).toBeDefined();
  });
});
