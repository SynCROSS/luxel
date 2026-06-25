import { getLuxelRepoRoot } from "../paths.ts";

let buildPromise: Promise<void> | null = null;

export function isLuxelCoreNodeLoadable(): boolean {
  try {
    const mod = require("@luxel/core-node") as {
      renderBodyFromIr?: unknown;
    };
    return typeof mod.renderBodyFromIr === "function";
  } catch {
    return false;
  }
}

export function ensureCoreNodeBuilt(): Promise<void> {
  if (isLuxelCoreNodeLoadable()) {
    return Promise.resolve();
  }
  if (!buildPromise) {
    buildPromise = buildCoreNodeOnce();
  }
  return buildPromise;
}

async function buildCoreNodeOnce(): Promise<void> {
  const repoRoot = getLuxelRepoRoot();
  const coreNodeDir = `${repoRoot}/packages/core-node`;
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
  if (!isLuxelCoreNodeLoadable()) {
    throw new Error("@luxel/core-node build finished but native addon is not loadable");
  }
}

/** WinRK luxel-spiral-ssr* rows: build addon + fail on TS fallback. */
export async function prepareLuxelSpiralNativeBench(): Promise<void> {
  process.env.LUXEL_BENCH_STRICT_NATIVE ??= "1";
  await ensureCoreNodeBuilt();
  if (!isLuxelCoreNodeLoadable()) {
    throw new Error("luxel-spiral-ssr-native requires loadable @luxel/core-node");
  }
}

/** WinRK luxel-ssr-native row: build addon + fail on TS fallback. */
export async function prepareLuxelCounterNativeBench(): Promise<void> {
  process.env.LUXEL_BENCH_STRICT_NATIVE ??= "1";
  await ensureCoreNodeBuilt();
  if (!isLuxelCoreNodeLoadable()) {
    throw new Error("luxel-ssr-native requires loadable @luxel/core-node renderBodyFromIr");
  }
}
