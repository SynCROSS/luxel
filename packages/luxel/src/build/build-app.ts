import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bundleClient } from "./client-bundle.ts";
import { bundleServerApp } from "./bundle-server-app.ts";
import { bundleServeScripts } from "./bundle-serve-scripts.ts";
import { compileApp } from "../route/compile-app.ts";
import { loadLuxelConfig, resolveAppPaths } from "../config/load.ts";
import { resolveProductionCompressOptions } from "../config/compress.ts";
import { ASSET_CLIENT } from "../compiler/codegen-ssr.ts";
import { createRenderWorker } from "../server/render-worker.ts";
import { writeStaticHtml } from "../server/static-html.ts";
import type { BundleBackend } from "../host/backends/types.ts";
import { pickBundleBackend } from "./pick-bundle-backend.ts";
import { assertNativeModeForAppRoot } from "../config/native-mode.ts";

export type BuildAppOptions = {
  bundleBackend?: BundleBackend;
};

export async function buildApp(
  repoRoot: string,
  appDir: string,
  options?: BuildAppOptions,
): Promise<string> {
  const bundleBackend = options?.bundleBackend ?? pickBundleBackend();
  const appRoot = join(repoRoot, appDir);
  await assertNativeModeForAppRoot(appRoot);
  const config = await loadLuxelConfig(appRoot);
  const paths = resolveAppPaths(repoRoot, appDir, config);
  const app = await compileApp(repoRoot, appDir, { bundleBackend });
  const genRoot = await app.writeCache();
  const { js } = await bundleClient(genRoot, bundleBackend);
  const compress = resolveProductionCompressOptions(config.server?.compress);

  await mkdir(join(paths.outDir, "assets"), { recursive: true });
  await app.writeDist(paths.outDir);
  await bundleServerApp(
    genRoot,
    app.manifest,
    app.routes,
    join(paths.outDir, "server", "app.mjs"),
    bundleBackend,
  );
  await bundleServeScripts(paths.outDir, bundleBackend);
  await writeFile(join(paths.outDir, "assets", ASSET_CLIENT), js);

  const staticRoot = join(paths.outDir, "static");
  const prerendered = app.routes.filter((r) => r.mode === "ssg");
  if (prerendered.length > 0) {
    const worker = createRenderWorker(app);
    for (const route of prerendered) {
      const { html } = await worker.render(route.path);
      await writeStaticHtml(staticRoot, route.path, html);
    }
  }

  await writeFile(
    join(paths.outDir, "server", "entry.js"),
    [
      `import { createAppServerFetch } from "@luxel/luxel";`,
      ``,
      `export const productionCompress = ${JSON.stringify(compress)};`,
      ``,
      `import { existsSync } from "node:fs";`,
      `import { join, dirname } from "node:path";`,
      `import { fileURLToPath } from "node:url";`,
      `const deployDistDir = join(dirname(fileURLToPath(import.meta.url)), "..");`,
      `const deployStaticRoot = join(deployDistDir, "static");`,
      ``,
      `export function createDeployedFetch(appOptions) {`,
      `  return createAppServerFetch({`,
      `    ...appOptions,`,
      `    compress: productionCompress,`,
      `    staticRoot: existsSync(deployStaticRoot) ? deployStaticRoot : undefined,`,
      `  });`,
      `}`,
      ``,
      `export { createAppFetch, createAppServerFetch, wrapCompress } from "@luxel/luxel";`,
    ].join("\n"),
  );

  return paths.outDir;
}
