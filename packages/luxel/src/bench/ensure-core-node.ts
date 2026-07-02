import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { arch, platform } from "node:process";
import { join } from "node:path";
import { getLuxelRepoRoot } from "../paths.ts";

function coreNodeDir(): string {
  return join(getLuxelRepoRoot(), "packages/core-node");
}

function coreNodeArtifactPath(): string | null {
  const dir = coreNodeDir();
  if (platform === "win32") {
    if (arch === "x64") return join(dir, "index.win32-x64-msvc.node");
    if (arch === "arm64") return join(dir, "index.win32-arm64-msvc.node");
    if (arch === "ia32") return join(dir, "index.win32-ia32-msvc.node");
  }
  if (platform === "darwin") {
    if (arch === "arm64") return join(dir, "index.darwin-arm64.node");
    if (arch === "x64") return join(dir, "index.darwin-x64.node");
    const universal = join(dir, "index.darwin-universal.node");
    if (existsSync(universal)) return universal;
  }
  if (platform === "linux" && arch === "x64") {
    const gnu = join(dir, "index.linux-x64-gnu.node");
    const musl = join(dir, "index.linux-x64-musl.node");
    if (existsSync(gnu)) return gnu;
    if (existsSync(musl)) return musl;
  }
  if (platform === "linux" && arch === "arm64") {
    const gnu = join(dir, "index.linux-arm64-gnu.node");
    const musl = join(dir, "index.linux-arm64-musl.node");
    if (existsSync(gnu)) return gnu;
    if (existsSync(musl)) return musl;
  }
  return null;
}

function hasCoreNodeArtifact(): boolean {
  const path = coreNodeArtifactPath();
  return path !== null && existsSync(path);
}

const requireFromLuxel = createRequire(join(getLuxelRepoRoot(), "packages/luxel/package.json"));

export function getLuxelCoreNodeModule(): Record<string, unknown> | null {
  return loadCoreNodeModule();
}

function loadCoreNodeModule(): Record<string, unknown> | null {
  const artifact = coreNodeArtifactPath();
  if (artifact && existsSync(artifact)) {
    try {
      const req = createRequire(join(coreNodeDir(), "package.json"));
      return req(artifact) as Record<string, unknown>;
    } catch {
      // fall through
    }
  }
  try {
    return requireFromLuxel("@luxel/core-node") as Record<string, unknown>;
  } catch {
    try {
      return createRequire(join(coreNodeDir(), "package.json"))(".") as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

let buildPromise: Promise<void> | null = null;

export function isLuxelCoreNodeArtifactPresent(): boolean {
  return hasCoreNodeArtifact();
}

export function isLuxelCoreNodeLoadable(): boolean {
  if (process.env.LUXEL_NATIVE_FORCE_UNAVAILABLE === "1") {
    return false;
  }
  const mod = loadCoreNodeModule();
  if (!mod) return false;
  return typeof mod.renderBodyFromIr === "function";
}

async function waitForLoadable(retriesMs: number[]): Promise<boolean> {
  for (const ms of retriesMs) {
    if (ms > 0) await Bun.sleep(ms);
    if (isLuxelCoreNodeLoadable()) return true;
  }
  return false;
}

export function ensureCoreNodeBuilt(): Promise<void> {
  if (isLuxelCoreNodeLoadable()) {
    return Promise.resolve();
  }
  if (hasCoreNodeArtifact()) {
    return waitForLoadable([0, 100, 250, 500, 1000]).then((ok) => {
      if (ok) return;
      throw new Error(
        "@luxel/core-node artifact is on disk but not loadable — close bench processes locking luxel-core and re-run bench:ensure-core-node",
      );
    });
  }
  if (!buildPromise) {
    buildPromise = buildCoreNodeOnce().finally(() => {
      buildPromise = null;
    });
  }
  return buildPromise;
}

async function buildCoreNodeOnce(): Promise<void> {
  const proc = Bun.spawn(["bun", "run", "build"], {
    cwd: coreNodeDir(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const code = await proc.exited;
  if (code !== 0) {
    if (await waitForLoadable([0, 250, 500])) {
      return;
    }
    const err = await new Response(proc.stderr).text();
    throw new Error(`@luxel/core-node build failed:\n${err}`);
  }
  if (!(await waitForLoadable([0, 250, 500]))) {
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
    throw new Error("luxel-ssr-native requires loadable @luxel/core-node counter renderer");
  }
}
