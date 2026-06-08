import { ASSET_CLIENT } from "../compiler/codegen-ssr.ts";
import type { RenderWorker } from "./render-worker.ts";
import type { AppRuntime } from "./app-runtime.ts";
import type { AppServerOptions } from "./handler.ts";
import { tryReadStaticHtml } from "./static-html.ts";
import { generateTrisomorphicSw } from "../runtime/trisomorphic-sw.ts";
import { isCacheFresh } from "./html-cache.ts";
import type { ResourceSnapshot } from "../resource-store/types.ts";
import {
  clearSessionCookieHeader,
  createCsrfToken,
  parseSessionCookie,
  sessionCookieHeader,
} from "../auth/session.ts";
import type { LoadSession } from "../resource-store/load-context.ts";
import { handleServerFnRequest } from "./server-fn.ts";

export type RequestContext = {
  req: Request;
  url: URL;
  path: string;
  route: ReturnType<AppRuntime["getRoute"]>;
  session: LoadSession | null;
  worker: RenderWorker;
  options: AppServerOptions;
  precomputedHtml: Map<string, Uint8Array>;
};

export type FetchStage = (ctx: RequestContext) => Promise<Response | null>;

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" } as const;
const SESSION_MAX_AGE_SECONDS = 86_400;

export function normalizePath(pathname: string): string {
  if (pathname === "" || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function tagsFromSnapshot(resources: ResourceSnapshot): string[] {
  const tags = new Set<string>();
  for (const entry of Object.values(resources)) {
    for (const tag of entry.tags ?? []) tags.add(tag);
  }
  return [...tags];
}

export async function resolveSession(
  req: Request,
  sessionStore: AppServerOptions["sessionStore"],
): Promise<LoadSession | null> {
  if (!sessionStore) return null;
  const sessionId = parseSessionCookie(req.headers.get("cookie"));
  if (!sessionId) return null;
  const record = await sessionStore.get(sessionId);
  if (!record) return null;
  return { userId: record.userId, csrfToken: record.csrfToken };
}

export const matchAuthLogin: FetchStage = async (ctx) => {
  const { options, req, url } = ctx;
  if (
    !options.sessionStore ||
    !options.authProvider ||
    url.pathname !== "/__luxel/auth/login" ||
    req.method !== "POST"
  ) {
    return null;
  }
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
};

export const matchServerFn: FetchStage = async (ctx) => {
  const { options, req, url } = ctx;
  if (!options.serverFnRegistry || url.pathname !== "/__luxel/fn" || req.method !== "POST") {
    return null;
  }
  return handleServerFnRequest(req, url, options.serverFnRegistry, ctx.session);
};

export const matchAuthLogout: FetchStage = async (ctx) => {
  const { options, req, url } = ctx;
  if (!options.sessionStore || url.pathname !== "/__luxel/auth/logout" || req.method !== "POST") {
    return null;
  }
  const sessionId = parseSessionCookie(req.headers.get("cookie"));
  if (sessionId) await options.sessionStore.delete(sessionId);
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearSessionCookieHeader() },
  });
};

export const matchInternalRevalidate: FetchStage = async (ctx) => {
  const { options, req, url, worker } = ctx;
  if (!options.internalRoutes || url.pathname !== "/__luxel/revalidate" || req.method !== "POST") {
    return null;
  }
  const body = (await req.json()) as { tag?: string };
  if (!body.tag) {
    return new Response("tag required", { status: 400 });
  }
  worker.revalidateTag(body.tag);
  await options.htmlCache?.invalidateByTag(body.tag);
  return new Response(null, { status: 204 });
};

export const matchServiceWorker: FetchStage = async (ctx) => {
  if (ctx.url.pathname !== "/luxel-sw.js") return null;
  const policies: Record<string, import("../runtime/trisomorphic-sw.ts").OfflineMode> = {};
  for (const route of ctx.options.app.manifest.routes) {
    policies[route.path] = route.offline;
  }
  return new Response(generateTrisomorphicSw(policies), {
    headers: { "content-type": "application/javascript; charset=utf-8" },
  });
};

export const matchClientAsset: FetchStage = async (ctx) => {
  if (ctx.url.pathname !== `/assets/${ASSET_CLIENT}`) return null;
  const body =
    typeof ctx.options.clientBundle === "string"
      ? ctx.options.clientBundle
      : ctx.options.clientBundle;
  return new Response(body, {
    headers: { "content-type": "application/javascript; charset=utf-8" },
  });
};

export const matchNotFound: FetchStage = async (ctx) => {
  if (ctx.route) return null;
  return new Response("Not Found", { status: 404 });
};

export const matchPrecomputedHtml: FetchStage = async (ctx) => {
  const prebuilt = ctx.precomputedHtml.get(ctx.path);
  if (!prebuilt || ctx.options.sessionStore || ctx.url.searchParams.has("stream")) {
    return null;
  }
  return new Response(prebuilt, { headers: HTML_HEADERS });
};

export const matchStaticSsg: FetchStage = async (ctx) => {
  const { options, path, route } = ctx;
  if (!route || !options.staticRoot || route.mode !== "ssg") return null;
  const staticHtml = await tryReadStaticHtml(options.staticRoot, path);
  if (!staticHtml) return null;
  return new Response(staticHtml, {
    headers: { "content-type": "text/html; charset=utf-8", "x-luxel-static": "1" },
  });
};

export const matchIsrCache: FetchStage = async (ctx) => {
  const { options, path, route } = ctx;
  const revalidateSeconds = route?.revalidateSeconds;
  if (!route || route.mode !== "isr" || !revalidateSeconds || !options.htmlCache) {
    return null;
  }
  const cached = await options.htmlCache.get(path);
  if (!cached || !isCacheFresh(cached)) return null;
  return new Response(cached.body ?? cached.html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-luxel-cache": "hit",
    },
  });
};

export const matchRender: FetchStage = async (ctx) => {
  const { worker, path, route, url, options } = ctx;
  if (!route) return null;
  const revalidateSeconds = route.revalidateSeconds;
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
      body: new TextEncoder().encode(html),
      writtenAt: Date.now(),
      revalidateSeconds,
      tags: tagsFromSnapshot(worker.getStore().snapshot()),
    });
  }
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "x-luxel-cache": "miss" },
  });
};

export const defaultFetchStages: FetchStage[] = [
  matchAuthLogin,
  matchServerFn,
  matchAuthLogout,
  matchInternalRevalidate,
  matchServiceWorker,
  matchClientAsset,
  matchNotFound,
  matchPrecomputedHtml,
  matchStaticSsg,
  matchIsrCache,
  matchRender,
];

export async function runFetchPipeline(
  ctx: RequestContext,
  stages: FetchStage[] = defaultFetchStages,
): Promise<Response> {
  for (const stage of stages) {
    const res = await stage(ctx);
    if (res) return res;
  }
  return new Response("Not Found", { status: 404 });
}
