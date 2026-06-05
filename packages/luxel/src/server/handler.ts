import { ASSET_CLIENT } from "../compiler/codegen-ssr.ts";
import { createRenderWorker } from "./render-worker.ts";
import type { AppRuntime } from "./app-runtime.ts";
import { wrapCompress, type CompressOptions } from "./compress.ts";
import { resolveCompressOptions } from "../config/compress.ts";
import { tryReadStaticHtml } from "./static-html.ts";
import { generateTrisomorphicSw } from "../runtime/trisomorphic-sw.ts";
import { isCacheFresh, type HtmlCacheAdapter } from "./html-cache.ts";
import type { ResourceSnapshot } from "../resource-store/types.ts";
import type { AuthProvider } from "../auth/provider.ts";
import type { SessionStoreAdapter } from "../auth/session.ts";
import {
  clearSessionCookieHeader,
  createCsrfToken,
  parseSessionCookie,
  sessionCookieHeader,
} from "../auth/session.ts";
import type { LoadSession } from "../resource-store/load-context.ts";
import type { ServerFnHandler } from "./server-fn.ts";
import { handleServerFnRequest } from "./server-fn.ts";

export type AppServerOptions = {
  app: AppRuntime;
  clientBundle: Uint8Array | string;
  /** Enables POST /__luxel/revalidate for server integration tests only. */
  internalRoutes?: boolean;
  /** When set, prerendered HTML is served before the render worker. */
  staticRoot?: string;
  /** ISR HTML cache (filesystem adapter in production/tests). */
  htmlCache?: HtmlCacheAdapter;
  sessionStore?: SessionStoreAdapter;
  authProvider?: AuthProvider;
  serverFnRegistry?: Map<string, ServerFnHandler>;
  compress?: CompressOptions;
};

function tagsFromSnapshot(resources: ResourceSnapshot): string[] {
  const tags = new Set<string>();
  for (const entry of Object.values(resources)) {
    for (const tag of entry.tags ?? []) tags.add(tag);
  }
  return [...tags];
}

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

const SESSION_MAX_AGE_SECONDS = 86_400;

async function resolveSession(
  req: Request,
  sessionStore: SessionStoreAdapter | undefined,
): Promise<LoadSession | null> {
  if (!sessionStore) return null;
  const sessionId = parseSessionCookie(req.headers.get("cookie"));
  if (!sessionId) return null;
  const record = await sessionStore.get(sessionId);
  if (!record) return null;
  return { userId: record.userId, csrfToken: record.csrfToken };
}

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" } as const;

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
  const worker = createRenderWorker(options.app);
  const precomputedHtml = buildPrecomputedHtmlBodies(options.app);

  return async (req) => {
    const url = new URL(req.url);

    if (
      options.sessionStore &&
      options.authProvider &&
      url.pathname === "/__luxel/auth/login" &&
      req.method === "POST"
    ) {
      const body = (await req.json()) as { email?: string; password?: string };
      if (!body.email || !body.password) {
        return new Response("credentials required", { status: 400 });
      }
      const user = await options.authProvider.authenticate({
        email: body.email,
        password: body.password,
      });
      if (!user) return new Response("Unauthorized", { status: 401 });
      const session = await options.sessionStore.create({
        userId: user.userId,
        csrfToken: createCsrfToken(),
        expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
      });
      return new Response(null, {
        status: 204,
        headers: {
          "Set-Cookie": sessionCookieHeader(session.id, SESSION_MAX_AGE_SECONDS),
          "X-Luxel-CSRF": session.csrfToken,
        },
      });
    }

    if (options.serverFnRegistry && url.pathname === "/__luxel/fn" && req.method === "POST") {
      const session = await resolveSession(req, options.sessionStore);
      return handleServerFnRequest(req, url, options.serverFnRegistry, session);
    }

    if (options.sessionStore && url.pathname === "/__luxel/auth/logout" && req.method === "POST") {
      const sessionId = parseSessionCookie(req.headers.get("cookie"));
      if (sessionId) await options.sessionStore.delete(sessionId);
      return new Response(null, {
        status: 204,
        headers: { "Set-Cookie": clearSessionCookieHeader() },
      });
    }

    if (options.sessionStore) {
      worker.setSession(await resolveSession(req, options.sessionStore));
    } else {
      worker.setSession(null);
    }

    if (options.internalRoutes && url.pathname === "/__luxel/revalidate" && req.method === "POST") {
      const body = (await req.json()) as { tag?: string };
      if (!body.tag) {
        return new Response("tag required", { status: 400 });
      }
      worker.revalidateTag(body.tag);
      await options.htmlCache?.invalidateByTag(body.tag);
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/luxel-sw.js") {
      const policies: Record<string, import("../runtime/trisomorphic-sw.ts").OfflineMode> = {};
      for (const route of options.app.manifest.routes) {
        policies[route.path] = route.offline;
      }
      return new Response(generateTrisomorphicSw(policies), {
        headers: { "content-type": "application/javascript; charset=utf-8" },
      });
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

    const prebuilt = precomputedHtml.get(path);
    if (prebuilt && !options.sessionStore && !url.searchParams.has("stream")) {
      return new Response(prebuilt, { headers: HTML_HEADERS });
    }

    if (options.staticRoot && route.mode === "ssg") {
      const staticHtml = await tryReadStaticHtml(options.staticRoot, path);
      if (staticHtml) {
        return new Response(staticHtml, {
          headers: { "content-type": "text/html; charset=utf-8", "x-luxel-static": "1" },
        });
      }
    }

    const revalidateSeconds = route.revalidateSeconds;
    if (route.mode === "isr" && revalidateSeconds && options.htmlCache) {
      const cached = await options.htmlCache.get(path);
      if (cached && isCacheFresh(cached)) {
        return new Response(cached.html, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "x-luxel-cache": "hit",
          },
        });
      }
    }

    const useStream = url.searchParams.has("stream");
    if (useStream) {
      const { stream } = await worker.renderStream(path);
      return new Response(stream, {
        headers: { "content-type": "text/html; charset=utf-8", "x-luxel-cache": "miss" },
      });
    }

    const { html } = await worker.render(path);
    if (route.mode === "isr" && revalidateSeconds && options.htmlCache) {
      await options.htmlCache.set(path, {
        html,
        writtenAt: Date.now(),
        revalidateSeconds,
        tags: tagsFromSnapshot(worker.getStore().snapshot()),
      });
    }
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8", "x-luxel-cache": "miss" },
    });
  };
}
