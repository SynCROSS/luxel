import { createAppFetch } from "../server/handler.ts";
import { bundleClient } from "../build/client-bundle.ts";
import { compileApp, compileCounterApp, type CompileAppOptions } from "../route/compile-app.ts";
import { FsHtmlCacheAdapter } from "../server/html-cache-fs.ts";
import { createRenderWorker } from "../server/render-worker.ts";
import { normalizePath } from "../server/fetch-pipeline.ts";
import { applyBenchFullRender, LUXEL_BENCH_POOL_FULL_SUFFIX } from "../bench/precompile-luxel-bench.ts";
import {
  isLuxelBenchFullRender,
  isLuxelBenchMinimalHtml,
  stripLuxelBenchSidecars,
} from "../bench/strip-bench-html.ts";
import { createListenFetchServer } from "./http-server.ts";
import { getLuxelRepoRoot } from "../paths.ts";

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" } as const;

export type TestServerOptions = {
  appDir?: string;
  internalRoutes?: boolean;
  htmlCacheDir?: string;
  routeRevalidateSeconds?: Record<string, number>;
  /** Force per-request load + render (disables compile-time precompute fast path). */
  benchFullRender?: boolean;
  /** Native lab row: per-request native without compile-time precompute. */
  benchNativeLab?: boolean;
  /** Strip luxel-data / luxel-hydration / client script from HTML responses. */
  benchMinimalHtml?: boolean;
  /** Bench hot path: Bun.serve → render worker only (skip full fetch pipeline). */
  benchSlimFetch?: boolean;
  routeSsrBackends?: CompileAppOptions["routeSsrBackends"];
};

function wrapBenchMinimalHtml(
  fetch: (req: Request) => Promise<Response>,
  enabled: boolean,
): (req: Request) => Promise<Response> {
  if (!enabled) return fetch;
  return async (req) => {
    const res = await fetch(req);
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return res;
    const html = stripLuxelBenchSidecars(await res.text());
    return new Response(html, { status: res.status, headers: res.headers });
  };
}

function createBenchSlimFetch(
  app: Awaited<ReturnType<typeof compileApp>>,
): (req: Request) => Promise<Response> {
  const worker = createRenderWorker(app);
  return async (req) => {
    const path = normalizePath(new URL(req.url).pathname);
    if (req.method !== "GET" || !app.getRoute(path)) {
      return new Response("Not Found", { status: 404 });
    }
    const { stream } = await worker.renderStream(path);
    return new Response(stream, { headers: HTML_HEADERS });
  };
}

async function createAppTestServer(port: number, options: TestServerOptions) {
  const repoRoot = getLuxelRepoRoot();
  const appDir = options.appDir ?? "examples/counter";
  const compileOpts: CompileAppOptions = {
    routeSsrBackends: options.routeSsrBackends,
    benchFullRender: options.benchFullRender,
    benchNativeLab: options.benchNativeLab,
    ...(options.benchFullRender ? { genRootSuffix: LUXEL_BENCH_POOL_FULL_SUFFIX } : {}),
  };
  const app =
    appDir === "examples/counter"
      ? await compileCounterApp(repoRoot, compileOpts)
      : await compileApp(repoRoot, appDir, compileOpts);
  const benchFullRender = options.benchFullRender ?? isLuxelBenchFullRender();
  if (benchFullRender) applyBenchFullRender(app);
  const genRoot = await app.writeCache();
  const { js } = options.benchSlimFetch ? { js: "" } : await bundleClient(genRoot);
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
  const benchMinimalHtml = options.benchMinimalHtml ?? isLuxelBenchMinimalHtml();
  const fetch = wrapBenchMinimalHtml(
    options.benchSlimFetch
      ? createBenchSlimFetch(app)
      : createAppFetch({
          app,
          clientBundle: js,
          internalRoutes: options.internalRoutes,
          htmlCache,
        }),
    benchMinimalHtml,
  );
  const hostname = "127.0.0.1";
  const server = await createListenFetchServer(fetch, { port, hostname });
  return {
    url: server.url,
    close: () => server.close(),
  };
}

export async function createTestServer(
  port = 0,
  options: Omit<TestServerOptions, "appDir"> = {},
) {
  return createAppTestServer(port, { appDir: "examples/counter", ...options });
}

export async function createNavDemoTestServer(
  port = 0,
  extra: Omit<TestServerOptions, "appDir"> = {},
) {
  return createAppTestServer(port, {
    appDir: "examples/nav-demo",
    internalRoutes: true,
    ...extra,
  });
}

export async function createTestServerForApp(
  appDir: string,
  port = 0,
  options: Omit<TestServerOptions, "appDir"> = {},
) {
  return createAppTestServer(port, { appDir, ...options });
}
