import { createServer, type Server } from "node:http";
import { sendFetchToNodeResponse } from "../node/http-bridge.ts";

export type ListenFetchServer = {
  url: string;
  port: number;
  close: () => Promise<void>;
};

export async function createListenFetchServer(
  fetch: (req: Request) => Promise<Response>,
  options: { port?: number; hostname?: string } = {},
): Promise<ListenFetchServer> {
  const hostname = options.hostname ?? "127.0.0.1";
  const port = options.port ?? 0;

  if (typeof Bun !== "undefined" && "serve" in Bun) {
    const server = Bun.serve({
      hostname,
      port,
      fetch,
    });
    return {
      url: `http://${hostname}:${server.port}`,
      port: server.port!,
      close: async () => {
        server.stop();
      },
    };
  }

  const server: Server = createServer((req, res) => {
    void sendFetchToNodeResponse(fetch, req, res).catch((err) => {
      if (!res.headersSent) res.statusCode = 500;
      res.end(err instanceof Error ? err.message : "error");
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, hostname, () => resolve());
  });

  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("bind failed");
  const boundPort = addr.port;

  return {
    url: `http://${hostname}:${boundPort}`,
    port: boundPort,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
