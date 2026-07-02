import { createFetchServer, type BenchServer } from "../http-server.ts";

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" } as const;

type SsrModule = typeof import("@luxel/luxel/bench/ssr");

/** Lazy — parent import of react-dom/server breaks Bun render workers in same process. */
function loadSsr(): Promise<SsrModule> {
  return import("@luxel/luxel/bench/ssr");
}

async function startSsrServer(render: () => Promise<string>): Promise<BenchServer> {
  await render();
  return createFetchServer(async () => {
    const html = await render();
    return new Response(html, { headers: HTML_HEADERS });
  });
}

export async function startReactSsrServer(): Promise<BenchServer> {
  const { renderReactCounterDocument } = await loadSsr();
  return startSsrServer(renderReactCounterDocument);
}

export async function startVueSsrServer(): Promise<BenchServer> {
  const { renderVueVdomCounterDocument } = await loadSsr();
  return startSsrServer(renderVueVdomCounterDocument);
}

export async function startSolidSsrServer(): Promise<BenchServer> {
  const { renderSolidCounterDocument } = await loadSsr();
  return startSsrServer(renderSolidCounterDocument);
}

export async function startSvelteSsrServer(): Promise<BenchServer> {
  const { renderSvelteCounterDocument } = await loadSsr();
  return startSsrServer(renderSvelteCounterDocument);
}

export async function startVueVaporSsrServer(): Promise<BenchServer | null> {
  try {
    const { renderVueVaporCounterDocument } = await loadSsr();
    return startSsrServer(async () => {
      const html = await renderVueVaporCounterDocument();
      if (!html) throw new Error("vue-vapor render unavailable");
      return html;
    });
  } catch {
    return null;
  }
}
