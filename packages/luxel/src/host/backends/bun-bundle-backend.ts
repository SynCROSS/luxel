import type { BundleBackend, BundleOptions, BundleOutput } from "./types.ts";

function resolveBunTarget(platform: BundleOptions["platform"]): "browser" | "node" | "bun" {
  if (platform === "browser") return "browser";
  if (platform === "bun") return "bun";
  return "node";
}

/** v1.0 default when Bun available. */
export const bunBundleBackend: BundleBackend = {
  id: "bun",
  async bundle(entrypoints, options) {
    const result = await Bun.build({
      entrypoints,
      format: "esm",
      root: options.root,
      target: resolveBunTarget(options.platform),
      minify: options.minify ?? false,
    });

    if (!result.success) {
      throw new Error(result.logs.map((l) => l.message).join("\n"));
    }

    const outputs: BundleOutput[] = [];
    for (const [index, artifact] of result.outputs.entries()) {
      outputs.push({
        path: options.outfile ?? entrypoints[index] ?? `output-${index}.js`,
        text: await artifact.text(),
      });
    }

    if (options.outfile && outputs[0]) {
      const { writeFile, mkdir } = await import("node:fs/promises");
      const { dirname } = await import("node:path");
      await mkdir(dirname(options.outfile), { recursive: true });
      await writeFile(options.outfile, outputs[0].text, "utf8");
      outputs[0] = { path: options.outfile, text: outputs[0].text };
    }

    return { outputs };
  },
};
