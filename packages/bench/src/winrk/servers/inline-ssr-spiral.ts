import {
  renderReactSpiralDocument,
  renderVueVdomSpiralDocument,
  renderVueVaporSpiralDocument,
  renderSolidSpiralDocument,
  renderSvelteSpiralDocument,
} from "@luxel/luxel/bench";
import { createFetchServer, type BenchServer } from "../http-server.ts";

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" } as const;

export async function startReactSpiralSsrServer(): Promise<BenchServer> {
  return createFetchServer(async () => {
    const html = await renderReactSpiralDocument();
    return new Response(html, { headers: HTML_HEADERS });
  });
}

export async function startVueSpiralSsrServer(): Promise<BenchServer> {
  return createFetchServer(async () => {
    const html = await renderVueVdomSpiralDocument();
    return new Response(html, { headers: HTML_HEADERS });
  });
}

export async function startVueVaporSpiralSsrServer(): Promise<BenchServer | null> {
  try {
    return createFetchServer(async () => {
      const html = await renderVueVaporSpiralDocument();
      if (!html) throw new Error("vue-vapor spiral render unavailable");
      return new Response(html, { headers: HTML_HEADERS });
    });
  } catch {
    return null;
  }
}

export async function startSolidSpiralSsrServer(): Promise<BenchServer> {
  return createFetchServer(async () => {
    const html = await renderSolidSpiralDocument();
    return new Response(html, { headers: HTML_HEADERS });
  });
}

export async function startSvelteSpiralSsrServer(): Promise<BenchServer> {
  return createFetchServer(async () => {
    const html = await renderSvelteSpiralDocument();
    return new Response(html, { headers: HTML_HEADERS });
  });
}
