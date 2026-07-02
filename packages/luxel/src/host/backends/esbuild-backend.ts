import * as esbuild from "esbuild";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import type { BundleBackend, BundleOptions, BundleOutput } from "./types.ts";

function resolvePlatform(platform: BundleOptions["platform"]): "browser" | "node" {
  return platform === "browser" ? "browser" : "node";
}

function resolveTarget(platform: "browser" | "node"): string {
  return platform === "browser" ? "es2020" : "node20";
}

function resolveWrite(options: BundleOptions): boolean {
  if (options.write !== undefined) return options.write;
  return !!(options.outfile || options.outdir);
}

/** v1.1-rc default backend (see CONTEXT.md **v1.1 compile backend**). */
export const esbuildBackend: BundleBackend = {
  id: "esbuild",
  async bundle(entrypoints, options) {
    const platform = resolvePlatform(options.platform);
    const write = resolveWrite(options);

    if (options.outfile) {
      await mkdir(dirname(options.outfile), { recursive: true });
    }
    if (options.outdir) {
      await mkdir(options.outdir, { recursive: true });
    }

    const root = resolve(options.root);
    const entryPoints = entrypoints.map((entry) =>
      relative(root, resolve(entry)).replace(/\\/g, "/"),
    );

    const result = await esbuild.build({
      entryPoints,
      bundle: true,
      format: "esm",
      platform,
      target: resolveTarget(platform),
      absWorkingDir: root,
      outfile: options.outfile,
      outdir: options.outfile ? undefined : options.outdir,
      minify: options.minify ?? false,
      write,
      logLevel: "silent",
      sourcemap: false,
      packages: options.packages ?? "bundle",
      resolveExtensions: [".ts", ".tsx", ".js", ".mjs", ".json"],
    });

    if (result.errors.length > 0) {
      throw new Error(result.errors.map((e) => e.text).join("\n"));
    }

    const outputs: BundleOutput[] = [];
    if (result.outputFiles?.length) {
      for (const file of result.outputFiles) {
        outputs.push({ path: file.path, text: file.text });
      }
      return { outputs };
    }

    if (options.outfile) {
      outputs.push({
        path: options.outfile,
        text: await readFile(options.outfile, "utf8"),
      });
      return { outputs };
    }

    throw new Error("esbuild bundle produced no outputs");
  },
};
