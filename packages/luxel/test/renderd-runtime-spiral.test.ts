import { beforeAll, describe, expect, test } from "bun:test";
import { ensureCoreNodeBuilt } from "./helpers/ensure-core-node.ts";
import { compileApp } from "../src/route/compile-app.ts";
import { createRenderWorker } from "../src/server/render-worker.ts";
import { ensureSpiralFixture } from "../src/bench/ensure-spiral-fixture.ts";
import { spiralTileCount } from "../src/bench/fixtures/spiral-html.ts";
import { getLuxelRepoRoot } from "../src/paths.ts";

describe("luxel-renderd runtime via render worker", () => {
  beforeAll(() => ensureCoreNodeBuilt(), 300_000);

  test("spiral nativeRuntime process renders through luxel-renderd child", async () => {
    const repoRoot = getLuxelRepoRoot();
    const appDir = await ensureSpiralFixture(repoRoot);
    const app = await compileApp(repoRoot, appDir, {
      routeSsrBackends: { "/": "native" },
      nativeRuntime: "process",
      genRootSuffix: "renderd-runtime-spiral",
      benchNativeLab: true,
    });
    const route = app.getRoute("/");
    expect(route?.manifestRoute.nativeRuntime).toBe("process");
    expect(route?.spiralRenderd).toBeDefined();

    const worker = createRenderWorker(app);
    const { html } = await worker.render("/");
    expect(html.match(/class="tile"/g)?.length).toBe(spiralTileCount());
    expect(html).toContain('id="wrapper"');
  }, 180_000);
});
