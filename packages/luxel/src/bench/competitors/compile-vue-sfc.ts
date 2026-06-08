import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parse, compileScript } from "vue/compiler-sfc";
import { getLuxelPkgSrc } from "../../paths.ts";

type VueComponent = import("vue").Component;

const cache = new Map<string, VueComponent>();

export async function loadVueSfcForSsr(
  absolutePath: string,
  cacheKey: string,
  vapor = false,
): Promise<VueComponent> {
  const key = `${cacheKey}:${vapor ? "vapor" : "vdom"}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const source = await readFile(absolutePath, "utf8");
  const { descriptor, errors } = parse(source, { filename: absolutePath });
  if (errors.length) throw errors[0];
  if (!descriptor.template) throw new Error(`missing template: ${absolutePath}`);

  const id = cacheKey.replace(/[^a-z0-9-_]/gi, "_");
  const script = compileScript(descriptor, {
    id,
    inlineTemplate: true,
    templateOptions: {
      ssr: true,
      compilerOptions: vapor ? { vapor: true } : {},
    },
  });

  const vuePkg = vapor ? "vue-vapor" : "vue";
  const code = script.content
    .replace(/from ['"]vue['"]/g, `from '${vuePkg}'`)
    .replace(/from ['"]vue\/server-renderer['"]/g, `from '${vuePkg}/server-renderer'`);

  const dir = join(getLuxelPkgSrc(), ".bench", "competitors", vuePkg);
  await mkdir(dir, { recursive: true });
  const out = join(dir, `${id}.mjs`);
  await writeFile(out, code, "utf8");
  const mod = (await import(pathToFileURL(out).href)) as { default: VueComponent };
  cache.set(key, mod.default);
  return mod.default;
}
