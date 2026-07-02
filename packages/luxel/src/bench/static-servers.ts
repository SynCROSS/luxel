import { counterDocumentFromBody, COUNTER_MINIMAL_BODY } from "./fixtures/counter-contract.ts";
import { spiralMinimalDocument } from "./fixtures/spiral-contract.ts";
import { createListenFetchServer } from "../test/http-server.ts";

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" } as const;

export type StaticBenchServer = {
  url: string;
  port: number;
  close: () => Promise<void>;
};

/** WinRK ceiling — precomputed HTML, Bun.serve returns fixed body (no render work). */
async function createFixedHtmlServer(html: string): Promise<StaticBenchServer> {
  const server = await createListenFetchServer(
    async () => new Response(html, { headers: HTML_HEADERS }),
    { port: 0, hostname: "127.0.0.1" },
  );
  return server;
}

export async function createStaticHttpCounterServer(): Promise<StaticBenchServer> {
  return createFixedHtmlServer(counterDocumentFromBody(COUNTER_MINIMAL_BODY));
}

export async function createStaticHttpSpiralServer(): Promise<StaticBenchServer> {
  return createFixedHtmlServer(spiralMinimalDocument());
}
