import { buildPrecomputedHtmlBodies, createAppFetch } from "../server/handler.ts";
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

const HTML_BODY_HEADERS = new WeakMap<Uint8Array, Readonly<Record<string, string>>>();
const HTML_ENCODER = new TextEncoder();

function htmlHeadersForBody(body: Uint8Array): Readonly<Record<string, string>> {
  const cached = HTML_BODY_HEADERS.get(body);
  if (cached) return cached;
  const headers = Object.freeze({
    "content-type": "text/html; charset=utf-8",
    "content-length": String(body.byteLength),
  });
  HTML_BODY_HEADERS.set(body, headers);
  return headers;
}

function pathnameFromRequestUrl(rawUrl: string): string {
  const schemeEnd = rawUrl.indexOf("://");
  const searchFrom = schemeEnd >= 0 ? schemeEnd + 3 : 0;
  const pathStart = rawUrl.indexOf("/", searchFrom);
  if (pathStart < 0) return "/";
  const queryStart = rawUrl.indexOf("?", pathStart);
  return queryStart < 0 ? rawUrl.slice(pathStart) : rawUrl.slice(pathStart, queryStart);
}

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
    const body = HTML_ENCODER.encode(html);
    const headers = new Headers(res.headers);
    headers.set("content-length", String(body.byteLength));
    return new Response(body, { status: res.status, headers });
  };
}

async function createBenchSlimFetch(
  app: Awaited<ReturnType<typeof compileApp>>,
  benchFullRender: boolean,
  benchMinimalHtml: boolean,
): Promise<(req: Request) => Promise<Response>> {
  const worker = createRenderWorker(app);
  const precomputedHtml = buildPrecomputedHtmlBodies(app);
  const precomputedHtmlHeaders = new Map<string, Readonly<Record<string, string>>>();
  for (const [path, body] of precomputedHtml) {
    precomputedHtmlHeaders.set(path, htmlHeadersForBody(body));
  }

  function finalizeBody(body: Uint8Array): Uint8Array {
    if (!benchMinimalHtml) return body;
    const html = stripLuxelBenchSidecars(new TextDecoder().decode(body));
    return HTML_ENCODER.encode(html);
  }

  const hotBodies = new Map<string, Uint8Array>();
  const hotHeaders = new Map<string, Readonly<Record<string, string>>>();
  if (!benchFullRender) {
    for (const route of app.routes) {
      const path = normalizePath(route.path);
      const prebuilt = precomputedHtml.get(path);
      if (prebuilt) continue;
      const { body } = await worker.renderBytes(path);
      const hot = finalizeBody(body);
      hotBodies.set(path, hot);
      hotHeaders.set(path, htmlHeadersForBody(hot));
    }
  }

  return async (req) => {
    const path = normalizePath(pathnameFromRequestUrl(req.url));
    if ((req.method !== "GET" && req.method !== "HEAD") || !app.getRoute(path)) {
      return new Response("Not Found", { status: 404 });
    }
    const prebuilt = precomputedHtml.get(path);
    if (prebuilt) {
      return new Response(req.method === "HEAD" ? null : prebuilt, {
        headers: precomputedHtmlHeaders.get(path),
      });
    }
    const hot = hotBodies.get(path);
    if (hot) {
      return new Response(req.method === "HEAD" ? null : hot, {
        headers: hotHeaders.get(path),
      });
    }
    const { body } = await worker.renderBytes(path);
    const out = finalizeBody(body);
    return new Response(req.method === "HEAD" ? null : out, {
      headers: htmlHeadersForBody(out),
    });
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
  const fetch = options.benchSlimFetch
    ? await createBenchSlimFetch(app, benchFullRender, benchMinimalHtml)
    : wrapBenchMinimalHtml(
        createAppFetch({
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
