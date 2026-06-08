/**
 * Native luxel host (v1.1) — Node/Deno without Bun subprocess.
 * v1.1-rc: esbuild backend (locked); WASM swap later (same API).
 */
import { join } from "node:path";
import { createHostContext, dispatchHostCommand, findRepoRoot, runBenchCommand } from "./host-runtime.ts";
import { esbuildBackend } from "./backends/esbuild-backend.ts";
import type { BundleBackend } from "./backends/types.ts";

export type NativeHostRuntime = "node" | "deno";

export type NativeHostOptions = {
  /** Absolute path to `packages/luxel/src` (published + bundled host). */
  pkgSrc?: string;
};

/** Default v1.1-rc backend; swap to wasmBackend when ready. */
export const defaultBundleBackend: BundleBackend = esbuildBackend;

function resolvePkgSrc(cwd: string, options?: NativeHostOptions): string {
  if (options?.pkgSrc) return options.pkgSrc;
  return join(findRepoRoot(cwd), "packages/luxel/src");
}

export async function runNativeHost(
  runtime: NativeHostRuntime,
  args: string[],
  cwd = process.cwd(),
  options?: NativeHostOptions,
): Promise<number> {
  const cmd = args[0];
  if (!cmd) {
    console.error(`usage: luxel <dev|build|bench|serve> (${runtime} native host — v1.1)`);
    return 1;
  }

  const ctx = createHostContext(cwd, { luxelPkgSrc: resolvePkgSrc(cwd, options) });
  ctx.bundleBackend = defaultBundleBackend;

  if (cmd === "bench") {
    return runBenchCommand(args);
  }

  const { code, result } = await dispatchHostCommand(cmd, args.slice(1), ctx);
  if (result === "hang") {
    await new Promise(() => {});
    return 0;
  }
  return code;
}
