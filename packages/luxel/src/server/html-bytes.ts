const HTML_ENCODER = new TextEncoder();
const HTML_BODY_HEADERS = new WeakMap<Uint8Array, Readonly<Record<string, string>>>();

export function encodeHtmlBody(html: string): Uint8Array {
  return HTML_ENCODER.encode(html);
}

export function htmlBodyHeaders(body: Uint8Array): Readonly<Record<string, string>> {
  const cached = HTML_BODY_HEADERS.get(body);
  if (cached) return cached;
  const headers = Object.freeze({
    "content-type": "text/html; charset=utf-8",
    "content-length": String(body.byteLength),
  });
  HTML_BODY_HEADERS.set(body, headers);
  return headers;
}

export function pathnameFromRequestUrl(rawUrl: string): string {
  const schemeEnd = rawUrl.indexOf("://");
  const searchFrom = schemeEnd >= 0 ? schemeEnd + 3 : 0;
  const pathStart = rawUrl.indexOf("/", searchFrom);
  if (pathStart < 0) return "/";
  const queryStart = rawUrl.indexOf("?", pathStart);
  return queryStart < 0 ? rawUrl.slice(pathStart) : rawUrl.slice(pathStart, queryStart);
}

export function requestHasStreamQuery(rawUrl: string): boolean {
  const queryStart = rawUrl.indexOf("?");
  if (queryStart < 0) return false;
  for (const part of rawUrl.slice(queryStart + 1).split("&")) {
    if (!part) continue;
    if (part.split("=", 1)[0] === "stream") return true;
  }
  return false;
}

export function precomputedHtmlResponse(
  body: Uint8Array,
  method: string,
  extraHeaders?: Readonly<Record<string, string>>,
): Response {
  const headers = extraHeaders
    ? Object.freeze({ ...htmlBodyHeaders(body), ...extraHeaders })
    : htmlBodyHeaders(body);
  return new Response(method === "HEAD" ? null : body, { headers });
}
