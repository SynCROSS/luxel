import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildApp } from "../build/build-app.ts";
import { evaluateBenchGate } from "../bench/gate.ts";
import { runBenchRegistry } from "../bench/registry.ts";
import { resolveAppDir } from "../config/resolve-app.ts";
import { devApp } from "../dev/serve.ts";
import { serveProd } from "../serve-prod.ts";
import { setLuxelPkgSrc } from "../paths.ts";
import type { BundleBackend } from "./backends/types.ts";

export type HostContext = {
  repoRoot: string;
  appDir: string;
  cwd: string;
  luxelPkgSrc?: string;
  bundleBackend?: BundleBackend;
};

export function findRepoRoot(start: string): string {
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

export function createHostContext(cwd: string, options?: { luxelPkgSrc?: string }): HostContext {
  const repoRoot = findRepoRoot(cwd);
  if (options?.luxelPkgSrc) {
    setLuxelPkgSrc(options.luxelPkgSrc);
  }
  const appDir = resolveAppDir(cwd, repoRoot);
  return {
    repoRoot,
    appDir,
    cwd,
    luxelPkgSrc: options?.luxelPkgSrc,
  };
}

export async function runBenchCommand(args: string[]): Promise<number> {
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

export type HostDispatchResult = "ok" | "exit" | "hang";

export async function dispatchHostCommand(
  cmd: string | undefined,
  argv: string[],
  ctx: HostContext,
): Promise<{ code: number; result: HostDispatchResult }> {
  if (!cmd) {
    console.error("usage: luxel <dev|build|bench [--gate]|serve>");
    return { code: 1, result: "exit" };
  }

  if (cmd === "build") {
    const out = await buildApp(ctx.repoRoot, ctx.appDir, {
      bundleBackend: ctx.bundleBackend,
    });
    const backendLabel = ctx.bundleBackend ? ` [${ctx.bundleBackend.id}]` : "";
    console.log(`built ${out} (${ctx.appDir})${backendLabel}`);
    return { code: 0, result: "ok" };
  }

  if (cmd === "dev") {
    const { url } = await devApp(ctx.repoRoot, ctx.appDir, {
      port: Number(process.env.PORT ?? "3000"),
      bundleBackend: ctx.bundleBackend,
    });
    console.log(`luxel dev ${url} (${ctx.appDir})`);
    return { code: 0, result: "hang" };
  }

  if (cmd === "bench") {
    const code = await runBenchCommand(argv);
    return { code, result: "exit" };
  }

  if (cmd === "serve") {
    const runtime = argv[0];
    if (runtime !== "node" && runtime !== "deno") {
      console.error("usage: luxel serve <node|deno>");
      return { code: 1, result: "exit" };
    }
    await serveProd(ctx.repoRoot, ctx.appDir, runtime);
    return { code: 0, result: "ok" };
  }

  console.error("usage: luxel <dev|build|bench [--gate]|serve>");
  return { code: 1, result: "exit" };
}
