import { describe, expect, test } from "bun:test";
import { buildApp } from "../src/build/build-app.ts";
import { join } from "node:path";
import { access, readFile } from "node:fs/promises";
import { assertManifestMatches } from "../src/contracts/assert.ts";
import { loadManifestContract } from "../src/contracts/loader.ts";

const repoRoot = join(import.meta.dir, "../../..");

describe("luxel build", () => {
  test("emits manifest and assets", async () => {
    const outDir = await buildApp(repoRoot, "examples/counter");
    const manifest = JSON.parse(await readFile(join(outDir, "manifest.json"), "utf8"));
    expect(manifest.routes).toHaveLength(2);
    const golden = loadManifestContract();
    const index = manifest.routes.find((r: { id: string }) => r.id === "route:index");
    const goldenIndex = golden.routes.find((r) => r.id === "route:index");
    assertManifestMatches(
      { version: 1, routes: [index], components: [manifest.components.find((c: { id: string }) => c.id === "sfc:index")] },
      { version: 1, routes: [goldenIndex], components: [golden.components.find((c) => c.id === "sfc:index")] },
    );
    const about = manifest.routes.find((r: { id: string }) => r.id === "route:about");
    expect(about?.path).toBe("/about");
    const js = await readFile(join(outDir, "assets", "client.dev0.js"));
    expect(js.byteLength).toBeGreaterThan(100);
    const entry = await readFile(join(outDir, "server", "entry.js"), "utf8");
    expect(entry).toContain("productionCompress");
    await access(join(outDir, "server", "app.mjs"));
    await access(join(outDir, "server", "start-node.mjs"));
    await access(join(outDir, "server", "start-deno.mjs"));
  });
});
