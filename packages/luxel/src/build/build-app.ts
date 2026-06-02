import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bundleClient } from "./client-bundle.ts";
import { compileCounterApp } from "../route/compile-app.ts";
import { loadLuxelConfig, resolveAppPaths } from "../config/load.ts";
import { ASSET_CLIENT } from "../compiler/codegen-ssr.ts";

export async function buildApp(repoRoot: string, appDir: string): Promise<string> {
  const config = await loadLuxelConfig(join(repoRoot, appDir));
  const paths = resolveAppPaths(repoRoot, appDir, config);
  const app = await compileCounterApp(repoRoot);
  const genRoot = await app.writeCache();
  const { js } = await bundleClient(genRoot);

  await mkdir(join(paths.outDir, "assets"), { recursive: true });
  await app.writeDist(paths.outDir);
  await writeFile(join(paths.outDir, "assets", ASSET_CLIENT), js);
  await writeFile(
    join(paths.outDir, "server", "entry.js"),
    `export { createAppFetch } from "@luxel/luxel/server";\n`,
  );

  return paths.outDir;
}
