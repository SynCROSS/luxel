import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";

export async function sendFetchToNodeResponse(
  fetchHandler: (req: Request) => Promise<Response>,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const host = req.headers.host ?? "localhost";
  const url = `http://${host}${req.url ?? "/"}`;
  const method = req.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD";

  const request = new Request(url, {
    method,
    headers: req.headers as HeadersInit,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    duplex: hasBody ? "half" : undefined,
  } as RequestInit);

  const response = await fetchHandler(request);
  res.statusCode = response.status;
  res.statusMessage = response.statusText;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (!response.body) {
    res.end();
    return;
  }

  await Readable.fromWeb(response.body).pipe(res);
}
