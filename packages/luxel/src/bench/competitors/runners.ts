import Fastify from "fastify";
import fastifyHtml from "fastify-html";
import {
  counterDocumentFromBody,
  COUNTER_COUNTER_MARKUP,
  COUNTER_MINIMAL_BODY,
} from "../fixtures/counter-contract.ts";
import { BENCH_ITERATIONS, runFetchThroughputBench, runPerRequestSsrBench } from "./throughput-harness.ts";

export type CounterBenchResult = { throughputRps: number; htmlBytes: number };

/** fastify-html per-request templating (Platformatic SSR showdown baseline class). */
export async function runFastifyHtmlCounterBench(): Promise<CounterBenchResult | null> {
  try {
    const app = Fastify({ logger: false });
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
  const { createElement } = await import("react");
  const { renderToString } = await import("react-dom/server");
  return runPerRequestSsrBench(() => {
    const body = renderToString(
      createElement("div", null, [
        createElement("h1", { key: "h" }, "Hello Luxel"),
        createElement(
          "section",
          { key: "s" },
          createElement("button", { type: "button", "data-luxel-text": "count", key: "b" }, "0"),
        ),
      ]),
    );
    return counterDocumentFromBody(body);
  });
}

export async function runVueVdomCounterBench(): Promise<CounterBenchResult> {
  const { createSSRApp } = await import("vue");
  const { renderToString } = await import("vue/server-renderer");
  return runPerRequestSsrBench(async () => {
    const app = createSSRApp({
      template: COUNTER_COUNTER_MARKUP,
    });
    const body = await renderToString(app);
    return counterDocumentFromBody(body);
  });
}

export async function runVueVaporCounterBench(): Promise<CounterBenchResult | null> {
  return null;
}

export async function runSolidCounterBench(): Promise<CounterBenchResult | null> {
  try {
    const { renderToString } = await import("solid-js/web");
    return runPerRequestSsrBench(() => {
      const { html } = renderToString(() => COUNTER_COUNTER_MARKUP);
      return counterDocumentFromBody(html);
    });
  } catch {
    return null;
  }
}

export async function runSvelteCounterBench(): Promise<CounterBenchResult | null> {
  try {
    const { render } = await import("svelte/server");
    const mod = await import("./svelte-counter.svelte");
    const component = mod.default;
    if (typeof component !== "function") return null;
    const probe = render({ component });
    void probe;
    return runPerRequestSsrBench(() => {
      const { html } = render({ component });
      return counterDocumentFromBody(html.body);
    });
  } catch {
    return null;
  }
}

/** @deprecated static string only — use fastify-html for framework-class baseline */
export async function runFastifyStaticCounterBench(): Promise<CounterBenchResult> {
  const html = counterDocumentFromBody(COUNTER_MINIMAL_BODY);
  const htmlBytes = new TextEncoder().encode(html).byteLength;
  const app = Fastify({ logger: false });
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
