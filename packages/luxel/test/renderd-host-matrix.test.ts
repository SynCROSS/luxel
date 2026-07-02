import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { ensureCoreNodeBuilt } from "./helpers/ensure-core-node.ts";
import { createRenderdClient } from "../src/renderd/client.ts";
import { renderSpiralBenchDocument } from "../src/renderd/renderd-entry.ts";
import { canSpawnRenderdChild, resolveRenderdChildRuntime } from "../src/renderd/spawn.ts";
import { findDenoExecutable } from "../src/util/find-deno.ts";
import { findNodeExecutable } from "../src/util/find-node.ts";
import { ensureRenderdNodeHostBundle } from "./helpers/ensure-renderd-node-host-bundle.ts";
import { spiralTileCount } from "../src/bench/fixtures/spiral-html.ts";

const repoRoot = join(import.meta.dir, "../../..");
const deno = findDenoExecutable();
const denoPerms = [
  "run",
  "--allow-read",
  "--allow-env",
  "--allow-write",
  "--allow-run",
  "--allow-sys",
];

const SPIRAL_HEAD_STYLE = `#wrapper { position: relative; width: 960px; height: 720px; }
.tile { position: absolute; width: 10px; height: 10px; background: #333; }`;

describe("renderd host matrix", () => {
  beforeAll(() => ensureCoreNodeBuilt(), 300_000);

  test("node executable discoverable on Windows host matrix", () => {
    expect(findNodeExecutable()).not.toBeNull();
    expect(canSpawnRenderdChild()).toBe(true);
  });

  test("resolveRenderdChildRuntime auto prefers bun under bun test", () => {
    expect(resolveRenderdChildRuntime("auto")).toBe("bun");
    expect(resolveRenderdChildRuntime("node")).toBe("node");
  });

  test("createRenderdClient childRuntime node renders spiral via node child_process", async () => {
    const client = await createRenderdClient({ childRuntime: "node" });
    try {
      const fromRenderd = await client.renderSpiralDocument("/", SPIRAL_HEAD_STYLE);
      const inline = renderSpiralBenchDocument("/", SPIRAL_HEAD_STYLE);
      expect(fromRenderd).toBe(inline);
      expect(fromRenderd.match(/class="tile"/g)?.length).toBe(spiralTileCount());
    } finally {
      await client.close();
    }
  }, 180_000);

  test("node host subprocess runs renderd client bundle", () => {
    const nodeBin = findNodeExecutable();
    expect(nodeBin).not.toBeNull();
    const bundle = ensureRenderdNodeHostBundle();
    const result = spawnSync(nodeBin!, [bundle], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 180_000,
      env: {
        ...process.env,
        NODE_NO_WARNINGS: "1",
        LUXEL_PKG_SRC: join(repoRoot, "packages/luxel/src"),
        LUXEL_REPO_ROOT: repoRoot,
      },
    });
    const out = `${result.stderr}${result.stdout}`;
    if (result.status !== 0) {
      throw new Error(`node host renderd child failed (${result.status}): ${out}`);
    }
    expect(out).toContain("renderd-node-host:ok");
  }, 180_000);

  test.skipIf(!deno)("deno host spawns node renderd child for spiral IPC", () => {
    const helper = join(import.meta.dir, "helpers/renderd-deno-child.ts");
    const result = spawnSync(deno!, [...denoPerms, helper], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 180_000,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    const out = `${result.stderr}${result.stdout}`;
    if (result.status !== 0) {
      throw new Error(`deno renderd child failed (${result.status}): ${out}`);
    }
    expect(out).toContain("renderd-deno-child:ok");
  }, 180_000);
});
