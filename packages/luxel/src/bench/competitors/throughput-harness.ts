import { createListenFetchServer } from "../../test/http-server.ts";

export const BENCH_ITERATIONS = 500;

export async function runFetchThroughputBench(
  url: string,
  iterations = BENCH_ITERATIONS,
): Promise<{ throughputRps: number }> {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`bench request failed: ${res.status}`);
    await res.text();
  }
  return { throughputRps: (iterations / (performance.now() - start)) * 1000 };
}

export async function runPerRequestSsrBench(
  renderHtml: () => string | Promise<string>,
  iterations = BENCH_ITERATIONS,
): Promise<{ throughputRps: number; htmlBytes: number }> {
  const sample = await renderHtml();
  const htmlBytes = new TextEncoder().encode(sample).byteLength;
  const server = await createListenFetchServer(async () => {
    const html = await renderHtml();
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  });
  try {
    const { throughputRps } = await runFetchThroughputBench(server.url, iterations);
    return { throughputRps, htmlBytes };
  } finally {
    await server.close();
  }
}
