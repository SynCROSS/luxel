import Fastify from "fastify";
import fastifyHtml from "fastify-html";
import {
  counterDocumentFromBody,
  COUNTER_COUNTER_MARKUP,
  COUNTER_INTERACTIVE_SCRIPT,
  COUNTER_MINIMAL_BODY,
} from "../fixtures/counter-contract.ts";
import { spiralBodyMarkup } from "../fixtures/spiral-html.ts";
import { spiralDocumentFromBody, spiralMinimalDocument } from "../fixtures/spiral-contract.ts";
type SsrRender = typeof import("./ssr-render.ts");

async function loadSsrRender(): Promise<SsrRender> {
  return import("./ssr-render.ts");
}
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getLuxelRepoRoot } from "../../paths.ts";
import { BENCH_ITERATIONS, runFetchThroughputBench, runPerRequestSsrBench } from "./throughput-harness.ts";
import { warmIsrBenchUrl } from "./warmup.ts";

export type CounterBenchResult = { throughputRps: number; htmlBytes: number };
export type SpiralBenchResult = CounterBenchResult;

export type FastifyBenchServer = {
  url: string;
  port: number;
  close: () => Promise<void>;
};

const FASTIFY_BENCH_OPTS = {
  logger: false,
  disableRequestLogging: true,
  requestIdHeader: false,
  connectionTimeout: 0,
  keepAliveTimeout: 72_000,
  requestTimeout: 0,
} as const;

async function listenFastify(app: ReturnType<typeof Fastify>): Promise<FastifyBenchServer> {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address();
  if (!addr || typeof addr === "string") throw new Error("fastify bind failed");
  const port = addr.port;
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    close: () => app.close(),
  };
}

/** WinRK / long-run harness ??Fastify + fastify-html counter row. */
export async function createFastifyHtmlCounterServer(): Promise<FastifyBenchServer> {
  const app = Fastify(FASTIFY_BENCH_OPTS);
  await app.register(fastifyHtml);
  app.addLayout(function (inner) {
    return app.html`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Luxel</title></head><body><main>!${inner}</main>${COUNTER_INTERACTIVE_SCRIPT}</body></html>`;
  });
  app.get("/", async (_req, reply) => {
    return reply.html`!${COUNTER_COUNTER_MARKUP}`;
  });
  await app.ready();
  return listenFastify(app);
}

/** WinRK / long-run harness ??Fastify + fastify-html spiral row. */
export async function createFastifyHtmlSpiralServer(): Promise<FastifyBenchServer> {
  const app = Fastify(FASTIFY_BENCH_OPTS);
  await app.register(fastifyHtml);
  app.addLayout(function (inner) {
    return app.html`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Luxel spiral</title><style>
#wrapper{position:relative;width:960px;height:720px}
.tile{position:absolute;width:10px;height:10px;background:#333}
</style></head><body><main>!${inner}</main></body></html>`;
  });
  app.get("/", async (_req, reply) => {
    return reply.html`!${spiralBodyMarkup()}`;
  });
  await app.ready();
  return listenFastify(app);
}

/** fastify-html per-request templating (Platformatic SSR showdown baseline class). */
export async function runFastifyHtmlCounterBench(): Promise<CounterBenchResult | null> {
  try {
    const server = await createFastifyHtmlCounterServer();
    try {
      const sample = await fetch(server.url);
      if (!sample.ok) return null;
      const htmlBytes = new TextEncoder().encode(await sample.text()).byteLength;
      const { throughputRps } = await runFetchThroughputBench(server.url, BENCH_ITERATIONS);
      return { throughputRps, htmlBytes };
    } finally {
      await server.close();
    }
  } catch {
    return null;
  }
}

export async function runReactCounterBench(): Promise<CounterBenchResult> {
  const { renderReactCounterDocument } = await loadSsrRender();
  return runPerRequestSsrBench(() => renderReactCounterDocument());
}

export async function runVueVdomCounterBench(): Promise<CounterBenchResult> {
  const { renderVueVdomCounterDocument } = await loadSsrRender();
  return runPerRequestSsrBench(() => renderVueVdomCounterDocument());
}

export async function runVueVaporCounterBench(): Promise<CounterBenchResult | null> {
  try {
    const { renderVueVaporCounterDocument } = await loadSsrRender();
    return runPerRequestSsrBench(async () => {
      const html = await renderVueVaporCounterDocument();
      if (!html) throw new Error("vue-vapor unavailable");
      return html;
    });
  } catch {
    return null;
  }
}

export async function runSolidCounterBench(): Promise<CounterBenchResult | null> {
  try {
    const { renderSolidCounterDocument } = await loadSsrRender();
    return runPerRequestSsrBench(() => renderSolidCounterDocument());
  } catch {
    return null;
  }
}

export async function runSvelteCounterBench(): Promise<CounterBenchResult | null> {
  try {
    const { renderSvelteCounterDocument } = await loadSsrRender();
    return runPerRequestSsrBench(() => renderSvelteCounterDocument());
  } catch {
    return null;
  }
}

export async function runFastifyHtmlSpiralBench(): Promise<SpiralBenchResult | null> {
  try {
    const server = await createFastifyHtmlSpiralServer();
    try {
      const sample = await fetch(server.url);
      if (!sample.ok) return null;
      const htmlBytes = new TextEncoder().encode(await sample.text()).byteLength;
      const { throughputRps } = await runFetchThroughputBench(server.url, BENCH_ITERATIONS);
      return { throughputRps, htmlBytes };
    } finally {
      await server.close();
    }
  } catch {
    return null;
  }
}

export async function runReactSpiralBench(): Promise<SpiralBenchResult> {
  const { renderReactSpiralDocument } = await loadSsrRender();
  return runPerRequestSsrBench(() => renderReactSpiralDocument());
}

export async function runVueVdomSpiralBench(): Promise<SpiralBenchResult> {
  const { renderVueVdomSpiralDocument } = await loadSsrRender();
  return runPerRequestSsrBench(() => renderVueVdomSpiralDocument());
}

export async function runVueVaporSpiralBench(): Promise<SpiralBenchResult | null> {
  try {
    const { renderVueVaporSpiralDocument } = await loadSsrRender();
    return runPerRequestSsrBench(async () => {
      const html = await renderVueVaporSpiralDocument();
      if (!html) throw new Error("vue-vapor unavailable");
      return html;
    });
  } catch {
    return null;
  }
}

export async function runSolidSpiralBench(): Promise<SpiralBenchResult | null> {
  try {
    const { renderSolidSpiralDocument } = await loadSsrRender();
    return runPerRequestSsrBench(() => renderSolidSpiralDocument());
  } catch {
    return null;
  }
}

export async function runSvelteSpiralBench(): Promise<SpiralBenchResult | null> {
  try {
    const { renderSvelteSpiralDocument } = await loadSsrRender();
    return runPerRequestSsrBench(() => renderSvelteSpiralDocument());
  } catch {
    return null;
  }
}

function benchCompetitorServerEntry(app: string): string {
  return join(getLuxelRepoRoot(), "packages/bench/competitors", app, ".bench-server.mjs");
}

export async function runSvelteKitIsrBench(): Promise<CounterBenchResult | null> {
  const entry = benchCompetitorServerEntry("sveltekit-isr");
  if (!existsSync(entry)) return null;
  if (!existsSync(join(getLuxelRepoRoot(), "packages/bench/competitors/sveltekit-isr/build/handler.js"))) {
    return null;
  }
  try {
    const mod = (await import(pathToFileURL(entry).href)) as {
      startBenchServer: () => Promise<{ url: string; close: () => Promise<void> }>;
    };
    const server = await mod.startBenchServer();
    try {
      await warmIsrBenchUrl(server.url);
      const sample = await fetch(server.url.endsWith("/") ? server.url : `${server.url}/`);
      if (!sample.ok) return null;
      const htmlBytes = new TextEncoder().encode(await sample.text()).byteLength;
      const url = server.url.endsWith("/") ? server.url : `${server.url}/`;
      const { throughputRps } = await runFetchThroughputBench(url, BENCH_ITERATIONS);
      return { throughputRps, htmlBytes };
    } finally {
      await server.close();
    }
  } catch {
    return null;
  }
}

/** WinRK / luxel bench ??Fastify sends prebuilt HTML (static ceiling). */
export async function createFastifyStaticCounterServer(): Promise<FastifyBenchServer> {
  const html = counterDocumentFromBody(COUNTER_MINIMAL_BODY);
  const app = Fastify(FASTIFY_BENCH_OPTS);
  app.get("/", async (_req, reply) => {
    reply.type("text/html").send(html);
  });
  await app.ready();
  return listenFastify(app);
}

/** WinRK / luxel bench ??Fastify sends prebuilt spiral HTML (static ceiling). */
export async function createFastifyStaticSpiralServer(): Promise<FastifyBenchServer> {
  const html = spiralMinimalDocument();
  const app = Fastify(FASTIFY_BENCH_OPTS);
  app.get("/", async (_req, reply) => {
    reply.type("text/html").send(html);
  });
  await app.ready();
  return listenFastify(app);
}

export async function runFastifyStaticSpiralBench(): Promise<SpiralBenchResult> {
  const server = await createFastifyStaticSpiralServer();
  try {
    const sample = await fetch(server.url);
    const htmlBytes = new TextEncoder().encode(await sample.text()).byteLength;
    const { throughputRps } = await runFetchThroughputBench(server.url, BENCH_ITERATIONS);
    return { throughputRps, htmlBytes };
  } finally {
    await server.close();
  }
}

/** luxel bench ??handler returns prebuilt string (fetch-loop harness; WinRK uses createFastifyStatic*). */
export async function runFastifyStaticCounterBench(): Promise<CounterBenchResult> {
  const server = await createFastifyStaticCounterServer();
  try {
    const sample = await fetch(server.url);
    const htmlBytes = new TextEncoder().encode(await sample.text()).byteLength;
    const { throughputRps } = await runFetchThroughputBench(server.url, BENCH_ITERATIONS);
    return { throughputRps, htmlBytes };
  } finally {
    await server.close();
  }
}
