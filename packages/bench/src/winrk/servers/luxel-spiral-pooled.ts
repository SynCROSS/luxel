import { htmlBodyHeaders, readLuxelSpiralPoolPooledBody } from "@luxel/luxel/bench";
import { createFetchServer, type BenchServer } from "../http-server.ts";

export async function startLuxelSpiralSsrWorkerPoolServer(): Promise<BenchServer> {
  const pooledBody = await readLuxelSpiralPoolPooledBody({ ssrBackend: "native" });
  const headers = htmlBodyHeaders(pooledBody);
  return createFetchServer(async () => new Response(pooledBody, { headers }), 0, "127.0.0.1");
}
