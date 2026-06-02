import { join } from "node:path";

const pkgRoot = join(import.meta.dir, "..");

export async function bundleClient(): Promise<{ js: string; css: string }> {
  const result = await Bun.build({
    entrypoints: [join(pkgRoot, "client/entry.ts")],
    format: "esm",
    minify: false,
    target: "browser",
  });

  if (!result.success) {
    throw new Error(result.logs.map((l) => l.message).join("\n"));
  }

  const output = await result.outputs[0].text();
  const css = `button { font: inherit; min-width: 44px; min-height: 44px; }`;
  return { js: output, css };
}
