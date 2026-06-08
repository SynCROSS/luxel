import { createRenderWorker, type RenderWorker } from "./render-worker.ts";
import type { AppRuntime } from "./app-runtime.ts";
import { wrapCompress, type CompressOptions } from "./compress.ts";
import { resolveCompressOptions } from "../config/compress.ts";
import {
  defaultFetchStages,
  normalizePath,
  resolveSession,
  runFetchPipeline,
  type RequestContext,
} from "./fetch-pipeline.ts";
import { TieredHtmlCacheAdapter } from "./html-cache-tiered.ts";

export type AppServerOptions = {
  app: AppRuntime;
  clientBundle: Uint8Array | string;
  /** Enables POST /__luxel/revalidate for server integration tests only. */
  internalRoutes?: boolean;
  /** When set, prerendered HTML is served before the render worker. */
  staticRoot?: string;
  /** ISR HTML cache (filesystem adapter in production/tests). */
  htmlCache?: import("./html-cache.ts").HtmlCacheAdapter;
  sessionStore?: import("../auth/session.ts").SessionStoreAdapter;
  authProvider?: import("../auth/provider.ts").AuthProvider;
  serverFnRegistry?: Map<string, import("./server-fn.ts").ServerFnHandler>;
  compress?: CompressOptions;
  /** Test hook: override default render worker factory. */
  createRenderWorker?: (app: AppRuntime) => RenderWorker;
};

export function createAppServerFetch(options: AppServerOptions): (req: Request) => Promise<Response> {
  const fetch = createAppFetch(options);
  const compress = resolveCompressOptions(undefined, options.compress);
  if (!compress.enabled) return fetch;
  return wrapCompress(fetch, compress);
}

function buildPrecomputedHtmlBodies(app: AppRuntime): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  const enc = new TextEncoder();
  for (const manifestRoute of app.manifest.routes) {
    const route = app.getRoute(manifestRoute.path);
    if (!route?.precomputedHtml) continue;
    out.set(normalizePath(manifestRoute.path), enc.encode(route.precomputedHtml));
  }
  return out;
}

export function createAppFetch(options: AppServerOptions): (req: Request) => Promise<Response> {
  const worker = (options.createRenderWorker ?? createRenderWorker)(options.app);
  const precomputedHtml = buildPrecomputedHtmlBodies(options.app);
  const htmlCache = options.htmlCache
    ? new TieredHtmlCacheAdapter(options.htmlCache)
    : undefined;
  const fetchOptions: AppServerOptions = htmlCache ? { ...options, htmlCache } : options;

  return async (req) => {
    const url = new URL(req.url);
    const path = normalizePath(url.pathname);
    const route = fetchOptions.app.getRoute(path);
    const session = await resolveSession(req, fetchOptions.sessionStore);
    worker.setSession(session);

    const ctx: RequestContext = {
      req,
      url,
      path,
      route,
      session,
      worker,
      options: fetchOptions,
      precomputedHtml,
    };
    return runFetchPipeline(ctx, defaultFetchStages);
  };
}
