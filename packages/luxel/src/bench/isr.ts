import { createIsrBenchServer } from "./fixture-server.ts";
import { BENCH_ITERATIONS, runFetchThroughputBench } from "./competitors/throughput-harness.ts";

export async function runIsrBench(): Promise<{
  throughputRps: number;
  htmlBytes: number;
  cacheHit: boolean;
}> {
  const server = await createIsrBenchServer();
  try {
    const url = server.url.endsWith("/") ? server.url : `${server.url}/`;
    const sample = await fetch(url);
    if (!sample.ok) throw new Error(`isr bench probe failed: ${sample.status}`);
    const html = await sample.text();
    const cacheHit = sample.headers.get("x-luxel-cache") === "hit";
    const htmlBytes = new TextEncoder().encode(html).byteLength;
    const { throughputRps } = await runFetchThroughputBench(url, BENCH_ITERATIONS);
    return { throughputRps, htmlBytes, cacheHit };
  } finally {
    await server.close();
  }
}
