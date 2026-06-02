import { watch } from "node:fs";
import { join } from "node:path";
import { createAppFetch } from "../server/handler.ts";
import { bundleClient } from "../build/client-bundle.ts";
import { compileCounterApp } from "../route/compile-app.ts";
import { DevGraph } from "./graph.ts";

export async function devApp(repoRoot: string, appDir: string, port = 3000) {
  const graph = new DevGraph();
  graph.add("route:index", ["sfc:index"]);
  graph.add("route:about", ["sfc:about"]);
  graph.add("sfc:index");
  graph.add("sfc:about");

  async function rebuild() {
    const app = await compileCounterApp(repoRoot);
    const genRoot = await app.writeCache();
    const { js } = await bundleClient(genRoot);
    return createAppFetch({ app, clientBundle: js });
  }

  let fetch = await rebuild();
  const server = Bun.serve({ port, fetch });

  const routesDir = join(repoRoot, appDir, "src/routes");
  watch(routesDir, async () => {
    graph.invalidate("sfc:index");
    graph.invalidate("sfc:about");
    fetch = await rebuild();
    server.reload({ fetch });
  });

  return { url: `http://localhost:${port}`, close: () => server.stop() };
}
