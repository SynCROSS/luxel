import { createLuxelCounterRenderPool } from "@luxel/luxel/bench";
import { createFetchServer, type BenchServer } from "../http-server.ts";

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" } as const;

async function startLuxelCounterPooledServer(benchFullRender = false): Promise<BenchServer> {
  const pool = await createLuxelCounterRenderPool({ benchFullRender });
  await pool.warmup();
  const server = await createFetchServer(
    async () => {
      const html = await pool.run();
      return new Response(html, { headers: HTML_HEADERS });
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

export async function startLuxelSsrWorkerPoolServer(): Promise<BenchServer> {
  return startLuxelCounterPooledServer(false);
}

export async function startLuxelSsrFullWorkerPoolServer(): Promise<BenchServer> {
  return startLuxelCounterPooledServer(true);
}
