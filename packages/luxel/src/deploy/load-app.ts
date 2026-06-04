import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ASSET_CLIENT } from "../compiler/codegen-ssr.ts";
import type { AppRuntime } from "../server/app-runtime.ts";

export type LoadedDeployApp = {
  app: AppRuntime;
  clientBundle: Uint8Array;
};

export async function loadAppFromDist(distDir: string): Promise<LoadedDeployApp> {
  const appPath = join(distDir, "server", "app.mjs");
  const assetPath = join(distDir, "assets", ASSET_CLIENT);

  let mod: { createDeployApp?: () => AppRuntime };
  try {
    mod = (await import(pathToFileURL(appPath).href)) as {
      createDeployApp?: () => AppRuntime;
    };
  } catch (cause) {
    throw new Error(`failed to import deploy bundle at ${appPath}: ${cause}`);
  }

  if (typeof mod.createDeployApp !== "function") {
    throw new Error(`deploy bundle missing createDeployApp export: ${appPath}`);
  }

  let clientBundle: Uint8Array;
  try {
    clientBundle = await readFile(assetPath);
  } catch (cause) {
    throw new Error(`failed to read client asset at ${assetPath}: ${cause}`);
  }

  return { app: mod.createDeployApp(), clientBundle };
}
