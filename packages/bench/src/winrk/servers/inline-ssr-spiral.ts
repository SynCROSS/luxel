import { createFetchServer, type BenchServer } from "../http-server.ts";

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" } as const;

type SsrModule = typeof import("@luxel/luxel/bench/ssr");

/** Lazy — parent import of framework SSR deps breaks Bun render workers in same process. */
function loadSsr(): Promise<SsrModule> {
  return import("@luxel/luxel/bench/ssr");
}

async function startSpiralSsrServer(render: () => Promise<string>): Promise<BenchServer> {
  await render();
  return createFetchServer(async () => {
    const html = await render();
    return new Response(html, { headers: HTML_HEADERS });
  });
}

export async function startReactSpiralSsrServer(): Promise<BenchServer> {
  const { renderReactSpiralDocument } = await loadSsr();
  return startSpiralSsrServer(renderReactSpiralDocument);
}

export async function startVueSpiralSsrServer(): Promise<BenchServer> {
  const { renderVueVdomSpiralDocument } = await loadSsr();
  return startSpiralSsrServer(renderVueVdomSpiralDocument);
}

export async function startVueVaporSpiralSsrServer(): Promise<BenchServer | null> {
  try {
    const { renderVueVaporSpiralDocument } = await loadSsr();
    return startSpiralSsrServer(async () => {
      const html = await renderVueVaporSpiralDocument();
      if (!html) throw new Error("vue-vapor spiral render unavailable");
      return html;
    });
  } catch {
    return null;
  }
}

export async function startSolidSpiralSsrServer(): Promise<BenchServer> {
  const { renderSolidSpiralDocument } = await loadSsr();
  return startSpiralSsrServer(renderSolidSpiralDocument);
}

export async function startSvelteSpiralSsrServer(): Promise<BenchServer> {
  const { renderSvelteSpiralDocument } = await loadSsr();
  return startSpiralSsrServer(renderSvelteSpiralDocument);
}
