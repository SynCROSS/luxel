import { createAppFetch } from "../server/handler.ts";
import { bundleClient } from "../build/client-bundle.ts";
import { compileApp, compileCounterApp } from "../route/compile-app.ts";
import { join } from "node:path";

export type TestServerOptions = {
  appDir?: string;
  internalRoutes?: boolean;
};

async function createAppTestServer(port: number, options: TestServerOptions) {
  const repoRoot = join(import.meta.dir, "../../../..");
  const appDir = options.appDir ?? "examples/counter";
  const app =
    appDir === "examples/counter"
      ? await compileCounterApp(repoRoot)
      : await compileApp(repoRoot, appDir);
  const genRoot = await app.writeCache();
  const { js } = await bundleClient(genRoot);
  const fetch = createAppFetch({
    app,
    clientBundle: js,
    internalRoutes: options.internalRoutes,
  });
  const server = Bun.serve({ port, fetch });
  return {
    url: `http://${server.hostname}:${server.port}`,
    close: () => server.stop(),
  };
}

export async function createTestServer(port = 0) {
  return createAppTestServer(port, { appDir: "examples/counter" });
}

export async function createNavDemoTestServer(port = 0) {
  return createAppTestServer(port, {
    appDir: "examples/nav-demo",
    internalRoutes: true,
  });
}
