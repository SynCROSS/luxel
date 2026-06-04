import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bundleClient } from "./client-bundle.ts";
import { bundleServerApp } from "./bundle-server-app.ts";
import { compileApp } from "../route/compile-app.ts";
import { loadLuxelConfig, resolveAppPaths } from "../config/load.ts";
import { resolveProductionCompressOptions } from "../config/compress.ts";
import { ASSET_CLIENT } from "../compiler/codegen-ssr.ts";

export async function buildApp(repoRoot: string, appDir: string): Promise<string> {
  const appRoot = join(repoRoot, appDir);
  const config = await loadLuxelConfig(appRoot);
  const paths = resolveAppPaths(repoRoot, appDir, config);
  const app = await compileApp(repoRoot, appDir);
  const genRoot = await app.writeCache();
  const { js } = await bundleClient(genRoot);
  const compress = resolveProductionCompressOptions(config.server?.compress);

  await mkdir(join(paths.outDir, "assets"), { recursive: true });
  await app.writeDist(paths.outDir);
  await bundleServerApp(
    genRoot,
    app.manifest,
    app.routes,
    join(paths.outDir, "server", "app.mjs"),
  );
  await writeFile(join(paths.outDir, "assets", ASSET_CLIENT), js);
  await writeFile(
    join(paths.outDir, "server", "entry.js"),
    [
      `import { createAppServerFetch } from "@luxel/luxel";`,
      ``,
      `export const productionCompress = ${JSON.stringify(compress)};`,
      ``,
      `export function createDeployedFetch(appOptions) {`,
      `  return createAppServerFetch({ ...appOptions, compress: productionCompress });`,
      `}`,
      ``,
      `export { createAppFetch, createAppServerFetch, wrapCompress } from "@luxel/luxel";`,
    ].join("\n"),
  );

  return paths.outDir;
}
