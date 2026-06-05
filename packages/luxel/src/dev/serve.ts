import { watch } from "node:fs";
import { join } from "node:path";
import type { BundleBackend } from "../host/backends/types.ts";
import { createListenFetchServer } from "../http/listen-fetch.ts";
import { createAppFetch } from "../server/handler.ts";
import { bundleClient } from "../build/client-bundle.ts";
import { compileApp } from "../route/compile-app.ts";
import { discoverRouteFiles } from "../routing/discover-routes.ts";
import { DevGraph } from "./graph.ts";

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
  const routesDir = join(repoRoot, appDir, "src/routes");
  let slugs = (await discoverRouteFiles(routesDir)).map((r) => r.slug);

  const graph = new DevGraph();
  function registerGraph(routeSlugs: string[]) {
    for (const slug of routeSlugs) {
      graph.add(`route:${slug}`, [`sfc:${slug}`]);
      graph.add(`sfc:${slug}`);
    }
  }
  registerGraph(slugs);

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
    slugs = (await discoverRouteFiles(routesDir)).map((r) => r.slug);
    for (const slug of slugs) {
      graph.invalidate(`sfc:${slug}`);
    }
    fetch = await rebuild();
  });

  return { url: server.url, appDir, close: () => server.close() };
}
