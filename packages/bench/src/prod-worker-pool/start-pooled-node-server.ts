import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { serializeNodeRequest } from "./serialize-node-request.ts";
import { createNodeHandlerWorkerPool, createInProcessNodeHandlerPool } from "./create-node-handler-pool.ts";

export type PooledNodeServerOptions = {
  bootstrapPath: string;
  /** Shared ISR HTML cache in parent — one entry per pathname. */
  isrCacheMs?: number;
  /** Nitro/SolidStart: worker_threads init hangs — run handler in parent. */
  inProcess?: boolean;
};

function writeCaptured(res: ServerResponse, captured: {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}): void {
  res.statusCode = captured.statusCode;
  for (const [key, value] of Object.entries(captured.headers)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (lower === "transfer-encoding" || lower === "content-length" || lower === "connection") continue;
    if (Array.isArray(value)) {
      for (const entry of value) res.appendHeader(key, entry);
    } else {
      res.setHeader(key, value);
    }
  }
  res.setHeader("content-length", String(captured.body.byteLength));
  res.setHeader("connection", "close");
  res.end(captured.body);
}

export async function startPooledNodeBenchServer(options: PooledNodeServerOptions) {
  const pool = options.inProcess
    ? createInProcessNodeHandlerPool(options.bootstrapPath)
    : createNodeHandlerWorkerPool(options.bootstrapPath);
  const isrCache = options.isrCacheMs
    ? new Map<string, { body: Buffer; headers: Record<string, string | string[] | undefined>; at: number }>()
    : null;
  const isrTtl = options.isrCacheMs ?? 0;

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const serialized = await serializeNodeRequest(req);
    if (isrCache) {
      const path = serialized.url.split("?")[0] ?? "/";
      const now = Date.now();
      const hit = isrCache.get(path);
      if (hit && now - hit.at < isrTtl) {
        writeCaptured(res, {
          statusCode: 200,
          headers: { ...hit.headers, "x-cache": "hit" },
          body: hit.body,
        });
        return;
      }
      const captured = await pool.run(serialized);
      const headers = { ...captured.headers, "x-cache": "miss" };
      isrCache.set(path, { body: captured.body, headers, at: now });
      writeCaptured(res, { ...captured, headers });
      return;
    }
    writeCaptured(res, await pool.run(serialized));
  }

  // Warm one worker compile path before listen.
  await pool.run({
    method: "GET",
    url: "/",
    headers: { host: "127.0.0.1" },
    bodyBase64: "",
  });

  const hostname = "127.0.0.1";
  return new Promise<{
    url: string;
    port: number;
    close: () => Promise<void>;
  }>((resolve, reject) => {
    const server = createServer((req, res) => {
      handle(req, res).catch((err) => {
        res.statusCode = 500;
        res.end(err instanceof Error ? err.message : String(err));
      });
    });
    server.keepAliveTimeout = 72_000;
    server.headersTimeout = 75_000;
    server.requestTimeout = 0;
    server.listen(0, hostname, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        url: `http://${hostname}:${port}`,
        port,
        close: async () => {
          await pool.close();
          await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
        },
      });
    });
    server.once("error", reject);
  });
}
