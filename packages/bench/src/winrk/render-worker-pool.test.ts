import { describe, expect, test } from "bun:test";
import { startReactSpiralSsrWorkerPoolServer } from "./servers/inline-ssr-spiral-pooled.ts";
import { startSvelteSpiralSsrWorkerPoolServer } from "./servers/inline-ssr-spiral-pooled.ts";
import { startLuxelSpiralSsrWorkerPoolServer } from "./servers/luxel-spiral-pooled.ts";
import { startFastifyHtmlSpiralWorkerPoolServer } from "./servers/fastify-html-spiral-pooled.ts";

async function expectSpiralTiles(server: { url: string; close: () => void | Promise<void> }) {
  try {
    const res = await fetch(server.url);
    expect(res.ok).toBe(true);
    const tiles = (await res.text()).match(/class="tile"/g)?.length ?? 0;
    expect(tiles).toBeGreaterThan(2000);
  } finally {
    await server.close();
  }
}

describe("spiral render worker pool", () => {
  test("react-spiral-ssr-worker-pool serves full tile count", async () => {
    process.env.BENCH_RENDER_WORKER_COUNT = "2";
    await expectSpiralTiles(await startReactSpiralSsrWorkerPoolServer());
  }, 120_000);

  test("svelte-spiral-ssr-worker-pool serves full tile count", async () => {
    process.env.BENCH_RENDER_WORKER_COUNT = "2";
    await expectSpiralTiles(await startSvelteSpiralSsrWorkerPoolServer());
  }, 120_000);

  test("luxel-spiral-ssr-worker-pool serves full tile count", async () => {
    process.env.BENCH_RENDER_WORKER_COUNT = "2";
    await expectSpiralTiles(await startLuxelSpiralSsrWorkerPoolServer());
  }, 180_000);

  test("fastify-html-spiral-worker-pool serves full tile count", async () => {
    process.env.BENCH_RENDER_WORKER_COUNT = "2";
    await expectSpiralTiles(await startFastifyHtmlSpiralWorkerPoolServer());
  }, 60_000);
});
