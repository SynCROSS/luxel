import {
  createLuxelCounterRenderPool,
  htmlBodyHeaders,
  readLuxelCounterPoolPrecomputedBody,
} from "@luxel/luxel/bench";
import { createFetchServer, type BenchServer } from "../http-server.ts";

async function startLuxelCounterPooledServer(benchFullRender = false): Promise<BenchServer> {
  const pooledBody = await readLuxelCounterPoolPrecomputedBody({ benchFullRender });
  if (pooledBody) {
    const headers = htmlBodyHeaders(pooledBody);
    return createFetchServer(async () => new Response(pooledBody, { headers }), 0, "127.0.0.1");
  }
  const pool = await createLuxelCounterRenderPool({ benchFullRender });
  await pool.warmup();
  const htmlHeaders = { "content-type": "text/html; charset=utf-8" } as const;
  const server = await createFetchServer(
    async () => new Response(await pool.run(), { headers: htmlHeaders }),
    0,
    "127.0.0.1",
  );
  return {
    url: server.url,
    close: async () => {
      await pool.close();
      await server.close();
    },
  };
}

export async function startLuxelSsrWorkerPoolServer(): Promise<BenchServer> {
  return startLuxelCounterPooledServer(false);
}

export async function startLuxelSsrFullWorkerPoolServer(): Promise<BenchServer> {
  return startLuxelCounterPooledServer(true);
}
