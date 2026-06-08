import {
  renderReactCounterDocument,
  renderVueVdomCounterDocument,
  renderVueVaporCounterDocument,
  renderSolidCounterDocument,
  renderSvelteCounterDocument,
} from "@luxel/luxel/bench";
import { createFetchServer, type BenchServer } from "../http-server.ts";

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" } as const;

export async function startReactSsrServer(): Promise<BenchServer> {
  return createFetchServer(async () => {
    const html = await renderReactCounterDocument();
    return new Response(html, { headers: HTML_HEADERS });
  });
}

export async function startVueSsrServer(): Promise<BenchServer> {
  return createFetchServer(async () => {
    const html = await renderVueVdomCounterDocument();
    return new Response(html, { headers: HTML_HEADERS });
  });
}

export async function startSolidSsrServer(): Promise<BenchServer> {
  return createFetchServer(async () => {
    const html = await renderSolidCounterDocument();
    return new Response(html, { headers: HTML_HEADERS });
  });
}

export async function startSvelteSsrServer(): Promise<BenchServer> {
  return createFetchServer(async () => {
    const html = await renderSvelteCounterDocument();
    return new Response(html, { headers: HTML_HEADERS });
  });
}

export async function startVueVaporServer(): Promise<BenchServer | null> {
  try {
    return createFetchServer(async () => {
      const html = await renderVueVaporCounterDocument();
      if (!html) throw new Error("vue-vapor render unavailable");
      return new Response(html, { headers: HTML_HEADERS });
    });
  } catch {
    return null;
  }
}
