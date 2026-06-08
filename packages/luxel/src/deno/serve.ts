import { createLuxelFetchFromDist } from "../deploy/create-luxel-fetch.ts";
import type { CompressOptions } from "../server/compress.ts";

export type ServeLuxelOptions = {
  distDir: string;
  port?: number;
  hostname?: string;
  compress?: CompressOptions;
  useProductionCompress?: boolean;
};

export type LuxelDenoServer = {
  url: string;
  port: number;
  close: () => void;
};

export async function serveLuxel(options: ServeLuxelOptions): Promise<LuxelDenoServer> {
  const fetch = await createLuxelFetchFromDist(options);
  const hostname = options.hostname ?? "127.0.0.1";
  const port = options.port ?? 0;

  const controller = new AbortController();
  const server = Deno.serve({ hostname, port, signal: controller.signal }, fetch);
  const boundPort = server.addr.port;
  const url = `http://${hostname}:${boundPort}`;

  return {
    url,
    port: boundPort,
    close: () => {
      controller.abort();
      void server.shutdown();
    },
  };
}
