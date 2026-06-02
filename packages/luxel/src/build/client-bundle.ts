import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export async function bundleClient(genRoot: string): Promise<{ js: string }> {
  await mkdir(genRoot, { recursive: true });
  const entry = join(genRoot, "client-entry.ts");

  const result = await Bun.build({
    entrypoints: [entry],
    format: "esm",
    minify: false,
    target: "browser",
    root: genRoot,
  });

  if (!result.success) {
    throw new Error(result.logs.map((l) => l.message).join("\n"));
  }

  const js = await result.outputs[0]!.text();
  return { js };
}
