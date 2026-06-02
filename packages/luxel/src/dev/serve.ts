import { watch } from "node:fs";
import { join } from "node:path";
import { createAppFetch } from "../server/handler.ts";
import { bundleClient } from "../build/client-bundle.ts";
import { buildApp } from "../build/build-app.ts";
import { DevGraph } from "./graph.ts";

export async function devApp(repoRoot: string, appDir: string, port = 3000) {
  const graph = new DevGraph();
  graph.add("route:index", ["sfc:index"]);
  graph.add("sfc:index");

  let assets = await bundleClient();
  let fetch = createAppFetch({ clientBundle: assets.js, css: assets.css });

  const server = Bun.serve({ port, fetch });

  const routeFile = join(repoRoot, appDir, "src/routes/index.luxel");
  watch(routeFile, async () => {
    graph.invalidate("sfc:index");
    await buildApp(repoRoot, appDir);
    assets = await bundleClient();
    fetch = createAppFetch({ clientBundle: assets.js, css: assets.css });
    server.reload({ fetch });
  });

  return { url: `http://localhost:${port}`, close: () => server.stop() };
}
