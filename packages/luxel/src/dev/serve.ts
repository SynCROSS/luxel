import { watch } from "node:fs";
import { join } from "node:path";
import { createAppFetch } from "../server/handler.ts";
import { bundleClient } from "../build/client-bundle.ts";
import { compileApp } from "../route/compile-app.ts";
import { discoverRouteFiles } from "../routing/discover-routes.ts";
import { DevGraph } from "./graph.ts";

export async function devApp(repoRoot: string, appDir: string, port = 3000) {
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
    const app = await compileApp(repoRoot, appDir);
    const genRoot = await app.writeCache();
    const { js } = await bundleClient(genRoot);
    return createAppFetch({ app, clientBundle: js });
  }

  let fetch = await rebuild();
  const server = Bun.serve({ port, fetch });
  const url =
    port === 0 ? `http://${server.hostname}:${server.port}` : `http://localhost:${port}`;

  watch(routesDir, async () => {
    slugs = (await discoverRouteFiles(routesDir)).map((r) => r.slug);
    for (const slug of slugs) {
      graph.invalidate(`sfc:${slug}`);
    }
    fetch = await rebuild();
    server.reload({ fetch });
  });

  return { url, appDir, close: () => server.stop() };
}
