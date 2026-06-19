import { benchFetch } from "./bench-fetch.ts";

const DEFAULT_WARMUP_REQUESTS = Number(process.env.BENCH_WARMUP_REQUESTS ?? "250");

/** JIT + connection warmup before timed measurement. */
export async function warmupBenchUrl(
  url: string,
  requests = DEFAULT_WARMUP_REQUESTS,
): Promise<void> {
  const target = url.endsWith("/") ? url : `${url}/`;
  for (let i = 0; i < requests; i++) {
    const res = await benchFetch(target);
    if (!res.ok) throw new Error(`warmup failed: ${res.status} ${target}`);
    await res.text();
  }
}

/** Saturate concurrent connections before WinRK (external Luxel worker pools on Windows). */
export async function warmupBenchUrlBurst(
  url: string,
  concurrency = Number(process.env.BENCH_WARMUP_BURST_CONCURRENCY ?? "400"),
  rounds = Number(process.env.BENCH_WARMUP_BURST_ROUNDS ?? "2"),
): Promise<void> {
  const target = url.endsWith("/") ? url : `${url}/`;
  for (let round = 0; round < rounds; round++) {
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        const res = await benchFetch(target);
        if (!res.ok) throw new Error(`burst warmup failed: ${res.status} ${target}`);
        await res.text();
      }),
    );
  }
}

export async function warmIsrBenchUrl(url: string): Promise<void> {
  const base = url.endsWith("/") ? url : `${url}/`;
  const miss = await benchFetch(base);
  if (!miss.ok) throw new Error(`isr warm miss failed: ${miss.status}`);
  const hit = await benchFetch(base);
  if (!hit.ok) throw new Error(`isr warm hit failed: ${hit.status}`);
}
