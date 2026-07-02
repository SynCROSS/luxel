import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { getLuxelPkgSrc } from "../../paths.ts";

type SolidComponent = () => unknown;

const cache = new Map<string, SolidComponent>();

export function precompiledSolidArtifactPath(cacheKey: string): string {
  return join(getLuxelPkgSrc(), ".bench", "competitors", "solid", `${cacheKey}.mjs`);
}

/** Parent-once esbuild — workers import-only (no parallel write races). */
export async function compileSolidTsForSsr(absolutePath: string, cacheKey: string): Promise<void> {
  const source = await readFile(absolutePath, "utf8");
  const compiled = await esbuild.transform(source, {
    loader: "ts",
    format: "esm",
    platform: "neutral",
    define: { "process.env.NODE_ENV": '"production"' },
  });

  const dir = join(getLuxelPkgSrc(), ".bench", "competitors", "solid");
  await mkdir(dir, { recursive: true });
  await writeFile(precompiledSolidArtifactPath(cacheKey), compiled.code, "utf8");
}

export async function importPrecompiledSolidTs(
  absolutePath: string,
  cacheKey: string,
): Promise<SolidComponent> {
  const out = precompiledSolidArtifactPath(cacheKey);
  const mod = (await import(pathToFileURL(out).href)) as Record<string, SolidComponent>;
  const component = mod.CounterApp ?? mod.SpiralApp ?? mod.default;
  if (!component) throw new Error(`missing Solid export: ${absolutePath}`);
  return component;
}

export async function loadSolidTsForSsr(absolutePath: string, cacheKey: string): Promise<SolidComponent> {
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  await compileSolidTsForSsr(absolutePath, cacheKey);
  const component = await importPrecompiledSolidTs(absolutePath, cacheKey);
  cache.set(cacheKey, component);
  return component;
}
