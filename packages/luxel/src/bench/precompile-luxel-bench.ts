import { compileApp, compileCounterApp, compileNavDemoApp, type CompiledApp } from "../route/compile-app.ts";
import type { CompileAppOptions } from "../route/compile-app.ts";
import { writeBenchPoolArtifact } from "./hydrate-compiled-app.ts";

export const LUXEL_BENCH_POOL_GEN_SUFFIX = "bench-pool-shared";
export const LUXEL_BENCH_POOL_FULL_SUFFIX = "bench-pool-full";

const locks = new Map<string, Promise<CompiledApp>>();

function lockKey(appDir: string, genRootSuffix: string): string {
  return `${appDir}:${genRootSuffix}`;
}

export function applyBenchFullRender(app: CompiledApp): void {
  for (const route of app.routes) {
    route.precomputedHtml = undefined;
    route.precomputedData = undefined;
  }
}

async function compileAndWrite(
  compile: () => Promise<CompiledApp>,
  benchFullRender: boolean,
): Promise<CompiledApp> {
  const app = await compile();
  if (benchFullRender) applyBenchFullRender(app);
  await writeBenchPoolArtifact(app);
  return app;
}

export async function precompileLuxelCounterForPool(
  repoRoot: string,
  options: { benchFullRender?: boolean } & CompileAppOptions = {},
): Promise<CompiledApp> {
  const benchFullRender = options.benchFullRender ?? false;
  const genRootSuffix = benchFullRender ? LUXEL_BENCH_POOL_FULL_SUFFIX : LUXEL_BENCH_POOL_GEN_SUFFIX;
  const key = lockKey("examples/counter", genRootSuffix);
  let pending = locks.get(key);
  if (!pending) {
    pending = compileAndWrite(
      () => compileCounterApp(repoRoot, { ...options, genRootSuffix }),
      benchFullRender,
    );
    locks.set(key, pending);
  }
  return pending;
}

export async function precompileLuxelNavDemoForPool(
  repoRoot: string,
  options: CompileAppOptions = {},
): Promise<CompiledApp> {
  const genRootSuffix = LUXEL_BENCH_POOL_GEN_SUFFIX;
  const key = lockKey("examples/nav-demo", genRootSuffix);
  let pending = locks.get(key);
  if (!pending) {
    pending = compileAndWrite(
      () => compileNavDemoApp(repoRoot, { ...options, genRootSuffix }),
      false,
    );
    locks.set(key, pending);
  }
  return pending;
}

export async function precompileLuxelAppForPool(
  repoRoot: string,
  appDir: string,
  options: CompileAppOptions = {},
): Promise<CompiledApp> {
  const genRootSuffix = options.genRootSuffix ?? `${LUXEL_BENCH_POOL_GEN_SUFFIX}-${appDir.replace(/\//g, "-")}`;
  const key = lockKey(appDir, genRootSuffix);
  let pending = locks.get(key);
  if (!pending) {
    pending = compileAndWrite(
      () => compileApp(repoRoot, appDir, { ...options, genRootSuffix }),
      false,
    );
    locks.set(key, pending);
  }
  return pending;
}
