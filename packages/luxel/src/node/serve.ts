import { createServer, type Server } from "node:http";
import { loadAppFromDist } from "../deploy/load-app.ts";
import { createAppServerFetch } from "../server/handler.ts";
import type { CompressOptions } from "../server/compress.ts";
import { sendFetchToNodeResponse } from "./http-bridge.ts";
import { resolveProductionCompressOptions } from "../config/compress.ts";

export type ServeLuxelOptions = {
  distDir: string;
  port?: number;
  hostname?: string;
  compress?: CompressOptions;
  /** Uses production compress defaults from built entry when omitted. */
  useProductionCompress?: boolean;
};

export type LuxelNodeServer = {
  url: string;
  port: number;
  close: () => Promise<void>;
};

export async function serveLuxel(options: ServeLuxelOptions): Promise<LuxelNodeServer> {
  const { app, clientBundle } = await loadAppFromDist(options.distDir);
  const compress =
    options.compress ??
    (options.useProductionCompress !== false
      ? resolveProductionCompressOptions()
      : { enabled: false });

  const fetch = createAppServerFetch({ app, clientBundle, compress });

  const server: Server = createServer((req, res) => {
    void sendFetchToNodeResponse(fetch, req, res).catch((err) => {
      if (!res.headersSent) res.statusCode = 500;
      res.end(err instanceof Error ? err.message : "Internal Server Error");
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, options.hostname ?? "127.0.0.1", () => resolve());
  });

  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("failed to bind HTTP server");
  }

  const port = addr.port;
  const host = options.hostname ?? "127.0.0.1";
  const url = `http://${host}:${port}`;

  return {
    url,
    port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
