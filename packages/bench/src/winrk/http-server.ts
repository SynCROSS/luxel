import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

export type BenchServer = {
  url: string;
  port: number;
  close: () => Promise<void>;
};

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

export async function createFetchServer(
  fetch: (req: Request) => Promise<Response>,
  port = 0,
  hostname = "127.0.0.1",
  options: { forceNodeHttp?: boolean } = {},
): Promise<BenchServer> {
  const forceNodeHttp =
    options.forceNodeHttp === true || process.env.BENCH_FORCE_NODE_HTTP === "1";
  if (typeof Bun !== "undefined" && "serve" in Bun && !forceNodeHttp) {
    const server = Bun.serve({ hostname, port, fetch, idleTimeout: 120 });
    return {
      url: `http://${hostname}:${server.port}`,
      port: server.port!,
      close: async () => {
        await server.stop(true);
      },
    };
  }

  const server: Server = createServer((req, res) => {
    const host = req.headers.host ?? `${hostname}:${port}`;
    const url = new URL(req.url ?? "/", `http://${host}`);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
    const init: RequestInit = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = req;
      // @ts-expect-error duplex required for streaming body in Node 20+
      init.duplex = "half";
    }
    const request = new Request(url, init);
    void fetch(request)
      .then(async (response) => {
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        if (req.method === "HEAD") {
          res.end();
          return;
        }
        const buf = Buffer.from(await response.arrayBuffer());
        res.end(buf);
      })
      .catch((err) => {
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
  return {
    url: `http://${hostname}:${addr.port}`,
    port: addr.port,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

export async function createStaticServer(rootDir: string, port = 0): Promise<BenchServer> {
  return createFetchServer(async (req) => {
    const path = new URL(req.url).pathname;
    const filePath = join(rootDir, path === "/" ? "index.html" : path.replace(/^\//, ""));
    try {
      const body = await readFile(filePath);
      const ext = extname(filePath);
      return new Response(body, {
        headers: { "content-type": MIME[ext] ?? "application/octet-stream" },
      });
    } catch {
      try {
        const fallback = await readFile(join(rootDir, "index.html"));
        return new Response(fallback, { headers: { "content-type": "text/html; charset=utf-8" } });
      } catch {
        return new Response("not found", { status: 404 });
      }
    }
  }, port);
}
