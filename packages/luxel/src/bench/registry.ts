import { runCounterBench } from "./counter.ts";
import { runStaticHttpBaseline } from "./static-baseline.ts";
import {
  runFastifyHtmlCounterBench,
  runFastifyStaticCounterBench,
  runReactCounterBench,
  runSolidCounterBench,
  runSvelteCounterBench,
  runVueVdomCounterBench,
  runVueVaporCounterBench,
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
};

async function yieldCompetitor(
  framework: string,
  result: { throughputRps: number; htmlBytes: number } | null,
): Promise<BenchJsonLine[]> {
  if (result) {
    return [
      { fixture: "counter", framework, metric: "ssr_throughput_rps", value: result.throughputRps },
      { fixture: "counter", framework, metric: "ssr_html_bytes", value: result.htmlBytes },
    ];
  }
  return [{ fixture: "counter", framework, metric: "runner", status: "pending" }];
}

export async function* runBenchRegistry(
  options: BenchRegistryOptions = {},
): AsyncGenerator<BenchJsonLine> {
  const skipInp =
    options.skipInp === true ||
    process.env.LUXEL_BENCH_SKIP_INP === "1" ||
    process.env.LUXEL_BENCH_SKIP_INP === "true";

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

  for (const line of await yieldCompetitor("fastify-html", await runFastifyHtmlCounterBench())) {
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

  for (const line of await yieldCompetitor("react", await runReactCounterBench())) {
    yield line;
  }

  for (const line of await yieldCompetitor("vue-vdom", await runVueVdomCounterBench())) {
    yield line;
  }

  yield {
    fixture: "counter",
    framework: "vue-vapor",
    metric: "runner",
    status: "pending",
    reason: "needs Vue 3.6+ vapor SFC compile pipeline in bench harness",
  };

  for (const line of await yieldCompetitor("solid", await runSolidCounterBench())) {
    yield line;
  }

  for (const line of await yieldCompetitor("svelte", await runSvelteCounterBench())) {
    yield line;
  }

  yield {
    fixture: "spiral",
    framework: "luxel",
    metric: "ssr_throughput_rps",
    status: "pending",
    reason: "Platformatic spiral workload — see docs/benchmarks/ssr-showdown.md",
  };

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
