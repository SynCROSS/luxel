import { existsSync } from "node:fs";
import { join } from "node:path";
import { getLuxelRepoRoot } from "../../src/paths.ts";

let buildPromise: Promise<void> | null = null;

export function ensureCoreNodeBuilt(): Promise<void> {
  if (!buildPromise) {
    buildPromise = buildCoreNodeOnce();
  }
  return buildPromise;
}

async function buildCoreNodeOnce(): Promise<void> {
  const repoRoot = getLuxelRepoRoot();
  const coreNodeDir = join(repoRoot, "packages/core-node");
  const nodeBinary = join(coreNodeDir, "index.win32-x64-msvc.node");
  if (existsSync(nodeBinary)) {
    return;
  }
  const proc = Bun.spawn(["bun", "run", "build"], {
    cwd: coreNodeDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`@luxel/core-node build failed:\n${err}`);
  }
}
