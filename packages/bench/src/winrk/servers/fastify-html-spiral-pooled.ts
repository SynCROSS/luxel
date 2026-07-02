import Fastify from "fastify";
import { createFastifyHtmlSpiralRenderPool } from "@luxel/luxel/bench";
import type { BenchServer } from "../http-server.ts";

const FASTIFY_BENCH_OPTS = {
  logger: false,
  disableRequestLogging: true,
  requestIdHeader: false,
  connectionTimeout: 0,
  keepAliveTimeout: 72_000,
  requestTimeout: 0,
} as const;

export async function startFastifyHtmlSpiralWorkerPoolServer(): Promise<BenchServer> {
  const pool = createFastifyHtmlSpiralRenderPool();
  await pool.warmup();
  const app = Fastify(FASTIFY_BENCH_OPTS);
  app.get("/", async (_req, reply) => {
    const html = await pool.run();
    return reply.type("text/html; charset=utf-8").send(html);
  });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address();
  if (!addr || typeof addr === "string") throw new Error("fastify bind failed");
  const url = `http://127.0.0.1:${addr.port}`;
  return {
    url,
    port: addr.port,
    close: async () => {
      await pool.close();
      await app.close();
    },
  };
}
