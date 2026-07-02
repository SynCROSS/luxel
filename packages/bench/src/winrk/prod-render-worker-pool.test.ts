import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startReactRscWorkerPoolServer, startSvelteKitSsrWorkerPoolServer, startSolidStartSsrWorkerPoolServer, startSvelteKitIsrWorkerPoolServer } from "./servers/framework.ts";
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
  test("react-rsc-worker-pool serves counter contract", async () => {
    if (!existsSync(join(competitorsRoot, "react-rsc/.next/BUILD_ID"))) return;
    process.env.BENCH_RENDER_WORKER_COUNT = "2";
    const server = await startReactRscWorkerPoolServer();
    if (!server) throw new Error("react-rsc-worker-pool server unavailable");
    await expectCounterHtml(server);
  }, 180_000);

  test("solidstart-ssr-worker-pool serves counter contract", async () => {
    if (!existsSync(join(competitorsRoot, "solidstart-ssr/.output/server/index.mjs"))) return;
    process.env.BENCH_RENDER_WORKER_COUNT = "2";
    const server = await startSolidStartSsrWorkerPoolServer();
    if (!server) throw new Error("solidstart-ssr-worker-pool server unavailable");
    await expectCounterHtml(server);
  }, 180_000);

  test("sveltekit-ssr-worker-pool serves counter contract", async () => {
    if (!existsSync(join(competitorsRoot, "sveltekit-ssr/build/handler.js"))) return;
    process.env.BENCH_RENDER_WORKER_COUNT = "2";
    const server = await startSvelteKitSsrWorkerPoolServer();
    if (!server) throw new Error("sveltekit-ssr-worker-pool server unavailable");
    await expectCounterHtml(server);
  }, 180_000);

  test("sveltekit-isr-worker-pool warms miss then hit", async () => {
    if (!existsSync(join(competitorsRoot, "sveltekit-isr/build/handler.js"))) return;
    process.env.BENCH_RENDER_WORKER_COUNT = "2";
    const server = await startSvelteKitIsrWorkerPoolServer();
    if (!server) throw new Error("sveltekit-isr-worker-pool server unavailable");
    try {
      const base = server.url.endsWith("/") ? server.url : `${server.url}/`;
      const miss = await fetch(base);
      expect(miss.ok).toBe(true);
      expect(miss.headers.get("x-cache")).toBe("miss");
      const hit = await fetch(base);
      expect(hit.ok).toBe(true);
      expect(hit.headers.get("x-cache")).toBe("hit");
      expect(await hit.text()).toContain(COUNTER_HEADLINE);
    } finally {
      await server.close();
    }
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
