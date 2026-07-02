import { createSpiralInlineRenderPool } from "@luxel/luxel/bench";
import { createFetchServer, type BenchServer } from "../http-server.ts";
import type { SpiralInlineFramework } from "@luxel/luxel/bench";

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" } as const;

async function startPooledSpiralSsrServer(framework: SpiralInlineFramework): Promise<BenchServer> {
  const pool = await createSpiralInlineRenderPool(framework);
  await pool.warmup();
  const server = await createFetchServer(async () => {
    const html = await pool.run();
    return new Response(html, { headers: HTML_HEADERS });
  });
  const close = server.close;
  return {
    url: server.url,
    close: async () => {
      await pool.close();
      await close();
    },
  };
}

export async function startReactSpiralSsrWorkerPoolServer(): Promise<BenchServer> {
  return startPooledSpiralSsrServer("react");
}

export async function startVueSpiralSsrWorkerPoolServer(): Promise<BenchServer | null> {
  try {
    return await startPooledSpiralSsrServer("vue-vdom");
  } catch {
    return null;
  }
}

export async function startVueVaporSpiralSsrWorkerPoolServer(): Promise<BenchServer | null> {
  try {
    return await startPooledSpiralSsrServer("vue-vapor");
  } catch {
    return null;
  }
}

export async function startSolidSpiralSsrWorkerPoolServer(): Promise<BenchServer> {
  return startPooledSpiralSsrServer("solid");
}

export async function startSvelteSpiralSsrWorkerPoolServer(): Promise<BenchServer> {
  return startPooledSpiralSsrServer("svelte");
}
