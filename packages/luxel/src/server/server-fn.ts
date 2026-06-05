import type { CompiledApp } from "../route/compile-app.ts";

export type ServerFnHandler = (input: unknown) => Promise<unknown>;

export function buildServerFnRegistry(app: CompiledApp): Map<string, ServerFnHandler> {
  const registry = new Map<string, ServerFnHandler>();
  for (const route of app.routes) {
    for (const fn of route.serverFunctions) {
      registry.set(fn.id, (input) => route.callServerFn(fn.name, input));
    }
  }
  return registry;
}

function assertSameOrigin(req: Request, url: URL): boolean {
  const origin = req.headers.get("origin");
  if (origin) return new URL(origin).origin === url.origin;
  const referer = req.headers.get("referer");
  if (!referer) return false;
  return new URL(referer).origin === url.origin;
}

async function readServerFnBody(
  req: Request,
): Promise<{ id?: string; input?: unknown; csrf?: string } | null> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await req.json()) as { id?: string; input?: unknown };
    return { id: json.id, input: json.input, csrf: req.headers.get("x-luxel-csrf") ?? undefined };
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(await req.text());
    return {
      id: params.get("luxel-fn-id") ?? undefined,
      input: JSON.parse(params.get("luxel-fn-input") ?? "{}") as unknown,
      csrf: params.get("luxel-csrf") ?? undefined,
    };
  }
  return null;
}

export async function handleServerFnRequest(
  req: Request,
  url: URL,
  registry: Map<string, ServerFnHandler>,
  session: { csrfToken: string } | null,
): Promise<Response> {
  if (!assertSameOrigin(req, url)) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!session) return new Response("Unauthorized", { status: 401 });
  const body = await readServerFnBody(req);
  if (!body?.id) return new Response("id required", { status: 400 });
  const csrf = body.csrf ?? req.headers.get("x-luxel-csrf");
  if (!csrf || csrf !== session.csrfToken) {
    return new Response("Forbidden", { status: 403 });
  }
  const handler = registry.get(body.id);
  if (!handler) return new Response("Not Found", { status: 404 });
  try {
    const result = await handler(body.input ?? {});
    return Response.json(result);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
}
