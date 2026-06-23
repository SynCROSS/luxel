import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
/**
 * Bench fixture contract — public seam for luxel bench + WinRK harness.
 */
export {
  createTestServer,
  createNavDemoTestServer,
  createTestServerForApp,
  type TestServerOptions,
} from "../test/server.ts";

export { buildApp } from "../build/build-app.ts";
export { getLuxelRepoRoot } from "../paths.ts";
export {
  benchRenderWorkerCount,
  benchRenderWorkerCountForFixture,
  benchRenderWorkerCountForHardwareConcurrency,
  COUNTER_RENDER_WORKER_CAP,
  createBenchRenderWorkerPool,
  type BenchRenderWorkerPool,
  type BenchWorkerPoolFixture,
} from "./competitors/render-worker-pool.ts";
export {
  createRoundRobinDispatcher,
  rejectAllPending,
  type WorkerDispatchSlot,
  type WorkerPoolJob,
} from "./competitors/worker-round-robin-dispatch.ts";
export {
  createCounterInlineRenderPool,
  type CounterInlineFramework,
} from "./competitors/counter-inline-render-pool.ts";
export { runBenchRegistry, type BenchJsonLine } from "./registry.ts";
export { spiralDocumentFromBody, spiralMinimalDocument, spiralTileCount } from "./fixtures/spiral-contract.ts";
export { computeSpiralTiles, spiralBodyMarkup } from "./fixtures/spiral-html.ts";
export {
  renderReactCounterBody,
  renderReactCounterDocument,
  renderReactSpiralBody,
  renderReactSpiralDocument,
  renderSolidCounterBody,
  renderSolidCounterDocument,
  renderSolidSpiralBody,
  renderSolidSpiralDocument,
  renderSvelteCounterBody,
  renderSvelteCounterDocument,
  renderSvelteSpiralBody,
  renderSvelteSpiralDocument,
  renderVueVdomCounterBody,
  renderVueVdomCounterDocument,
  renderVueVdomSpiralBody,
  renderVueVdomSpiralDocument,
  renderVueVaporCounterBody,
  renderVueVaporCounterDocument,
  renderVueVaporSpiralBody,
  renderVueVaporSpiralDocument,
} from "./competitors/ssr-render.ts";
export { competitorSource } from "./competitors/sources-path.ts";
export { warmupBenchUrl, warmupBenchUrlBurst, warmIsrBenchUrl } from "./competitors/warmup.ts";
export { benchFetch, waitForServerReady, isBenchConnectError } from "./competitors/bench-fetch.ts";
export {
  applyDefaultBenchRenderWorkerBackendEnv,
  benchUsesNodeRenderWorkers,
  resolveBenchRenderWorkerBackend,
  type BenchRenderWorkerBackend,
} from "./competitors/bench-render-worker-backend.ts";

export type BenchFixtureId = "counter" | "nav-demo" | "spiral" | (string & {});

export type BenchServerHandle = {
  url: string;
  close: () => void | Promise<void>;
};

/** Start in-process bench server for a fixture app dir under the monorepo. */
export async function createBenchServer(
  fixture: BenchFixtureId,
  port = 0,
  options: Omit<import("../test/server.ts").TestServerOptions, "appDir"> = {},
): Promise<BenchServerHandle> {
  const { createTestServerForApp } = await import("../test/server.ts");
  const { getLuxelRepoRoot } = await import("../paths.ts");
  let appDir =
    fixture === "counter"
      ? "examples/counter"
      : fixture === "nav-demo"
        ? "examples/nav-demo"
        : fixture === "spiral"
          ? "examples/spiral"
          : fixture;
  if (fixture === "spiral") {
    const { ensureSpiralFixture } = await import("./ensure-spiral-fixture.ts");
    appDir = await ensureSpiralFixture(getLuxelRepoRoot());
  }
  return createTestServerForApp(appDir, port, options);
}

export async function createIsrBenchServer(port = 0): Promise<BenchServerHandle> {
  const { createNavDemoTestServer } = await import("../test/server.ts");
  const cacheDir = await mkdtemp(join(tmpdir(), "luxel-isr-bench-"));
  const server = await createNavDemoTestServer(port, {
    htmlCacheDir: cacheDir,
    routeRevalidateSeconds: { "/": 1 },
    internalRoutes: true,
  });
  const base = server.url.endsWith("/") ? server.url : `${server.url}/`;
  const miss = await fetch(base);
  if (!miss.ok) throw new Error(`ISR bench warm miss failed: ${miss.status}`);
  if (miss.headers.get("x-luxel-cache") !== "miss") {
    throw new Error("ISR bench warm expected cache miss");
  }
  const hit = await fetch(base);
  if (!hit.ok) throw new Error(`ISR bench warm hit failed: ${hit.status}`);
  if (hit.headers.get("x-luxel-cache") !== "hit") {
    throw new Error("ISR bench warm expected cache hit");
  }
  return server;
}
