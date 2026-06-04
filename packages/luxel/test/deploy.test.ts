import { describe, expect, test } from "bun:test";
import { buildApp } from "../src/build/build-app.ts";
import { loadAppFromDist } from "../src/deploy/load-app.ts";
import { createAppFetch } from "../src/server/handler.ts";
import { join } from "node:path";
import { access } from "node:fs/promises";

const repoRoot = join(import.meta.dir, "../../..");

describe("loadAppFromDist", () => {
  test("built counter dist serves SSR via deploy bundle", async () => {
    const outDir = await buildApp(repoRoot, "examples/counter");
    await access(join(outDir, "server", "app.mjs"));
    const { app, clientBundle } = await loadAppFromDist(outDir);
    const fetch = createAppFetch({ app, clientBundle });
    const res = await fetch(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Hello Luxel");
    expect(html).toContain('id="luxel-data"');
  });

  test("missing bundle throws clear error", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const emptyDist = await mkdtemp(join(tmpdir(), "luxel-dist-"));
    await expect(loadAppFromDist(emptyDist)).rejects.toThrow(/deploy bundle|client asset/i);
  });
});
