import { mkdir, readFile, writeFile } from "node:fs/promises";
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

/** Parent-once esbuild — no react import in parent (keeps worker-pool parent env clean). */
export async function compileReactTsxForSsr(
  absolutePath: string,
  cacheKey: string,
): Promise<void> {
  const source = await readFile(absolutePath, "utf8");
  const compiled = await esbuild.transform(`import { createElement, Fragment } from "react";\n${source}`, {
    loader: "tsx",
    format: "esm",
    platform: "neutral",
    jsx: "transform",
    jsxDev: false,
    jsxFactory: "createElement",
    jsxFragment: "Fragment",
    define: { "process.env.NODE_ENV": '"production"' },
  });

  const dir = join(getLuxelPkgSrc(), ".bench", "competitors", "react");
  await mkdir(dir, { recursive: true });
  await writeFile(precompiledReactArtifactPath(cacheKey), compiled.code, "utf8");
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
