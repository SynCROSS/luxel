import { createAppFetch } from "../server/handler.ts";
import { bundleClient } from "../build/client-bundle.ts";
import { compileApp, compileCounterApp } from "../route/compile-app.ts";
import { FsHtmlCacheAdapter } from "../server/html-cache-fs.ts";
import { createListenFetchServer } from "./http-server.ts";
import { getLuxelRepoRoot } from "../paths.ts";

export type TestServerOptions = {
  appDir?: string;
  internalRoutes?: boolean;
  htmlCacheDir?: string;
  routeRevalidateSeconds?: Record<string, number>;
};

async function createAppTestServer(port: number, options: TestServerOptions) {
  const repoRoot = getLuxelRepoRoot();
  const appDir = options.appDir ?? "examples/counter";
  const app =
    appDir === "examples/counter"
      ? await compileCounterApp(repoRoot)
      : await compileApp(repoRoot, appDir);
  const genRoot = await app.writeCache();
  const { js } = await bundleClient(genRoot);
  if (options.routeRevalidateSeconds) {
    for (const route of app.routes) {
      const seconds = options.routeRevalidateSeconds[route.path];
      if (seconds !== undefined) {
        route.revalidateSeconds = seconds;
        route.mode = "isr";
        route.manifestRoute.mode = "isr";
        route.manifestRoute.revalidateSeconds = seconds;
      }
    }
  }
  const htmlCache = options.htmlCacheDir
    ? new FsHtmlCacheAdapter(options.htmlCacheDir)
    : undefined;
  const fetch = createAppFetch({
    app,
    clientBundle: js,
    internalRoutes: options.internalRoutes,
    htmlCache,
  });
  const hostname = "127.0.0.1";
  const server = await createListenFetchServer(fetch, { port, hostname });
  return {
    url: server.url,
    close: () => server.close(),
  };
}

export async function createTestServer(port = 0) {
  return createAppTestServer(port, { appDir: "examples/counter" });
}

export async function createNavDemoTestServer(port = 0, extra: Omit<TestServerOptions, "appDir"> = {}) {
  return createAppTestServer(port, {
    appDir: "examples/nav-demo",
    internalRoutes: true,
    ...extra,
  });
}

export async function createTestServerForApp(appDir: string, port = 0) {
  return createAppTestServer(port, { appDir });
}
