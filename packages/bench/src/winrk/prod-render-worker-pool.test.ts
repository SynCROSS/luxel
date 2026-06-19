import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startSvelteKitSsrWorkerPoolServer } from "./servers/framework.ts";
import { startLuxelIsrWorkerPoolServer } from "./servers/luxel-isr-pooled.ts";

const competitorsRoot = join(dirname(fileURLToPath(import.meta.url)), "../../competitors");
const COUNTER_HEADLINE = "Hello Luxel";

async function expectCounterHtml(server: { url: string; close: () => void | Promise<void> }) {
  try {
    const res = await fetch(server.url);
    expect(res.ok).toBe(true);
    expect(await res.text()).toContain(COUNTER_HEADLINE);
  } finally {
    await server.close();
  }
}

describe("prod-stack render worker pool", () => {
  test("sveltekit-ssr-worker-pool serves counter contract", async () => {
    if (!existsSync(join(competitorsRoot, "sveltekit-ssr/build/handler.js"))) return;
    process.env.BENCH_RENDER_WORKER_COUNT = "2";
    const server = await startSvelteKitSsrWorkerPoolServer();
    if (!server) throw new Error("sveltekit-ssr-worker-pool server unavailable");
    await expectCounterHtml(server);
  }, 180_000);

  test("luxel-isr-worker-pool warms miss then hit", async () => {
    process.env.BENCH_RENDER_WORKER_COUNT = "2";
    const server = await startLuxelIsrWorkerPoolServer();
    try {
      const base = server.url.endsWith("/") ? server.url : `${server.url}/`;
      const miss = await fetch(base);
      expect(miss.ok).toBe(true);
      expect(miss.headers.get("x-luxel-cache")).toBe("miss");
      const hit = await fetch(base);
      expect(hit.ok).toBe(true);
      expect(hit.headers.get("x-luxel-cache")).toBe("hit");
    } finally {
      await server.close();
    }
  }, 180_000);
});
