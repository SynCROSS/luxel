import { describe, expect, test } from "bun:test";
import { compileApp } from "../src/route/compile-app.ts";
import { createRenderWorker } from "../src/server/render-worker.ts";
import { ensureSpiralFixture } from "../src/bench/ensure-spiral-fixture.ts";
import { buildSpiralLuxelSfc } from "../src/bench/fixtures/spiral-sfc.ts";
import { spiralTileCount } from "../src/bench/fixtures/spiral-html.ts";
import { getLuxelRepoRoot } from "../src/paths.ts";

const repoRoot = getLuxelRepoRoot();

describe("spiral tier-2 bench fixture", () => {
  test("spiral SFC uses load + each (no static tile bake)", () => {
    const sfc = buildSpiralLuxelSfc();
    expect(sfc).toContain("{#each tiles as t}");
    expect(sfc).toContain("computeSpiralTiles");
    expect(sfc).toContain("void ctx.session");
    expect((sfc.match(/class="tile"/g) ?? []).length).toBe(1);
  });

  test("spiral compiled render uses toFixed(2) for tile coords", async () => {
    const appDir = await ensureSpiralFixture(repoRoot);
    const app = await compileApp(repoRoot, appDir);
    const index = app.routes.find((r) => r.path === "/");
    expect(index?.serverModuleSrc).toMatch(/toFixed\(2\)/);
  });

  test("compiles and renders via render worker", async () => {
    const appDir = await ensureSpiralFixture(repoRoot);
    const app = await compileApp(repoRoot, appDir);
    const index = app.routes.find((r) => r.path === "/");
    expect(index?.precomputedHtml).toBeUndefined();

    const worker = createRenderWorker(app);
    const { html } = await worker.render("/");
    expect(html).toContain('id="wrapper"');
    expect(html).toContain('class="tile"');
    const tileMatches = html.match(/class="tile"/g);
    expect(tileMatches?.length).toBe(spiralTileCount());
  }, 120_000);
});
