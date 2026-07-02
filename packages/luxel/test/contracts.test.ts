import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  loadLuxelDataContract,
  loadLuxelHydrationContract,
  loadManifestContract,
  loadSsrContract,
} from "../src/contracts/loader.ts";
import {
  assertManifestMatches,
  assertSsrContainsRequiredParts,
  assertSsrDocumentMatches,
} from "../src/contracts/assert.ts";
import { compileCounterApp } from "../src/route/compile-app.ts";
import { createRenderWorker } from "../src/server/render-worker.ts";

const repoRoot = join(import.meta.dir, "../../..");

describe("artifact contracts", () => {
  test("golden manifest includes counter index route", async () => {
    const app = await compileCounterApp(repoRoot);
    const golden = loadManifestContract();
    const index = app.manifest.routes.find((r) => r.id === "route:index");
    const goldenIndex = golden.routes.find((r) => r.id === "route:index");
    expect(index).toBeDefined();
    const stripNativeSsrFields = <T extends { ssr?: string; nativeRuntime?: string }>(route: T) => {
      const { ssr: _ssr, nativeRuntime: _nativeRuntime, ...rest } = route;
      return rest;
    };
    assertManifestMatches(
      {
        version: 2,
        routes: [stripNativeSsrFields(index!)],
        components: [app.manifest.components.find((c) => c.id === "sfc:index")!],
      },
      {
        version: 2,
        routes: [stripNativeSsrFields(goldenIndex!)],
        components: [golden.components.find((c) => c.id === "sfc:index")!],
      },
    );
  });

  test("render worker SSR matches golden document", async () => {
    const app = await compileCounterApp(repoRoot);
    const worker = createRenderWorker(app);
    const { html } = await worker.renderIndex();
    assertSsrDocumentMatches(html, loadSsrContract());
    assertSsrContainsRequiredParts(html);
  });

  test("sidecar contracts are JSON-shaped", () => {
    expect(loadLuxelDataContract().message).toBe("Hello Luxel");
    expect(loadLuxelHydrationContract().routeId).toBe("route:index");
  });
});
