import { watch } from "node:fs";
import { join } from "node:path";
import type { BundleBackend } from "../host/backends/types.ts";
import { createListenFetchServer } from "../http/listen-fetch.ts";
import { createAppFetch } from "../server/handler.ts";
import { bundleClient } from "../build/client-bundle.ts";
import { compileApp } from "../route/compile-app.ts";
import { assertNativeModeForAppRoot } from "../config/native-mode.ts";

export type DevAppOptions = {
  port?: number;
  bundleBackend?: BundleBackend;
};

export async function devApp(
  repoRoot: string,
  appDir: string,
  options: DevAppOptions = {},
) {
  const port = options.port ?? Number(process.env.PORT ?? "3000");
  const appRoot = join(repoRoot, appDir);
  await assertNativeModeForAppRoot(appRoot);
  const routesDir = join(appRoot, "src/routes");

  async function rebuild() {
    const app = await compileApp(repoRoot, appDir, {
      bundleBackend: options.bundleBackend,
    });
    const genRoot = await app.writeCache();
    const { js } = await bundleClient(genRoot, options.bundleBackend);
    return createAppFetch({ app, clientBundle: js });
  }

  let fetch = await rebuild();
  const server = await createListenFetchServer((req) => fetch(req), {
    port,
    hostname: "127.0.0.1",
  });

  watch(routesDir, async () => {
    fetch = await rebuild();
  });

  return { url: server.url, appDir, close: () => server.close() };
}
