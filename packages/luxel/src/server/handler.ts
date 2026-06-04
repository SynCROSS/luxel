import { ASSET_CLIENT } from "../compiler/codegen-ssr.ts";
import { createRenderWorker } from "./render-worker.ts";
import type { CompiledApp } from "../route/compile-app.ts";
import { wrapCompress, type CompressOptions } from "./compress.ts";
import { resolveCompressOptions } from "../config/compress.ts";

export type AppServerOptions = {
  app: CompiledApp;
  clientBundle: Uint8Array | string;
  /** Enables POST /__luxel/revalidate for server integration tests only. */
  internalRoutes?: boolean;
  compress?: CompressOptions;
};

export function createAppServerFetch(options: AppServerOptions): (req: Request) => Promise<Response> {
  const fetch = createAppFetch(options);
  const compress = resolveCompressOptions(undefined, options.compress);
  if (!compress.enabled) return fetch;
  return wrapCompress(fetch, compress);
}

function normalizePath(pathname: string): string {
  if (pathname === "" || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function createAppFetch(options: AppServerOptions): (req: Request) => Promise<Response> {
  const worker = createRenderWorker(options.app);

  return async (req) => {
    const url = new URL(req.url);

    if (options.internalRoutes && url.pathname === "/__luxel/revalidate" && req.method === "POST") {
      const body = (await req.json()) as { tag?: string };
      if (!body.tag) {
        return new Response("tag required", { status: 400 });
      }
      worker.revalidateTag(body.tag);
      return new Response(null, { status: 204 });
    }

    if (url.pathname === `/assets/${ASSET_CLIENT}`) {
      const body =
        typeof options.clientBundle === "string" ? options.clientBundle : options.clientBundle;
      return new Response(body, {
        headers: { "content-type": "application/javascript; charset=utf-8" },
      });
    }

    const path = normalizePath(url.pathname);
    const route = options.app.getRoute(path);
    if (!route) {
      return new Response("Not Found", { status: 404 });
    }

    const useStream = url.searchParams.has("stream");
    if (useStream) {
      const { stream } = await worker.renderStream(path);
      return new Response(stream, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    const { html } = await worker.render(path);
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  };
}
