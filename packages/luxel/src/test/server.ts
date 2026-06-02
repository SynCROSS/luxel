import { createAppFetch } from "../server/handler.ts";
import { bundleClient } from "../build/client-bundle.ts";
import { compileCounterApp } from "../route/compile-app.ts";
import { join } from "node:path";

export async function createTestServer(port = 0) {
  const repoRoot = join(import.meta.dir, "../../../..");
  const app = await compileCounterApp(repoRoot);
  const genRoot = await app.writeCache();
  const { js } = await bundleClient(genRoot);
  const fetch = createAppFetch({ app, clientBundle: js });
  const server = Bun.serve({ port, fetch });
  return {
    url: `http://${server.hostname}:${server.port}`,
    close: () => server.stop(),
  };
}
