import { describe, expect, test } from "bun:test";
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
import { generateCounterManifest } from "../src/manifest/generate.ts";
import { createRenderWorker } from "../src/server/render-worker.ts";

describe("artifact contracts", () => {
  test("golden manifest matches generator", () => {
    assertManifestMatches(generateCounterManifest(), loadManifestContract());
  });

  test("render worker SSR matches golden document", async () => {
    const worker = createRenderWorker();
    const { html } = await worker.renderIndex();
    assertSsrDocumentMatches(html, loadSsrContract());
    assertSsrContainsRequiredParts(html);
  });

  test("sidecar contracts are JSON-shaped", () => {
    expect(loadLuxelDataContract().message).toBe("Hello Luxel");
    expect(loadLuxelHydrationContract().routeId).toBe("route:index");
  });
});
