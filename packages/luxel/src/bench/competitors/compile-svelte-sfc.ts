import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { compile } from "svelte/compiler";
import { getLuxelPkgSrc } from "../../paths.ts";

type SvelteComponent = Parameters<typeof import("svelte/server").render>[0];
type SvelteRenderFn = () => { body: string };

const cache = new Map<string, SvelteRenderFn>();
let svelteServerRender: typeof import("svelte/server").render | null = null;

async function getSvelteServerRender(): Promise<typeof import("svelte/server").render> {
  svelteServerRender ??= (await import("svelte/server")).render;
  return svelteServerRender;
}

export function precompiledSvelteArtifactPath(cacheKey: string): string {
  return join(getLuxelPkgSrc(), ".bench", "competitors", "svelte", `${cacheKey}.mjs`);
}

/** Parent-once compile — workers import via importPrecompiledSvelteSfc only. */
export async function compileSvelteSfcForSsr(
  absolutePath: string,
  cacheKey: string,
): Promise<void> {
  const source = await readFile(absolutePath, "utf8");
  const compiled = compile(source, {
    filename: absolutePath,
    generate: "server",
    modernAst: true,
    dev: false,
  });
  const dir = join(getLuxelPkgSrc(), ".bench", "competitors", "svelte");
  await mkdir(dir, { recursive: true });
  await writeFile(precompiledSvelteArtifactPath(cacheKey), compiled.js.code, "utf8");
}

/** Import parent-precompiled artifact in worker — workers must not recompile (parallel write races). */
export async function importPrecompiledSvelteSfc(
  absolutePath: string,
  cacheKey: string,
): Promise<SvelteRenderFn> {
  const render = await getSvelteServerRender();
  const out = precompiledSvelteArtifactPath(cacheKey);
  const mod = (await import(pathToFileURL(out).href)) as { default: SvelteComponent };
  const component = mod.default;
  return () => render(component);
}

export async function loadSvelteSfcForSsr(
  absolutePath: string,
  cacheKey: string,
): Promise<() => { body: string }> {
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  await compileSvelteSfcForSsr(absolutePath, cacheKey);
  const renderFn = await importPrecompiledSvelteSfc(absolutePath, cacheKey);
  cache.set(cacheKey, renderFn);
  return renderFn;
}
