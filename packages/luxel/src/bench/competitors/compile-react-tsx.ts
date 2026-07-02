import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { getLuxelPkgSrc } from "../../paths.ts";
import { ensureBenchProductionEnv } from "./bench-env.ts";

const cache = new Map<string, ComponentType>();
type ComponentType = import("react").ComponentType;

export function precompiledReactArtifactPath(cacheKey: string): string {
  return join(getLuxelPkgSrc(), ".bench", "competitors", "react", `${cacheKey}.mjs`);
}

/** Parent-once esbuild — external react so renderToString shares one runtime (node host bench). */
export async function compileReactTsxForSsr(
  absolutePath: string,
  cacheKey: string,
): Promise<void> {
  const dir = join(getLuxelPkgSrc(), ".bench", "competitors", "react");
  await mkdir(dir, { recursive: true });
  const built = await esbuild.build({
    entryPoints: [absolutePath],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: precompiledReactArtifactPath(cacheKey),
    jsx: "automatic",
    jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/server"],
    logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  if (built.errors.length > 0) {
    throw new Error(built.errors.map((error) => error.text).join("\n"));
  }
}

/** Import parent-precompiled artifact in worker — workers must not re-esbuild (parallel write races). */
export async function importPrecompiledReactTsx(
  absolutePath: string,
  cacheKey: string,
): Promise<ComponentType> {
  const out = precompiledReactArtifactPath(cacheKey);
  const mod = (await import(pathToFileURL(out).href)) as Record<string, ComponentType>;
  const component = mod.CounterApp ?? mod.SpiralApp ?? mod.default;
  if (!component) throw new Error(`missing React export: ${absolutePath}`);
  return component;
}

async function importCompiledReactTsxInParent(cacheKey: string): Promise<ComponentType> {
  ensureBenchProductionEnv();
  const out = precompiledReactArtifactPath(cacheKey);
  const mod = (await import(pathToFileURL(out).href)) as Record<string, ComponentType>;
  const component = mod.CounterApp ?? mod.SpiralApp ?? mod.default;
  if (!component) throw new Error(`missing React export in ${out}`);
  return component;
}

export async function loadReactTsxForSsr(
  absolutePath: string,
  cacheKey: string,
): Promise<ComponentType> {
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  await compileReactTsxForSsr(absolutePath, cacheKey);
  const component = await importCompiledReactTsxInParent(cacheKey);
  cache.set(cacheKey, component);
  return component;
}
