import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import type { LuxelServerConfig } from "./compress.ts";

export type LuxelConfig = {
  root: string;
  routesDir: string;
  outDir: string;
  server?: LuxelServerConfig;
};

async function importConfigModule(configPath: string): Promise<Record<string, unknown>> {
  try {
    return await import(pathToFileURL(configPath).href);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const needsEsbuild =
      configPath.endsWith(".ts") &&
      (message.includes("Unknown file extension") ||
        message.includes("Cannot find module") ||
        message.includes("ERR_UNKNOWN_FILE_EXTENSION") ||
        message.includes("ERR_UNSUPPORTED_NODE_MODULES_TYPE") ||
        message.includes("TypeScript") ||
        message.includes(".ts'"));
    if (!needsEsbuild) throw err;

    const dir = await mkdtemp(join(tmpdir(), "luxel-config-"));
    const outfile = join(dir, "luxel.config.mjs");
    const result = await esbuild.build({
      entryPoints: [configPath],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile,
      packages: "external",
      logLevel: "silent",
    });
    if (result.errors.length > 0) {
      throw new Error(result.errors.map((e) => e.text).join("\n"));
    }
    return import(pathToFileURL(outfile).href);
  }
}

export async function loadLuxelConfig(appRoot: string): Promise<LuxelConfig> {
  const configPath = join(appRoot, "luxel.config.ts");
  const mod = await importConfigModule(configPath);
  const cfg = (mod.default ?? mod) as Partial<LuxelConfig>;
  return {
    root: cfg.root ?? ".",
    routesDir: cfg.routesDir ?? "src/routes",
    outDir: cfg.outDir ?? "dist",
    server: cfg.server,
  };
}

export function resolveAppPaths(repoRoot: string, appDir: string, config: LuxelConfig) {
  const root = join(repoRoot, appDir, config.root);
  return {
    root,
    routesDir: join(root, config.routesDir),
    outDir: join(root, config.outDir),
    routeFile: join(root, config.routesDir, "index.luxel"),
  };
}
