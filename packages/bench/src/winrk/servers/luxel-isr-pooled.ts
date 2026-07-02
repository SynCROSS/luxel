import { createLuxelNavDemoRenderPool } from "@luxel/luxel/bench";
import { createFetchServer, type BenchServer } from "../http-server.ts";

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" } as const;
const ISR_TTL_MS = 1000;

export async function startLuxelIsrWorkerPoolServer(): Promise<BenchServer> {
  const pool = await createLuxelNavDemoRenderPool();
  const cache = new Map<string, { body: string; at: number }>();
  await pool.warmup();

  const server = await createFetchServer(
    async (req) => {
      const path = new URL(req.url).pathname;
      const now = Date.now();
      const hit = cache.get(path);
      if (hit && now - hit.at < ISR_TTL_MS) {
        return new Response(hit.body, {
          headers: { ...HTML_HEADERS, "x-luxel-cache": "hit" },
        });
      }
      const html = await pool.run();
      cache.set(path, { body: html, at: now });
      return new Response(html, {
        headers: { ...HTML_HEADERS, "x-luxel-cache": "miss" },
      });
    },
    0,
    "127.0.0.1",
  );

  const close = server.close;
  return {
    url: server.url,
    close: async () => {
      await pool.close();
      await close();
    },
  };
}
