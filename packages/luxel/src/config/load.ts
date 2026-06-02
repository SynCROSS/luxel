import { join } from "node:path";

export type LuxelConfig = {
  root: string;
  routesDir: string;
  outDir: string;
};

export async function loadLuxelConfig(appRoot: string): Promise<LuxelConfig> {
  const configPath = join(appRoot, "luxel.config.ts");
  const mod = await import(configPath);
  const cfg = mod.default ?? mod;
  return {
    root: cfg.root ?? ".",
    routesDir: cfg.routesDir ?? "src/routes",
    outDir: cfg.outDir ?? "dist",
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
