import { describe, expect, test } from "bun:test";
import {
  startReactSsrWorkerPoolServer,
  startVueSsrWorkerPoolServer,
  startVueVaporSsrWorkerPoolServer,
  startSvelteSsrWorkerPoolServer,
  startSolidSsrWorkerPoolServer,
} from "./servers/inline-ssr-pooled.ts";

const COUNTER_HEADLINE = "Hello Luxel";

async function expectCounterContract(server: { url: string; close: () => void | Promise<void> }) {
  try {
    const res = await fetch(server.url);
    expect(res.ok).toBe(true);
    const html = await res.text();
    expect(html).toContain(COUNTER_HEADLINE);
    expect(html).toContain('data-luxel-text="count"');
  } finally {
    await server.close();
  }
}

describe("counter render worker pool", () => {
  test("react-ssr-worker-pool serves counter contract", async () => {
    process.env.BENCH_RENDER_WORKER_COUNT = "2";
    await expectCounterContract(await startReactSsrWorkerPoolServer());
  }, 120_000);

  test("vue-vdom-ssr-worker-pool serves counter contract", async () => {
    process.env.BENCH_RENDER_WORKER_COUNT = "2";
    await expectCounterContract(await startVueSsrWorkerPoolServer());
  }, 120_000);

  test("vue-vapor-ssr-worker-pool serves counter contract", async () => {
    process.env.BENCH_RENDER_WORKER_COUNT = "2";
    await expectCounterContract(await startVueVaporSsrWorkerPoolServer());
  }, 120_000);

  test("svelte-ssr-worker-pool serves counter contract", async () => {
    process.env.BENCH_RENDER_WORKER_COUNT = "2";
    await expectCounterContract(await startSvelteSsrWorkerPoolServer());
  }, 120_000);

  test("solid-ssr-worker-pool serves counter contract", async () => {
    process.env.BENCH_RENDER_WORKER_COUNT = "2";
    await expectCounterContract(await startSolidSsrWorkerPoolServer());
  }, 120_000);
});
