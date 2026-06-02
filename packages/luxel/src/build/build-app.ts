import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bundleClient } from "./client-bundle.ts";
import { discoverManifest } from "../routing/discover.ts";
import { loadLuxelConfig, resolveAppPaths } from "../config/load.ts";

export async function buildApp(repoRoot: string, appDir: string): Promise<string> {
  const config = await loadLuxelConfig(join(repoRoot, appDir));
  const paths = resolveAppPaths(repoRoot, appDir, config);
  const manifest = await discoverManifest(paths.routesDir);
  const { js, css } = await bundleClient();

  await mkdir(join(paths.outDir, "assets"), { recursive: true });
  await mkdir(join(paths.outDir, "server"), { recursive: true });
  await mkdir(join(paths.outDir, "client"), { recursive: true });

  await writeFile(join(paths.outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  await writeFile(join(paths.outDir, "assets", "client.dev0.js"), js);
  await writeFile(join(paths.outDir, "assets", "index.dev0.css"), css);
  await writeFile(
    join(paths.outDir, "server", "entry.js"),
    `export { createAppFetch } from "@luxel/luxel/server";\n`,
  );

  return paths.outDir;
}
