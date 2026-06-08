import { runCounterBench } from "./counter.ts";
import { runIsrBench } from "./isr.ts";
import { runSpiralBench } from "./spiral.ts";
import { runStaticHttpBaseline, runStaticHttpSpiralBaseline } from "./static-baseline.ts";
import {
  runFastifyHtmlCounterBench,
  runFastifyHtmlSpiralBench,
  runFastifyStaticCounterBench,
  runFastifyStaticSpiralBench,
  runReactCounterBench,
  runReactSpiralBench,
  runSolidCounterBench,
  runSolidSpiralBench,
  runSvelteCounterBench,
  runSvelteKitIsrBench,
  runSvelteSpiralBench,
  runVueVdomCounterBench,
  runVueVdomSpiralBench,
  runVueVaporCounterBench,
  runVueVaporSpiralBench,
} from "./competitors/runners.ts";
import { createTestServerForApp } from "../test/server.ts";
import { BENCH_ITERATIONS, runFetchThroughputBench } from "./competitors/throughput-harness.ts";

export type BenchJsonLine =
  | {
      fixture: string;
      metric: string;
      value: number;
      framework?: string;
      interaction?: string;
      mode?: string;
    }
  | { fixture: string; metric: string; status: "pending"; framework?: string; reason?: string };

export type BenchRegistryOptions = {
  /** Skip Playwright INP (faster unit tests). */
  skipInp?: boolean;
  /** Skip Platformatic spiral tier-2 rows (slow; use dedicated spiral test). */
  skipSpiral?: boolean;
};

async function yieldCompetitor(
  fixture: string,
  framework: string,
  result: { throughputRps: number; htmlBytes: number } | null,
): Promise<BenchJsonLine[]> {
  if (result) {
    return [
      { fixture, framework, metric: "ssr_throughput_rps", value: result.throughputRps },
      { fixture, framework, metric: "ssr_html_bytes", value: result.htmlBytes },
    ];
  }
  return [{ fixture, framework, metric: "runner", status: "pending" }];
}

async function yieldIsrCompetitor(
  fixture: string,
  framework: string,
  result: { throughputRps: number; htmlBytes: number } | null,
): Promise<BenchJsonLine[]> {
  if (result) {
    return [
      { fixture, framework, metric: "isr_throughput_rps", value: result.throughputRps },
      { fixture, framework, metric: "isr_html_bytes", value: result.htmlBytes },
    ];
  }
  return [{ fixture, framework, metric: "runner", status: "pending" }];
}

export async function* runBenchRegistry(
  options: BenchRegistryOptions = {},
): AsyncGenerator<BenchJsonLine> {
  const skipInp =
    options.skipInp === true ||
    process.env.LUXEL_BENCH_SKIP_INP === "1" ||
    process.env.LUXEL_BENCH_SKIP_INP === "true";
  const skipSpiral =
    options.skipSpiral === true ||
    process.env.LUXEL_BENCH_SKIP_SPIRAL === "1" ||
    process.env.LUXEL_BENCH_SKIP_SPIRAL === "true";

  const { throughputRps, clientBytes, htmlBytes } = await runCounterBench();
  yield { fixture: "counter", framework: "luxel", metric: "ssr_throughput_rps", value: throughputRps };
  yield { fixture: "counter", framework: "luxel", metric: "ssr_html_bytes", value: htmlBytes };
  yield { fixture: "counter", framework: "luxel", metric: "client_js_bytes", value: clientBytes };

  const baseline = await runStaticHttpBaseline();
  yield {
    fixture: "counter",
    framework: "static-http",
    metric: "ssr_throughput_rps",
    value: baseline.throughputRps,
  };
  yield {
    fixture: "counter",
    framework: "static-http",
    metric: "ssr_html_bytes",
    value: baseline.htmlBytes,
  };

  for (const line of await yieldCompetitor("counter", "fastify-html", await runFastifyHtmlCounterBench())) {
    yield line;
  }

  const fastifyStatic = await runFastifyStaticCounterBench();
  yield {
    fixture: "counter",
    framework: "fastify-static",
    metric: "ssr_throughput_rps",
    value: fastifyStatic.throughputRps,
  };
  yield {
    fixture: "counter",
    framework: "fastify-static",
    metric: "ssr_html_bytes",
    value: fastifyStatic.htmlBytes,
  };

  for (const line of await yieldCompetitor("counter", "react", await runReactCounterBench())) {
    yield line;
  }

  for (const line of await yieldCompetitor("counter", "vue-vdom", await runVueVdomCounterBench())) {
    yield line;
  }

  for (const line of await yieldCompetitor("counter", "vue-vapor", await runVueVaporCounterBench())) {
    yield line;
  }

  for (const line of await yieldCompetitor("counter", "solid", await runSolidCounterBench())) {
    yield line;
  }

  for (const line of await yieldCompetitor("counter", "svelte", await runSvelteCounterBench())) {
    yield line;
  }

  const isr = await runIsrBench();
  yield { fixture: "nav-demo", framework: "luxel", metric: "isr_throughput_rps", value: isr.throughputRps };
  yield { fixture: "nav-demo", framework: "luxel", metric: "isr_html_bytes", value: isr.htmlBytes };
  for (const line of await yieldIsrCompetitor("nav-demo", "svelte", await runSvelteKitIsrBench())) {
    yield line;
  }

  if (skipSpiral) {
    yield {
      fixture: "spiral",
      framework: "luxel",
      metric: "ssr_throughput_rps",
      status: "pending",
      reason: "LUXEL_BENCH_SKIP_SPIRAL=1",
    };
  } else {
    const spiral = await runSpiralBench();
    yield { fixture: "spiral", framework: "luxel", metric: "ssr_throughput_rps", value: spiral.throughputRps };
    yield {
      fixture: "spiral",
      framework: "luxel",
      metric: "render_worker_throughput_rps",
      value: spiral.renderWorkerRps,
    };
    yield { fixture: "spiral", framework: "luxel", metric: "ssr_html_bytes", value: spiral.htmlBytes };
    yield { fixture: "spiral", framework: "luxel", metric: "spiral_tile_count", value: spiral.tileCount };

    const spiralStatic = await runStaticHttpSpiralBaseline();
    yield {
      fixture: "spiral",
      framework: "static-http",
      metric: "ssr_throughput_rps",
      value: spiralStatic.throughputRps,
    };
    yield {
      fixture: "spiral",
      framework: "static-http",
      metric: "ssr_html_bytes",
      value: spiralStatic.htmlBytes,
    };

    for (const line of await yieldCompetitor("spiral", "fastify-html", await runFastifyHtmlSpiralBench())) {
      yield line;
    }

    const fastifyStaticSpiral = await runFastifyStaticSpiralBench();
    yield {
      fixture: "spiral",
      framework: "fastify-static",
      metric: "ssr_throughput_rps",
      value: fastifyStaticSpiral.throughputRps,
    };
    yield {
      fixture: "spiral",
      framework: "fastify-static",
      metric: "ssr_html_bytes",
      value: fastifyStaticSpiral.htmlBytes,
    };
    for (const line of await yieldCompetitor("spiral", "react", await runReactSpiralBench())) {
      yield line;
    }
    for (const line of await yieldCompetitor("spiral", "vue-vdom", await runVueVdomSpiralBench())) {
      yield line;
    }
    for (const line of await yieldCompetitor("spiral", "vue-vapor", await runVueVaporSpiralBench())) {
      yield line;
    }
    for (const line of await yieldCompetitor("spiral", "solid", await runSolidSpiralBench())) {
      yield line;
    }
    for (const line of await yieldCompetitor("spiral", "svelte", await runSvelteSpiralBench())) {
      yield line;
    }
  }

  if (!skipInp) {
    try {
      const { runLuxelInpBench } = await import("./inp.ts");
      for (const row of await runLuxelInpBench()) {
        yield {
          fixture: row.fixture,
          framework: "luxel",
          metric: "inp_ms",
          value: row.inpMs,
          interaction: row.interaction,
        };
      }
      yield {
        fixture: "counter",
        framework: "react",
        metric: "inp_ms",
        status: "pending",
        reason: "competitor INP harness not wired",
      };
    } catch (err) {
      yield {
        fixture: "counter",
        framework: "luxel",
        metric: "inp_ms",
        status: "pending",
        reason: err instanceof Error ? err.message : "inp runner failed",
      };
    }
  }

  const docsServer = await createTestServerForApp("examples/docs-site");
  const { throughputRps: docsRps } = await runFetchThroughputBench(docsServer.url, 200);
  docsServer.close();
  yield {
    fixture: "docs-site",
    framework: "luxel",
    metric: "ssr_throughput_rps",
    value: docsRps,
  };

  yield { fixture: "list", metric: "fixture", status: "pending" };
  yield { fixture: "table", metric: "fixture", status: "pending" };
}
