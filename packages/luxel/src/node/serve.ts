import { createServer, type Server } from "node:http";
import { createLuxelFetchFromDist } from "../deploy/create-luxel-fetch.ts";
import type { CompressOptions } from "../server/compress.ts";
import { sendFetchToNodeResponse } from "./http-bridge.ts";

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
  const fetch = await createLuxelFetchFromDist(options);

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
