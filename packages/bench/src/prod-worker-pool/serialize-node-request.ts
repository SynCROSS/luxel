import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";

export type SerializedNodeRequest = {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  bodyBase64: string;
};

export async function serializeNodeRequest(req: IncomingMessage): Promise<SerializedNodeRequest> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return {
    method: req.method ?? "GET",
    url: req.url ?? "/",
    headers: req.headers as Record<string, string | string[] | undefined>,
    bodyBase64: Buffer.concat(chunks).toString("base64"),
  };
}

export function deserializeNodeRequest(data: SerializedNodeRequest): IncomingMessage {
  const body = Buffer.from(data.bodyBase64, "base64");
  const stream = Readable.from(body.length > 0 ? [body] : []);
  const headers = { host: "127.0.0.1", ...data.headers };
  const url = data.url.startsWith("/") ? data.url : `/${data.url}`;
  const connection = { encrypted: false, remoteAddress: "127.0.0.1" };
  return Object.assign(stream, {
    method: data.method,
    url,
    originalUrl: url,
    headers,
    httpVersion: "1.1",
    httpVersionMajor: 1,
    httpVersionMinor: 1,
    complete: body.length === 0,
    aborted: false,
    socket: connection,
    connection,
    trailers: {},
    rawTrailers: [],
    rawHeaders: Object.entries(headers).flatMap(([k, v]) =>
      Array.isArray(v) ? v.flatMap((x) => [k, x]) : [k, String(v)],
    ),
  }) as IncomingMessage;
}
