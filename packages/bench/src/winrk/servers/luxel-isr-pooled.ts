import { createLuxelNavDemoRenderPool, encodeHtmlBody, htmlBodyHeaders } from "@luxel/luxel/bench";
import { createFetchServer, type BenchServer } from "../http-server.ts";

const ISR_TTL_MS = 1000;

export async function startLuxelIsrWorkerPoolServer(): Promise<BenchServer> {
  const pool = await createLuxelNavDemoRenderPool();
  const cache = new Map<string, { body: Uint8Array; at: number }>();
  await pool.warmup();

  const server = await createFetchServer(
    async (req) => {
      const path = new URL(req.url).pathname;
      const now = Date.now();
      const hit = cache.get(path);
      if (hit && now - hit.at < ISR_TTL_MS) {
        return new Response(hit.body, {
          headers: { ...htmlBodyHeaders(hit.body), "x-luxel-cache": "hit" },
        });
      }
      const html = await pool.run();
      const body = encodeHtmlBody(html);
      cache.set(path, { body, at: now });
      return new Response(body, {
        headers: { ...htmlBodyHeaders(body), "x-luxel-cache": "miss" },
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
