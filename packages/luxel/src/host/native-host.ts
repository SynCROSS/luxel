/**
 * Native luxel host (v1.1) — Node/Deno without Bun subprocess.
 * v1.1-rc: esbuild backend (locked); WASM swap later (same API).
 */
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildApp } from "../build/build-app.ts";
import { evaluateBenchGate } from "../bench/gate.ts";
import { runBenchRegistry } from "../bench/registry.ts";
import { resolveAppDir } from "../config/resolve-app.ts";
import { devApp } from "../dev/serve.ts";
import { setLuxelPkgSrc } from "../paths.ts";
import { serveProd } from "../serve-prod.ts";
import { esbuildBackend } from "./backends/esbuild-backend.ts";
import type { BundleBackend } from "./backends/types.ts";

export type NativeHostRuntime = "node" | "deno";

export type NativeHostOptions = {
  /** Absolute path to `packages/luxel/src` (published + bundled host). */
  pkgSrc?: string;
};

/** Default v1.1-rc backend; swap to wasmBackend when ready. */
export const defaultBundleBackend: BundleBackend = esbuildBackend;

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "package.json")) && existsSync(join(dir, "CONTEXT-MAP.md"))) {
      return dir;
    }
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

function resolvePkgSrc(cwd: string, options?: NativeHostOptions): string {
  if (options?.pkgSrc) return options.pkgSrc;
  return join(findRepoRoot(cwd), "packages/luxel/src");
}

function prepareHost(cwd: string, options?: NativeHostOptions) {
  const repoRoot = findRepoRoot(cwd);
  setLuxelPkgSrc(resolvePkgSrc(cwd, options));
  const appDir = resolveAppDir(cwd, repoRoot);
  return { repoRoot, appDir };
}

async function runBenchCommand(args: string[]): Promise<number> {
  const gateMode = args.includes("--gate");
  const skipInp =
    process.env.LUXEL_BENCH_SKIP_INP === "1" || process.env.LUXEL_BENCH_SKIP_INP === "true";
  const benchLines: string[] = [];
  const parsed: Parameters<typeof evaluateBenchGate>[0] = [];
  for await (const line of runBenchRegistry({ skipInp })) {
    const json = JSON.stringify(line);
    console.log(json);
    benchLines.push(json);
    parsed.push(line);
  }
  const gate = evaluateBenchGate(parsed);
  const gateJson = JSON.stringify(gate);
  console.log(gateJson);
  benchLines.push(gateJson);
  const out = process.env.LUXEL_BENCH_OUT;
  if (out) {
    await writeFile(out, `${benchLines.join("\n")}\n`, "utf8");
  }
  if (gateMode && !gate.ok) {
    return 1;
  }
  return 0;
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

  if (cmd === "build") {
    const { repoRoot, appDir } = prepareHost(cwd, options);
    const out = await buildApp(repoRoot, appDir, { bundleBackend: defaultBundleBackend });
    console.log(`built ${out} (${appDir}) [${defaultBundleBackend.id}]`);
    return 0;
  }

  if (cmd === "bench") {
    prepareHost(cwd, options);
    return runBenchCommand(args);
  }

  if (cmd === "dev") {
    const { repoRoot, appDir } = prepareHost(cwd, options);
    const { url } = await devApp(repoRoot, appDir, {
      port: Number(process.env.PORT ?? "3000"),
      bundleBackend: defaultBundleBackend,
    });
    console.log(`luxel dev ${url} (${appDir})`);
    await new Promise(() => {});
    return 0;
  }

  if (cmd === "serve") {
    const runtimeArg = args[1];
    if (runtimeArg !== "node" && runtimeArg !== "deno") {
      console.error("usage: luxel serve <node|deno>");
      return 1;
    }
    const { repoRoot, appDir } = prepareHost(cwd, options);
    await serveProd(repoRoot, appDir, runtimeArg);
    return 0;
  }

  console.error(
    `luxel native ${runtime} host: ${cmd} not implemented yet (v1.1). ` +
      `Backend: ${defaultBundleBackend.id} (rc) → wasm. No Bun bridge.`,
  );
  return 1;
}
