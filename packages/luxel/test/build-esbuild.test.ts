import { describe, expect, test } from "bun:test";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildApp } from "../src/build/build-app.ts";
import { esbuildBackend } from "../src/host/backends/esbuild-backend.ts";
import { compileApp } from "../src/route/compile-app.ts";
import { bundleClient } from "../src/build/client-bundle.ts";

const repoRoot = join(import.meta.dir, "../../..");

describe("esbuild build backend", () => {
  test("bundles counter client entry", async () => {
    const app = await compileApp(repoRoot, "examples/counter", {
      bundleBackend: esbuildBackend,
    });
    const genRoot = await app.writeCache();
    const { js } = await bundleClient(genRoot, esbuildBackend);
    expect(js.length).toBeGreaterThan(100);
    expect(js).toContain("hydrateFromDocument");
  });

  test("buildApp emits dist with esbuild backend", async () => {
    const outDir = await buildApp(repoRoot, "examples/counter", {
      bundleBackend: esbuildBackend,
    });
    const manifest = JSON.parse(await readFile(join(outDir, "manifest.json"), "utf8"));
    expect(manifest.routes).toHaveLength(2);
    const js = await readFile(join(outDir, "assets", "client.dev0.js"));
    expect(js.byteLength).toBeGreaterThan(100);
    await access(join(outDir, "server", "app.mjs"));
    await access(join(outDir, "server", "start-node.mjs"));
  });
});
