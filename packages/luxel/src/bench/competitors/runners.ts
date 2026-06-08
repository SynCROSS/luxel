import Fastify from "fastify";
import fastifyHtml from "fastify-html";
import {
  counterDocumentFromBody,
  COUNTER_COUNTER_MARKUP,
  COUNTER_MINIMAL_BODY,
} from "../fixtures/counter-contract.ts";
import { spiralBodyMarkup } from "../fixtures/spiral-html.ts";
import { spiralDocumentFromBody, spiralMinimalDocument } from "../fixtures/spiral-contract.ts";
import {
  renderReactCounterDocument,
  renderVueVdomCounterDocument,
  renderVueVaporCounterDocument,
  renderSolidCounterDocument,
  renderSvelteCounterDocument,
  renderReactSpiralDocument,
  renderVueVdomSpiralDocument,
  renderVueVaporSpiralDocument,
  renderSolidSpiralDocument,
  renderSvelteSpiralDocument,
} from "./ssr-render.ts";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getLuxelRepoRoot } from "../../paths.ts";
import { BENCH_ITERATIONS, runFetchThroughputBench, runPerRequestSsrBench } from "./throughput-harness.ts";

export type CounterBenchResult = { throughputRps: number; htmlBytes: number };
export type SpiralBenchResult = CounterBenchResult;

const FASTIFY_BENCH_OPTS = {
  logger: false,
  disableRequestLogging: true,
  requestIdHeader: false,
  connectionTimeout: 0,
  keepAliveTimeout: 72_000,
  requestTimeout: 0,
} as const;

/** fastify-html per-request templating (Platformatic SSR showdown baseline class). */
export async function runFastifyHtmlCounterBench(): Promise<CounterBenchResult | null> {
  try {
    const app = Fastify(FASTIFY_BENCH_OPTS);
    await app.register(fastifyHtml);
    app.addLayout(function (inner) {
      return app.html`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Luxel</title></head><body><main>!${inner}</main></body></html>`;
    });
    app.get("/", async (_req, reply) => {
      return reply.html`${COUNTER_COUNTER_MARKUP}`;
    });
    await app.ready();
    const sample = await app.inject({ method: "GET", url: "/" });
    if (sample.statusCode !== 200) return null;
    const htmlBytes = Buffer.byteLength(sample.body, "utf8");
    await app.listen({ port: 0, host: "127.0.0.1" });
    const addr = app.server.address();
    if (!addr || typeof addr === "string") throw new Error("fastify bind failed");
    const url = `http://127.0.0.1:${addr.port}`;
    try {
      const { throughputRps } = await runFetchThroughputBench(url, BENCH_ITERATIONS);
      return { throughputRps, htmlBytes };
    } finally {
      await app.close();
    }
  } catch {
    return null;
  }
}

export async function runReactCounterBench(): Promise<CounterBenchResult> {
  return runPerRequestSsrBench(() => renderReactCounterDocument());
}

export async function runVueVdomCounterBench(): Promise<CounterBenchResult> {
  return runPerRequestSsrBench(() => renderVueVdomCounterDocument());
}

export async function runVueVaporCounterBench(): Promise<CounterBenchResult | null> {
  try {
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
    return runPerRequestSsrBench(() => renderSolidCounterDocument());
  } catch {
    return null;
  }
}

export async function runSvelteCounterBench(): Promise<CounterBenchResult | null> {
  try {
    return runPerRequestSsrBench(() => renderSvelteCounterDocument());
  } catch {
    return null;
  }
}

export async function runFastifyHtmlSpiralBench(): Promise<SpiralBenchResult | null> {
  try {
    const app = Fastify(FASTIFY_BENCH_OPTS);
    await app.register(fastifyHtml);
    app.addLayout(function (inner) {
      return app.html`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Luxel spiral</title><style>
#wrapper{position:relative;width:960px;height:720px}
.tile{position:absolute;width:10px;height:10px;background:#333}
</style></head><body><main>!${inner}</main></body></html>`;
    });
    app.get("/", async (_req, reply) => {
      return reply.html`${spiralBodyMarkup()}`;
    });
    await app.ready();
    const sample = await app.inject({ method: "GET", url: "/" });
    if (sample.statusCode !== 200) return null;
    const htmlBytes = Buffer.byteLength(sample.body, "utf8");
    await app.listen({ port: 0, host: "127.0.0.1" });
    const addr = app.server.address();
    if (!addr || typeof addr === "string") throw new Error("fastify bind failed");
    const url = `http://127.0.0.1:${addr.port}`;
    try {
      const { throughputRps } = await runFetchThroughputBench(url, BENCH_ITERATIONS);
      return { throughputRps, htmlBytes };
    } finally {
      await app.close();
    }
  } catch {
    return null;
  }
}

export async function runReactSpiralBench(): Promise<SpiralBenchResult> {
  return runPerRequestSsrBench(() => renderReactSpiralDocument());
}

export async function runVueVdomSpiralBench(): Promise<SpiralBenchResult> {
  return runPerRequestSsrBench(() => renderVueVdomSpiralDocument());
}

export async function runVueVaporSpiralBench(): Promise<SpiralBenchResult | null> {
  try {
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
    return runPerRequestSsrBench(() => renderSolidSpiralDocument());
  } catch {
    return null;
  }
}

export async function runSvelteSpiralBench(): Promise<SpiralBenchResult | null> {
  try {
    return runPerRequestSsrBench(() => renderSvelteSpiralDocument());
  } catch {
    return null;
  }
}

function benchCompetitorServerEntry(app: string): string {
  return join(getLuxelRepoRoot(), "packages/bench/competitors", app, ".bench-server.mjs");
}

async function warmIsrUrl(url: string): Promise<void> {
  const base = url.endsWith("/") ? url : `${url}/`;
  const miss = await fetch(base);
  if (!miss.ok) throw new Error(`isr warm miss failed: ${miss.status}`);
  const hit = await fetch(base);
  if (!hit.ok) throw new Error(`isr warm hit failed: ${hit.status}`);
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
      await warmIsrUrl(server.url);
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

export async function runFastifyStaticSpiralBench(): Promise<SpiralBenchResult> {
  const html = spiralMinimalDocument();
  const htmlBytes = new TextEncoder().encode(html).byteLength;
  const app = Fastify(FASTIFY_BENCH_OPTS);
  app.get("/", async (_req, reply) => {
    reply.type("text/html").send(html);
  });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address();
  if (!addr || typeof addr === "string") throw new Error("fastify bind failed");
  const url = `http://127.0.0.1:${addr.port}`;
  try {
    const { throughputRps } = await runFetchThroughputBench(url, BENCH_ITERATIONS);
    return { throughputRps, htmlBytes };
  } finally {
    await app.close();
  }
}

/** @deprecated static string only — use fastify-html for framework-class baseline */
export async function runFastifyStaticCounterBench(): Promise<CounterBenchResult> {
  const html = counterDocumentFromBody(COUNTER_MINIMAL_BODY);
  const htmlBytes = new TextEncoder().encode(html).byteLength;
  const app = Fastify(FASTIFY_BENCH_OPTS);
  app.get("/", async (_req, reply) => {
    reply.type("text/html").send(html);
  });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address();
  if (!addr || typeof addr === "string") throw new Error("fastify bind failed");
  const url = `http://127.0.0.1:${addr.port}`;
  try {
    const { throughputRps } = await runFetchThroughputBench(url, BENCH_ITERATIONS);
    return { throughputRps, htmlBytes };
  } finally {
    await app.close();
  }
}
