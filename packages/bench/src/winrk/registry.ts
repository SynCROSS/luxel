import {
  warmIsrBenchUrl,
  warmupBenchUrl,
  warmupBenchUrlBurst,
  waitForServerReady,
  isBenchConnectError,
} from "@luxel/luxel/bench";
import { runBenchLoadTest, canFallbackToBombardier, type BenchLoadTester } from "./load-test.ts";
import type { WinrkStats } from "./parse.ts";
import type { BenchServer } from "./http-server.ts";
import { samplePostWinrkLatency, type LatencyPercentiles } from "./latency-sample.ts";
import {
  usesWinrkLatencyStatsOnly,
  isWindowsBenchHost,
  prepareForWinrkMeasurement,
} from "./bench-latency-config.ts";
import {
  benchWinrkMeasurementRetryAttempts,
  shouldRetryWinrkMeasurement,
  winrkMeasurementHasErrors,
} from "./winrk-measurement-policy.ts";
import { sampleResourcesDuring, type ResourceSummary } from "./resource-sampler.ts";
import { formatBytes, probeResponseBytes } from "./response-bytes.ts";
import { optimizationsForStack } from "./optimizations.ts";
import {
  startReactSsrServer,
  startVueSsrServer,
  startVueVaporSsrServer,
  startSolidSsrServer,
  startSvelteSsrServer,
} from "./servers/inline-ssr.ts";
import {
  startReactSsrWorkerPoolServer,
  startVueSsrWorkerPoolServer,
  startVueVaporSsrWorkerPoolServer,
  startSolidSsrWorkerPoolServer,
  startSvelteSsrWorkerPoolServer,
} from "./servers/inline-ssr-pooled.ts";
import {
  startReactSpiralSsrServer,
  startVueSpiralSsrServer,
  startVueVaporSpiralSsrServer,
  startSolidSpiralSsrServer,
  startSvelteSpiralSsrServer,
} from "./servers/inline-ssr-spiral.ts";
import {
  startReactSpiralSsrWorkerPoolServer,
  startVueSpiralSsrWorkerPoolServer,
  startVueVaporSpiralSsrWorkerPoolServer,
  startSolidSpiralSsrWorkerPoolServer,
  startSvelteSpiralSsrWorkerPoolServer,
} from "./servers/inline-ssr-spiral-pooled.ts";
import {
  startLuxelSsrServer,
  startLuxelSsrFullServer,
  startLuxelCsrServer,
  startLuxelIsrServer,
  startLuxelSpiralSsrServer,
  startLuxelSpiralSsrFullServer,
  startLuxelSpiralSsrNativeServer,
  startLuxelSsrNativeServer,
} from "./servers/luxel.ts";
import { startLuxelSpiralSsrWorkerPoolServer } from "./servers/luxel-spiral-pooled.ts";
import {
  startLuxelSsrWorkerPoolServer,
  startLuxelSsrFullWorkerPoolServer,
} from "./servers/luxel-counter-pooled.ts";
import { startFastifyHtmlSpiralWorkerPoolServer } from "./servers/fastify-html-spiral-pooled.ts";
import { startFastifyHtmlWorkerPoolServer } from "./servers/fastify-html-counter-pooled.ts";
import {
  startReactCsrServer,
  startVueCsrServer,
  startVueVaporCsrServer,
  startSolidCsrServer,
  startSvelteCsrServer,
  startReactRscServer,
  startReactRscWorkerPoolServer,
  startSolidStartSsrServer,
  startSolidStartSsrWorkerPoolServer,
  startSvelteKitSsrServer,
  startSvelteKitSsrWorkerPoolServer,
  startSvelteKitIsrServer,
  startSvelteKitIsrWorkerPoolServer,
} from "./servers/framework.ts";
import { startLuxelIsrWorkerPoolServer } from "./servers/luxel-isr-pooled.ts";
import {
  startFastifyHtmlCounterServer,
  startFastifyHtmlSpiralServer,
} from "./servers/fastify-html.ts";
import {
  startStaticHttpCounterServer,
  startStaticHttpSpiralServer,
} from "./servers/static-http.ts";
import {
  startFastifyStaticCounterServer,
  startFastifyStaticSpiralServer,
} from "./servers/fastify-static.ts";
import { releaseBetweenStacks } from "./between-stacks.ts";
import { startExternalStackServer, usesExternalStackServer } from "./external-stack-server.ts";

export type StackRole = "baseline" | "framework";
export type StackMode = "csr" | "ssr" | "rsc" | "isr" | "static";

export type StackRow = {
  id: string;
  framework: string;
  mode: StackMode;
  role?: StackRole;
  version?: string;
  optimizations?: string[];
  start: () => Promise<BenchServer | null>;
  pendingReason?: string;
};

/** Counter fixture — inline SSR + prod-stack + Bun/Fastify (see docs/benchmarks/fairness.md). */
export const WINRK_COUNTER_STACKS: StackRow[] = [
  { id: "static-http", framework: "bun", mode: "static", role: "baseline", start: startStaticHttpCounterServer },
  { id: "fastify-static", framework: "fastify", mode: "static", role: "baseline", start: startFastifyStaticCounterServer },
  { id: "fastify-html", framework: "fastify", mode: "ssr", start: startFastifyHtmlCounterServer },
  { id: "fastify-html-worker-pool", framework: "fastify", mode: "ssr", start: startFastifyHtmlWorkerPoolServer },
  { id: "react-csr", framework: "react", mode: "csr", version: ">=19", start: startReactCsrServer, pendingReason: "run bun run build in packages/bench/competitors" },
  { id: "vue-vdom-csr", framework: "vue", mode: "csr", version: ">=3.5", start: startVueCsrServer, pendingReason: "run competitors build" },
  { id: "vue-vapor-csr", framework: "vue", mode: "csr", version: ">=3.6", start: startVueVaporCsrServer, pendingReason: "run competitors build (vue-vapor-csr)" },
  { id: "solid-csr", framework: "solid", mode: "csr", version: ">=1.9", start: startSolidCsrServer, pendingReason: "run competitors build" },
  { id: "svelte-csr", framework: "svelte", mode: "csr", version: ">=5.56", start: startSvelteCsrServer, pendingReason: "run competitors build" },
  { id: "luxel-csr", framework: "luxel", mode: "csr", start: startLuxelCsrServer },
  { id: "react-ssr-worker-pool", framework: "react", mode: "ssr", version: ">=19", start: startReactSsrWorkerPoolServer },
  { id: "vue-vdom-ssr-worker-pool", framework: "vue", mode: "ssr", version: ">=3.5", start: startVueSsrWorkerPoolServer },
  { id: "vue-vapor-ssr-worker-pool", framework: "vue", mode: "ssr", version: ">=3.6", start: startVueVaporSsrWorkerPoolServer },
  { id: "solid-ssr-worker-pool", framework: "solid", mode: "ssr", version: ">=1.9", start: startSolidSsrWorkerPoolServer },
  { id: "svelte-ssr-worker-pool", framework: "svelte", mode: "ssr", version: ">=5.56", start: startSvelteSsrWorkerPoolServer },
  { id: "react-ssr", framework: "react", mode: "ssr", version: ">=19", start: startReactSsrServer },
  { id: "vue-vdom-ssr", framework: "vue", mode: "ssr", version: ">=3.5", start: startVueSsrServer },
  { id: "vue-vapor-ssr", framework: "vue", mode: "ssr", version: ">=3.6", start: startVueVaporSsrServer },
  { id: "solid-ssr", framework: "solid", mode: "ssr", version: ">=1.9", start: startSolidSsrServer },
  { id: "svelte-ssr", framework: "svelte", mode: "ssr", version: ">=5.56", start: startSvelteSsrServer },
  { id: "luxel-ssr", framework: "luxel", mode: "ssr", start: startLuxelSsrServer },
  { id: "luxel-ssr-native", framework: "luxel", mode: "ssr", start: startLuxelSsrNativeServer },
  { id: "luxel-ssr-worker-pool", framework: "luxel", mode: "ssr", start: startLuxelSsrWorkerPoolServer },
  { id: "luxel-ssr-full", framework: "luxel", mode: "ssr", start: startLuxelSsrFullServer },
  { id: "luxel-ssr-full-worker-pool", framework: "luxel", mode: "ssr", start: startLuxelSsrFullWorkerPoolServer },
  { id: "react-rsc", framework: "next", mode: "rsc", version: ">=19", start: startReactRscServer, pendingReason: "run competitors build (next.js)" },
  { id: "react-rsc-worker-pool", framework: "next", mode: "rsc", version: ">=19", start: startReactRscWorkerPoolServer, pendingReason: "run competitors build (next.js)" },
  { id: "solidstart-ssr", framework: "solidstart", mode: "ssr", version: ">=1", start: startSolidStartSsrServer, pendingReason: "run competitors build (solidstart)" },
  { id: "solidstart-ssr-worker-pool", framework: "solidstart", mode: "ssr", version: ">=1", start: startSolidStartSsrWorkerPoolServer, pendingReason: "run competitors build (solidstart)" },
  { id: "sveltekit-ssr", framework: "sveltekit", mode: "ssr", version: ">=2.63", start: startSvelteKitSsrServer, pendingReason: "run competitors build (sveltekit)" },
  { id: "sveltekit-ssr-worker-pool", framework: "sveltekit", mode: "ssr", version: ">=2.63", start: startSvelteKitSsrWorkerPoolServer, pendingReason: "run competitors build (sveltekit)" },
  { id: "sveltekit-isr", framework: "sveltekit", mode: "isr", version: ">=2.63", start: startSvelteKitIsrServer, pendingReason: "run competitors build (sveltekit-isr)" },
  { id: "sveltekit-isr-worker-pool", framework: "sveltekit", mode: "isr", version: ">=2.63", start: startSvelteKitIsrWorkerPoolServer, pendingReason: "run competitors build (sveltekit-isr)" },
  { id: "luxel-isr", framework: "luxel", mode: "isr", start: startLuxelIsrServer },
  { id: "luxel-isr-worker-pool", framework: "luxel", mode: "isr", start: startLuxelIsrWorkerPoolServer },
];

/** Tier-2 Platformatic spiral — per-request SSR only (see docs/benchmarks/ssr-showdown.md). */
export const WINRK_SPIRAL_STACKS: StackRow[] = [
  { id: "static-http-spiral", framework: "static-http", mode: "static", role: "baseline", start: startStaticHttpSpiralServer },
  { id: "fastify-static-spiral", framework: "fastify-static", mode: "static", role: "baseline", start: startFastifyStaticSpiralServer },
  { id: "fastify-html-spiral", framework: "fastify-html", mode: "ssr", start: startFastifyHtmlSpiralServer },
  { id: "fastify-html-spiral-worker-pool", framework: "fastify-html", mode: "ssr", start: startFastifyHtmlSpiralWorkerPoolServer },
  { id: "luxel-spiral-ssr", framework: "luxel", mode: "ssr", start: startLuxelSpiralSsrServer },
  { id: "luxel-spiral-ssr-worker-pool", framework: "luxel", mode: "ssr", start: startLuxelSpiralSsrWorkerPoolServer },
  { id: "luxel-spiral-ssr-full", framework: "luxel", mode: "ssr", start: startLuxelSpiralSsrFullServer },
  { id: "luxel-spiral-ssr-native", framework: "luxel", mode: "ssr", start: startLuxelSpiralSsrNativeServer },
  { id: "react-spiral-ssr-worker-pool", framework: "react", mode: "ssr", version: ">=19", start: startReactSpiralSsrWorkerPoolServer },
  { id: "vue-vdom-spiral-ssr-worker-pool", framework: "vue-vdom", mode: "ssr", version: ">=3.5", start: startVueSpiralSsrWorkerPoolServer },
  { id: "vue-vapor-spiral-ssr-worker-pool", framework: "vue-vapor", mode: "ssr", version: ">=3.6", start: startVueVaporSpiralSsrWorkerPoolServer },
  { id: "solid-spiral-ssr-worker-pool", framework: "solid", mode: "ssr", version: ">=1.9", start: startSolidSpiralSsrWorkerPoolServer },
  { id: "svelte-spiral-ssr-worker-pool", framework: "svelte", mode: "ssr", version: ">=5.56", start: startSvelteSpiralSsrWorkerPoolServer },
  { id: "react-spiral-ssr", framework: "react", mode: "ssr", version: ">=19", start: startReactSpiralSsrServer },
  { id: "vue-vdom-spiral-ssr", framework: "vue-vdom", mode: "ssr", version: ">=3.5", start: startVueSpiralSsrServer },
  { id: "vue-vapor-spiral-ssr", framework: "vue-vapor", mode: "ssr", version: ">=3.6", start: startVueVaporSpiralSsrServer },
  { id: "solid-spiral-ssr", framework: "solid", mode: "ssr", version: ">=1.9", start: startSolidSpiralSsrServer },
  { id: "svelte-spiral-ssr", framework: "svelte", mode: "ssr", version: ">=5.56", start: startSvelteSpiralSsrServer },
];

/** @deprecated use WINRK_COUNTER_STACKS */
export const WINRK_STACKS = WINRK_COUNTER_STACKS;

export type WinrkFixtureId = "counter" | "spiral";

export function allWinrkStacks(): StackRow[] {
  return [...WINRK_COUNTER_STACKS, ...WINRK_SPIRAL_STACKS];
}

export function stacksForFixture(fixture: WinrkFixtureId): StackRow[] {
  if (fixture === "spiral") return WINRK_SPIRAL_STACKS;
  return WINRK_COUNTER_STACKS;
}

export type WinrkBenchResult =
  | {
      id: string;
      framework: string;
      mode: string;
      role: StackRole;
      version?: string;
      optimizations: string[];
      status: "ok";
      url: string;
      requestsPerSec: number;
      latencyMinMs?: number;
      latencyP50Ms?: number;
      latencyP95Ms?: number;
      latencyP99Ms?: number;
      latencyAvgMs?: number;
      latencyMaxMs?: number;
      errorRatePercent?: number;
      responseBytes: number;
      responseBytesLabel: string;
      transferPerSec?: string;
      resources: ResourceSummary;
      latencySample: LatencyPercentiles;
      winrk: WinrkStats;
    }
  | {
      id: string;
      framework: string;
      mode: string;
      role: StackRole;
      version?: string;
      optimizations: string[];
      status: "pending" | "error";
      reason: string;
    };

export function stackRole(row: StackRow): StackRole {
  return row.role ?? "framework";
}

export function stackOptimizations(row: StackRow): string[] {
  return row.optimizations ?? optimizationsForStack(row.id);
}

function benchStackCooldownMs(): number {
  const fromEnv = Number(process.env.BENCH_STACK_COOLDOWN_MS);
  if (Number.isFinite(fromEnv) && fromEnv >= 0) return Math.floor(fromEnv);
  // Windows localhost needs longer recovery after sequential WinRK `-c400` windows.
  return isWindowsBenchHost() ? 10_000 : 2_000;
}

const STACK_COOLDOWN_MS = benchStackCooldownMs();
const STACK_RETRY_ATTEMPTS = Number(process.env.BENCH_STACK_RETRY_ATTEMPTS ?? "3");
const STACK_TIMEOUT_MS = Number(process.env.BENCH_STACK_TIMEOUT_MS ?? "0");

function latencyFromWinrk(winrk: WinrkStats): LatencyPercentiles {
  return {
    sampleCount: 0,
    p50Ms: winrk.latencyP50Ms ?? 0,
    p95Ms: winrk.latencyMaxMs ?? winrk.latencyP50Ms ?? 0,
    p99Ms: winrk.latencyMaxMs ?? winrk.latencyP50Ms ?? 0,
  };
}

function usesWinrkLatencyOnly(row: StackRow, external: boolean): boolean {
  return external || row.id.endsWith("-worker-pool");
}

async function stackCooldown(): Promise<void> {
  if (STACK_COOLDOWN_MS <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, STACK_COOLDOWN_MS));
}

function isRetriableBenchError(reason: string): boolean {
  return (
    !/timed out after/i.test(reason) &&
    (isBenchConnectError(new Error(reason)) ||
      /winrk failed|missing rps|empty result|winrk reported.*errors after/i.test(reason))
  );
}

export async function runWinrkStack(row: StackRow): Promise<WinrkBenchResult> {
  let last: WinrkBenchResult | null = null;
  for (let attempt = 1; attempt <= STACK_RETRY_ATTEMPTS; attempt++) {
    const runOnce = () => runWinrkStackOnce(row, attempt);
    const result =
      STACK_TIMEOUT_MS > 0
        ? await Promise.race([
            runOnce(),
            new Promise<WinrkBenchResult>((_, reject) => {
              setTimeout(
                () => reject(new Error(`stack ${row.id} timed out after ${STACK_TIMEOUT_MS}ms`)),
                STACK_TIMEOUT_MS,
              );
            }),
          ]).catch((err) => ({
            id: row.id,
            framework: row.framework,
            mode: row.mode,
            role: stackRole(row),
            version: row.version,
            optimizations: stackOptimizations(row),
            status: "error" as const,
            reason: err instanceof Error ? err.message : String(err),
          }))
        : await runOnce();
    if (result.status === "ok" || result.status === "pending") return result;
    last = result;
    if (!isRetriableBenchError(result.reason) || attempt === STACK_RETRY_ATTEMPTS) return result;
    await stackCooldown();
  }
  return last!;
}

async function runWinrkStackOnce(row: StackRow, _attempt = 1): Promise<WinrkBenchResult> {
  let server: BenchServer | null = null;
  const optimizations = stackOptimizations(row);
  try {
    if (usesExternalStackServer(row.id)) {
      console.error(`external server subprocess: ${row.id}`);
      const ext = await startExternalStackServer(row.id);
      server = { url: ext.url, port: 0, close: ext.close };
    } else {
      server = await row.start();
    }
    if (!server) {
      return {
        id: row.id,
        framework: row.framework,
        mode: row.mode,
        role: stackRole(row),
        version: row.version,
        optimizations,
        status: "pending",
        reason: row.pendingReason ?? "server not available",
      };
    }
    const external = usesExternalStackServer(row.id);
    await waitForServerReady(server.url);
    let responseBytes = 0;
    try {
      responseBytes = await probeResponseBytes(server.url);
    } catch (err) {
      if (!external) throw err;
      console.error(
        `probe skipped (${err instanceof Error ? err.message : String(err)}) — external luxel worker pool`,
      );
    }
    if (row.mode === "isr") {
      await warmIsrBenchUrl(server.url);
    } else if (external && row.id.startsWith("luxel-") && row.id.endsWith("-worker-pool")) {
      await warmupBenchUrlBurst(server.url);
    } else if (!row.id.endsWith("-worker-pool")) {
      await warmupBenchUrl(server.url);
    }
    const winrkAttempts = benchWinrkMeasurementRetryAttempts();
    let loadTester: BenchLoadTester | undefined;
    let winrk: WinrkStats | null = null;
    let resources: ResourceSummary | null = null;
    for (let winrkAttempt = 1; winrkAttempt <= winrkAttempts; winrkAttempt++) {
      await prepareForWinrkMeasurement(server.url);
      const sampled = await sampleResourcesDuring(() =>
        runBenchLoadTest({ url: server!.url, tester: loadTester }),
      );
      winrk = sampled.result;
      resources = sampled.resources;
      if (!winrkMeasurementHasErrors(winrk)) break;
      if (canFallbackToBombardier(loadTester ?? "winrk")) {
        console.error(`winrk errors on ${row.id}; retry with bombardier`);
        loadTester = "bombardier";
        continue;
      }
      if (shouldRetryWinrkMeasurement(winrkAttempt, winrkAttempts)) {
        console.error(
          `load-test errors on ${row.id} (${winrk.totalErrors ?? winrk.errorRatePercent}%); retry ${winrkAttempt + 1}/${winrkAttempts}`,
        );
      }
    }
    if (!winrk || !resources) {
      throw new Error(`winrk produced no result for ${row.id}`);
    }
    if (winrkMeasurementHasErrors(winrk)) {
      throw new Error(
        `winrk reported ${winrk.totalErrors ?? winrk.errorRatePercent}% errors after ${winrkAttempts} attempts`,
      );
    }
    const latencySample =
      usesWinrkLatencyOnly(row, external) || usesWinrkLatencyStatsOnly()
        ? latencyFromWinrk(winrk)
        : await samplePostWinrkLatency({ url: server.url });
    return {
      id: row.id,
      framework: row.framework,
      mode: row.mode,
      role: stackRole(row),
      version: row.version,
      optimizations,
      status: "ok",
      url: server.url,
      requestsPerSec: winrk.requestsPerSec,
      latencyMinMs: winrk.latencyMinMs,
      latencyP50Ms: winrk.latencyP50Ms ?? latencySample.p50Ms,
      latencyP95Ms: latencySample.p95Ms,
      latencyP99Ms: latencySample.p99Ms,
      latencyAvgMs: winrk.latencyAvgMs,
      latencyMaxMs: winrk.latencyMaxMs,
      errorRatePercent: winrk.errorRatePercent,
      responseBytes,
      responseBytesLabel: formatBytes(responseBytes),
      transferPerSec: winrk.transferPerSec,
      resources,
      latencySample,
      winrk,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      id: row.id,
      framework: row.framework,
      mode: row.mode,
      role: stackRole(row),
      version: row.version,
      optimizations,
      status: "error",
      reason,
    };
  } finally {
    if (server) await server.close();
    await stackCooldown();
    releaseBetweenStacks();
  }
}

export async function runAllWinrkStacks(
  rows = WINRK_STACKS,
  opts?: { onProgress?: (results: WinrkBenchResult[]) => void | Promise<void> },
): Promise<WinrkBenchResult[]> {
  const results: WinrkBenchResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    console.error(`[${i + 1}/${rows.length}] stack: ${row.id}`);
    results.push(await runWinrkStack(row));
    await opts?.onProgress?.(results);
  }
  return results;
}
