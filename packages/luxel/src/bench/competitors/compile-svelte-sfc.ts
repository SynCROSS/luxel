import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { compile } from "svelte/compiler";
import { getLuxelPkgSrc } from "../../paths.ts";

type SvelteComponent = Parameters<typeof import("svelte/server").render>[0];

const cache = new Map<string, () => { body: string }>();

export async function loadSvelteSfcForSsr(
  absolutePath: string,
  cacheKey: string,
): Promise<() => { body: string }> {
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const dir = join(getLuxelPkgSrc(), ".bench", "competitors", "svelte");
  await mkdir(dir, { recursive: true });
  const out = join(dir, `${cacheKey}.mjs`);
  const source = await readFile(absolutePath, "utf8");
  const compiled = compile(source, {
    filename: absolutePath,
    generate: "server",
    modernAst: true,
  });
  await writeFile(out, compiled.js.code, "utf8");
  const mod = (await import(pathToFileURL(out).href)) as { default: SvelteComponent };
  const { render } = await import("svelte/server");
  const renderFn = () => render(mod.default);
  cache.set(cacheKey, renderFn);
  return renderFn;
}
