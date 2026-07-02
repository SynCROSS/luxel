import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getLuxelPkgSrc } from "../../paths.ts";

type VueComponent = import("vue").Component;

const cache = new Map<string, VueComponent>();

function vuePkgDir(vapor: boolean): string {
  return vapor ? "vue-vapor" : "vue";
}

function artifactId(cacheKey: string): string {
  return cacheKey.replace(/[^a-z0-9-_]/gi, "_");
}

export function precompiledVueArtifactPath(cacheKey: string, vapor = false): string {
  return join(getLuxelPkgSrc(), ".bench", "competitors", vuePkgDir(vapor), `${artifactId(cacheKey)}.mjs`);
}

async function loadVueCompiler(vapor: boolean) {
  return vapor ? import("vue-vapor/compiler-sfc") : import("vue/compiler-sfc");
}

/** Parent-once compile — workers import via importPrecompiledVueSfc only. */
export async function compileVueSfcForSsr(
  absolutePath: string,
  cacheKey: string,
  vapor = false,
): Promise<void> {
  const source = await readFile(absolutePath, "utf8");
  const { parse, compileScript } = await loadVueCompiler(vapor);
  const { descriptor, errors } = parse(source, { filename: absolutePath });
  if (errors.length) throw errors[0];
  if (!descriptor.template) throw new Error(`missing template: ${absolutePath}`);

  const id = artifactId(cacheKey);
  const script = compileScript(descriptor, {
    id,
    inlineTemplate: true,
    templateOptions: {
      ssr: true,
      compilerOptions: vapor ? { vapor: true } : {},
    },
  });

  const vuePkg = vuePkgDir(vapor);
  const code = script.content
    .replace(/from ['"]vue['"]/g, `from '${vuePkg}'`)
    .replace(/from ['"]vue\/server-renderer['"]/g, `from '${vuePkg}/server-renderer'`);

  const dir = join(getLuxelPkgSrc(), ".bench", "competitors", vuePkg);
  await mkdir(dir, { recursive: true });
  await writeFile(precompiledVueArtifactPath(cacheKey, vapor), code, "utf8");
}

/** Import parent-precompiled artifact in worker — workers must not recompile (parallel write races). */
export async function importPrecompiledVueSfc(
  absolutePath: string,
  cacheKey: string,
  vapor = false,
): Promise<VueComponent> {
  const out = precompiledVueArtifactPath(cacheKey, vapor);
  const mod = (await import(pathToFileURL(out).href)) as { default: VueComponent };
  if (!mod.default) throw new Error(`missing Vue export: ${absolutePath}`);
  return mod.default;
}

export async function loadVueSfcForSsr(
  absolutePath: string,
  cacheKey: string,
  vapor = false,
): Promise<VueComponent> {
  const key = `${cacheKey}:${vapor ? "vapor" : "vdom"}`;
  const hit = cache.get(key);
  if (hit) return hit;

  await compileVueSfcForSsr(absolutePath, cacheKey, vapor);
  const component = await importPrecompiledVueSfc(absolutePath, cacheKey, vapor);
  cache.set(key, component);
  return component;
}
