import {
  createCounterInlineRenderPool,
  type CounterInlineFramework,
} from "../../../../luxel/src/bench/competitors/counter-inline-render-pool.ts";
import { createFetchServer, type BenchServer } from "../http-server.ts";

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" } as const;

async function startPooledCounterSsrServer(framework: CounterInlineFramework): Promise<BenchServer> {
  const pool = await createCounterInlineRenderPool(framework);
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

export async function startReactSsrWorkerPoolServer(): Promise<BenchServer> {
  return startPooledCounterSsrServer("react");
}

export async function startVueSsrWorkerPoolServer(): Promise<BenchServer> {
  return startPooledCounterSsrServer("vue-vdom");
}

export async function startVueVaporSsrWorkerPoolServer(): Promise<BenchServer> {
  return startPooledCounterSsrServer("vue-vapor");
}

export async function startSolidSsrWorkerPoolServer(): Promise<BenchServer> {
  return startPooledCounterSsrServer("solid");
}

export async function startSvelteSsrWorkerPoolServer(): Promise<BenchServer> {
  return startPooledCounterSsrServer("svelte");
}
