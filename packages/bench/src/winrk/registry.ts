import {
  warmIsrBenchUrl,
  warmupBenchUrl,
  waitForServerReady,
  isBenchConnectError,
} from "@luxel/luxel/bench";
import { runBenchLoadTest, canFallbackToBombardier, type BenchLoadTester } from "./load-test.ts";
import type { WinrkStats } from "./parse.ts";
import type { BenchServer } from "./http-server.ts";
import {
  benchLatencyConcurrency,
  benchLatencySampleCount,
  prepareForPostWinrkLatencySample,
  prepareForWinrkMeasurement,
  usesWinrkLatencyStatsOnly,
} from "./bench-latency-config.ts";
import {
  formatResponseBytesLabel,
  measureResponseBytes,
  measureWithResourceSampling,
  samplePostWinrkLatency,
  type LatencySampleSummary,
  type ResourceSummary,
} from "./bench-measurement.ts";
import {
  benchWinrkMeasurementRetryAttempts,
  shouldRetryWinrkMeasurement,
  winrkMeasurementHasErrors,
} from "./winrk-measurement-policy.ts";
import { releaseBetweenStacks } from "./between-stacks.ts";
import { startReactSsrServer, startVueSsrServer, startSolidSsrServer, startSvelteSsrServer, startVueVaporSsrServer } from "./servers/inline-ssr.ts";
import {
  startVueSsrWorkerPoolServer,
  startVueVaporSsrWorkerPoolServer,
  startSolidSsrWorkerPoolServer,
  startSvelteSsrWorkerPoolServer,
  startReactSsrWorkerPoolServer,
} from "./servers/inline-ssr-pooled.ts";
import { startStaticHttpCounterServer } from "./servers/static-http.ts";
import { startFastifyStaticCounterServer } from "./servers/fastify-static.ts";
import {
  startFastifyHtmlCounterServer,
} from "./servers/fastify-html.ts";
import { startFastifyHtmlWorkerPoolServer } from "./servers/fastify-html-counter-pooled.ts";
import {
  startLuxelSsrWorkerPoolServer,
  startLuxelSsrFullWorkerPoolServer,
} from "./servers/luxel-counter-pooled.ts";
import { startLuxelIsrWorkerPoolServer } from "./servers/luxel-isr-pooled.ts";
import {
  startReactSpiralSsrServer,
  startVueSpiralSsrServer,
  startVueVaporSpiralSsrServer,
  startSolidSpiralSsrServer,
  startSvelteSpiralSsrServer,
} from "./servers/inline-ssr-spiral.ts";
import { startLuxelSsrServer, startLuxelCsrServer, startLuxelIsrServer, startLuxelSpiralSsrServer, startLuxelSsrFullServer, startLuxelSsrNativeServer, startLuxelSpiralSsrFullServer, startLuxelSpiralSsrNativeServer } from "./servers/luxel.ts";
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
import {
  startReactSpiralSsrWorkerPoolServer,
  startVueSpiralSsrWorkerPoolServer,
  startVueVaporSpiralSsrWorkerPoolServer,
  startSolidSpiralSsrWorkerPoolServer,
  startSvelteSpiralSsrWorkerPoolServer,
} from "./servers/inline-ssr-spiral-pooled.ts";
import { startStaticHttpSpiralServer } from "./servers/static-http.ts";
import { startFastifyStaticSpiralServer } from "./servers/fastify-static.ts";
import {
  startFastifyHtmlSpiralServer,
} from "./servers/fastify-html.ts";
import { startFastifyHtmlSpiralWorkerPoolServer } from "./servers/fastify-html-spiral-pooled.ts";
import {
  startLuxelSpiralSsrWorkerPoolServer,
} from "./servers/luxel-spiral-pooled.ts";

import { optimizationsForStack } from "./optimizations.ts";

export type StackRole = "baseline" | "framework";

export type GateClass = StackRole;

export type DeploymentTier = "baseline" | "inline" | "prod-stack" | "static" | "isr";

const BASELINE_STACK_IDS = new Set([
  "static-http",
  "fastify-static",
  "static-http-spiral",
  "fastify-static-spiral",
]);

const PROD_STACK_IDS = new Set([
  "react-rsc",
  "react-rsc-worker-pool",
  "solidstart-ssr",
  "solidstart-ssr-worker-pool",
  "sveltekit-ssr",
  "sveltekit-ssr-worker-pool",
  "sveltekit-isr",
  "sveltekit-isr-worker-pool",
]);

export function stackRole(row: Pick<StackRow, "id">): StackRole {
  return BASELINE_STACK_IDS.has(row.id) ? "baseline" : "framework";
}

export function stackGateClass(row: Pick<StackRow, "id">): GateClass {
  return stackRole(row);
}

export function stackDeploymentTier(row: Pick<StackRow, "id" | "mode">): DeploymentTier {
  if (BASELINE_STACK_IDS.has(row.id)) return "baseline";
  if (row.mode === "csr") return "static";
  if (row.mode === "isr") return "isr";
  if (PROD_STACK_IDS.has(row.id)) return "prod-stack";
  return "inline";
}

export function stackOptimizations(row: Pick<StackRow, "id">): string[] {
  return optimizationsForStack(row.id);
}

export type StackRow = {
  id: string;
  framework: string;
  mode: "csr" | "ssr" | "rsc" | "isr";
  version?: string;
  gateClass: GateClass;
  deploymentTier: DeploymentTier;
  start: () => Promise<BenchServer | null>;
  pendingReason?: string;
};

function stackRow(
  row: Omit<StackRow, "gateClass" | "deploymentTier">,
): StackRow {
  return {
    ...row,
    gateClass: stackGateClass(row),
    deploymentTier: stackDeploymentTier(row),
  };
}

export const WINRK_COUNTER_STACKS: StackRow[] = [
  stackRow({ id: "static-http", framework: "static", mode: "ssr", start: startStaticHttpCounterServer }),
  stackRow({ id: "fastify-static", framework: "fastify", mode: "ssr", start: startFastifyStaticCounterServer }),
  stackRow({ id: "fastify-html-worker-pool", framework: "fastify", mode: "ssr", start: startFastifyHtmlWorkerPoolServer }),
  stackRow({ id: "fastify-html", framework: "fastify", mode: "ssr", start: startFastifyHtmlCounterServer }),
  stackRow({ id: "react-csr", framework: "react", mode: "csr", version: ">=19", start: startReactCsrServer, pendingReason: "run bun run build in packages/bench/competitors" }),
  stackRow({ id: "react-ssr-worker-pool", framework: "react", mode: "ssr", version: ">=19", start: startReactSsrWorkerPoolServer }),
  stackRow({ id: "react-ssr", framework: "react", mode: "ssr", version: ">=19", start: startReactSsrServer }),
  stackRow({ id: "vue-vdom-ssr-worker-pool", framework: "vue", mode: "ssr", version: ">=3.5", start: startVueSsrWorkerPoolServer }),
  stackRow({ id: "vue-vapor-ssr-worker-pool", framework: "vue", mode: "ssr", version: ">=3.6", start: startVueVaporSsrWorkerPoolServer }),
  stackRow({ id: "solid-ssr-worker-pool", framework: "solid", mode: "ssr", version: ">=1.9", start: startSolidSsrWorkerPoolServer }),
  stackRow({ id: "svelte-ssr-worker-pool", framework: "svelte", mode: "ssr", version: ">=5.56", start: startSvelteSsrWorkerPoolServer }),
  stackRow({ id: "vue-vdom-ssr", framework: "vue", mode: "ssr", version: ">=3.5", start: startVueSsrServer }),
  stackRow({ id: "vue-vapor-ssr", framework: "vue", mode: "ssr", version: ">=3.6", start: startVueVaporSsrServer }),
  stackRow({ id: "solid-ssr", framework: "solid", mode: "ssr", version: ">=1.9", start: startSolidSsrServer }),
  stackRow({ id: "svelte-ssr", framework: "svelte", mode: "ssr", version: ">=5.56", start: startSvelteSsrServer }),
  stackRow({ id: "react-rsc", framework: "react", mode: "rsc", version: ">=19", start: startReactRscServer, pendingReason: "run competitors build (next.js)" }),
  stackRow({ id: "react-rsc-worker-pool", framework: "react", mode: "rsc", version: ">=19", start: startReactRscWorkerPoolServer, pendingReason: "run competitors build (next.js)" }),
  stackRow({ id: "vue-vdom-csr", framework: "vue-vdom", mode: "csr", version: ">=3.5", start: startVueCsrServer, pendingReason: "run competitors build" }),
  stackRow({ id: "vue-vapor-csr", framework: "vue-vapor", mode: "csr", version: ">=3.6", start: startVueVaporCsrServer, pendingReason: "run competitors build (vue-vapor-csr)" }),
  stackRow({ id: "solid-csr", framework: "solid", mode: "csr", version: ">=1.9", start: startSolidCsrServer, pendingReason: "run competitors build" }),
  stackRow({ id: "solidstart-ssr", framework: "solidstart", mode: "ssr", version: ">=1", start: startSolidStartSsrServer, pendingReason: "run competitors build (solidstart)" }),
  stackRow({ id: "solidstart-ssr-worker-pool", framework: "solidstart", mode: "ssr", version: ">=1", start: startSolidStartSsrWorkerPoolServer, pendingReason: "run competitors build (solidstart)" }),
  stackRow({ id: "svelte-csr", framework: "svelte", mode: "csr", version: ">=5.56", start: startSvelteCsrServer, pendingReason: "run competitors build" }),
  stackRow({ id: "sveltekit-ssr", framework: "sveltekit", mode: "ssr", version: ">=2.63", start: startSvelteKitSsrServer, pendingReason: "run competitors build (sveltekit)" }),
  stackRow({ id: "sveltekit-ssr-worker-pool", framework: "sveltekit", mode: "ssr", version: ">=2.63", start: startSvelteKitSsrWorkerPoolServer, pendingReason: "run competitors build (sveltekit)" }),
  stackRow({ id: "sveltekit-isr", framework: "sveltekit", mode: "isr", version: ">=2.63", start: startSvelteKitIsrServer, pendingReason: "run competitors build (sveltekit-isr)" }),
  stackRow({ id: "sveltekit-isr-worker-pool", framework: "sveltekit", mode: "isr", version: ">=2.63", start: startSvelteKitIsrWorkerPoolServer, pendingReason: "run competitors build (sveltekit-isr)" }),
  stackRow({ id: "luxel-csr", framework: "luxel", mode: "csr", start: startLuxelCsrServer }),
  stackRow({ id: "luxel-ssr-worker-pool", framework: "luxel", mode: "ssr", start: startLuxelSsrWorkerPoolServer }),
  stackRow({ id: "luxel-ssr", framework: "luxel", mode: "ssr", start: startLuxelSsrServer }),
  stackRow({ id: "luxel-ssr-native", framework: "luxel", mode: "ssr", start: startLuxelSsrNativeServer }),
  stackRow({ id: "luxel-ssr-full-worker-pool", framework: "luxel", mode: "ssr", start: startLuxelSsrFullWorkerPoolServer }),
  stackRow({ id: "luxel-ssr-full", framework: "luxel", mode: "ssr", start: startLuxelSsrFullServer }),
  stackRow({ id: "luxel-isr-worker-pool", framework: "luxel", mode: "isr", start: startLuxelIsrWorkerPoolServer }),
  stackRow({ id: "luxel-isr", framework: "luxel", mode: "isr", start: startLuxelIsrServer }),
];

/** Tier-2 Platformatic spiral — per-request SSR only (see docs/benchmarks/ssr-showdown.md). */
export const WINRK_SPIRAL_STACKS: StackRow[] = [
  stackRow({ id: "static-http-spiral", framework: "static", mode: "ssr", start: startStaticHttpSpiralServer }),
  stackRow({ id: "fastify-static-spiral", framework: "fastify", mode: "ssr", start: startFastifyStaticSpiralServer }),
  stackRow({ id: "fastify-html-spiral-worker-pool", framework: "fastify", mode: "ssr", start: startFastifyHtmlSpiralWorkerPoolServer }),
  stackRow({ id: "fastify-html-spiral", framework: "fastify", mode: "ssr", start: startFastifyHtmlSpiralServer }),
  stackRow({ id: "luxel-spiral-ssr-worker-pool", framework: "luxel", mode: "ssr", start: startLuxelSpiralSsrWorkerPoolServer }),
  stackRow({ id: "luxel-spiral-ssr", framework: "luxel", mode: "ssr", start: startLuxelSpiralSsrServer }),
  stackRow({ id: "luxel-spiral-ssr-full", framework: "luxel", mode: "ssr", start: startLuxelSpiralSsrFullServer }),
  stackRow({ id: "luxel-spiral-ssr-native", framework: "luxel", mode: "ssr", start: startLuxelSpiralSsrNativeServer }),
  stackRow({ id: "react-spiral-ssr-worker-pool", framework: "react", mode: "ssr", version: ">=19", start: startReactSpiralSsrWorkerPoolServer }),
  stackRow({ id: "react-spiral-ssr", framework: "react", mode: "ssr", version: ">=19", start: startReactSpiralSsrServer }),
  stackRow({ id: "vue-vdom-spiral-ssr-worker-pool", framework: "vue-vdom", mode: "ssr", version: ">=3.5", start: startVueSpiralSsrWorkerPoolServer }),
  stackRow({ id: "vue-vdom-spiral-ssr", framework: "vue-vdom", mode: "ssr", version: ">=3.5", start: startVueSpiralSsrServer }),
  stackRow({ id: "vue-vapor-spiral-ssr-worker-pool", framework: "vue-vapor", mode: "ssr", version: ">=3.6", start: startVueVaporSpiralSsrWorkerPoolServer }),
  stackRow({ id: "vue-vapor-spiral-ssr", framework: "vue-vapor", mode: "ssr", version: ">=3.6", start: startVueVaporSpiralSsrServer }),
  stackRow({ id: "solid-spiral-ssr-worker-pool", framework: "solid", mode: "ssr", version: ">=1.9", start: startSolidSpiralSsrWorkerPoolServer }),
  stackRow({ id: "solid-spiral-ssr", framework: "solid", mode: "ssr", version: ">=1.9", start: startSolidSpiralSsrServer }),
  stackRow({ id: "svelte-spiral-ssr-worker-pool", framework: "svelte", mode: "ssr", version: ">=5.56", start: startSvelteSpiralSsrWorkerPoolServer }),
  stackRow({ id: "svelte-spiral-ssr", framework: "svelte", mode: "ssr", version: ">=5.56", start: startSvelteSpiralSsrServer }),
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

export type { ResourceSummary, LatencySampleSummary } from "./bench-measurement.ts";

function stackResultMeta(row: StackRow) {
  return {
    id: row.id,
    framework: row.framework,
    mode: row.mode,
    role: stackRole(row),
    gateClass: row.gateClass,
    deploymentTier: row.deploymentTier,
    version: row.version,
    optimizations: stackOptimizations(row),
  };
}

export type WinrkBenchResult =
  | {
      id: string;
      framework: string;
      mode: string;
      role: StackRole;
      gateClass: GateClass;
      deploymentTier: DeploymentTier;
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
      transferPerSec?: string;
      responseBytes: number;
      responseBytesLabel: string;
      resources: ResourceSummary;
      latencySample?: LatencySampleSummary;
      winrk: WinrkStats;
    }
  | {
      id: string;
      framework: string;
      mode: string;
      role: StackRole;
      gateClass: GateClass;
      deploymentTier: DeploymentTier;
      version?: string;
      optimizations: string[];
      status: "pending" | "error";
      reason: string;
    };

export async function runWinrkStack(row: StackRow): Promise<WinrkBenchResult> {
  const stackRetryAttempts = Number(process.env.BENCH_STACK_RETRY_ATTEMPTS ?? "3");
  let last: WinrkBenchResult | null = null;
  for (let attempt = 1; attempt <= stackRetryAttempts; attempt++) {
    const result = await runWinrkStackOnce(row);
    if (result.status === "ok" || result.status === "pending") return result;
    last = result;
    if (!isRetriableBenchError(result.reason) || attempt === stackRetryAttempts) return result;
  }
  return last!;
}

function benchWinrkDurationSec(): number {
  const n = Number(process.env.WINRK_DURATION ?? "15");
  return Number.isFinite(n) && n > 0 ? n : 15;
}

function benchStackCooldownMs(): number {
  const fromEnv = Number(process.env.BENCH_STACK_COOLDOWN_MS);
  if (Number.isFinite(fromEnv) && fromEnv >= 0) return Math.floor(fromEnv);
  return process.platform === "win32" ? 10_000 : 2_000;
}

function isRetriableBenchError(reason: string): boolean {
  return (
    isBenchConnectError(new Error(reason)) ||
    /winrk failed|missing rps|empty result|winrk reported.*errors after/i.test(reason)
  );
}

async function measureWinrk(url: string): Promise<WinrkStats> {
  const winrkAttempts = benchWinrkMeasurementRetryAttempts();
  let loadTester: BenchLoadTester | undefined;
  let winrk: WinrkStats | null = null;
  for (let winrkAttempt = 1; winrkAttempt <= winrkAttempts; winrkAttempt++) {
    await prepareForWinrkMeasurement(url);
    winrk = await runBenchLoadTest({
      url,
      durationSec: benchWinrkDurationSec(),
      tester: loadTester,
    });
    if (!winrkMeasurementHasErrors(winrk)) return winrk;
    if (canFallbackToBombardier(loadTester ?? "winrk")) {
      loadTester = "bombardier";
      continue;
    }
    if (!shouldRetryWinrkMeasurement(winrkAttempt, winrkAttempts)) break;
  }
  if (!winrk) throw new Error("winrk produced no result");
  if (winrkMeasurementHasErrors(winrk)) {
    throw new Error(
      `winrk reported ${winrk.totalErrors ?? winrk.errorRatePercent}% errors after ${winrkAttempts} attempts`,
    );
  }
  return winrk;
}

function latencyFromWinrk(winrk: WinrkStats) {
  const max = winrk.latencyMaxMs;
  return {
    latencyMinMs: winrk.latencyMinMs,
    latencyP50Ms: winrk.latencyP50Ms,
    latencyP95Ms: max,
    latencyP99Ms: max,
    latencyAvgMs: winrk.latencyAvgMs,
    latencyMaxMs: max,
  };
}

async function runWinrkStackOnce(row: StackRow): Promise<WinrkBenchResult> {
  let server: BenchServer | null = null;
  const meta = stackResultMeta(row);
  try {
    server = await row.start();
    if (!server) {
      return {
        ...meta,
        status: "pending",
        reason: row.pendingReason ?? "server not available",
      };
    }
    await waitForServerReady(server.url);
    if (row.mode === "isr") {
      await warmIsrBenchUrl(server.url);
    } else if (!row.id.endsWith("-worker-pool")) {
      await warmupBenchUrl(server.url);
    }
    const { result: winrk, resources } = await measureWithResourceSampling(() =>
      measureWinrk(server!.url),
    );
    const responseBytes = await measureResponseBytes(server.url);
    const responseBytesLabel = formatResponseBytesLabel(responseBytes);

    const isWorkerPool = row.id.endsWith("-worker-pool");
    const sampleCount = benchLatencySampleCount();
    const runPostWinrkSample = !isWorkerPool && !usesWinrkLatencyStatsOnly(sampleCount);

    let latencySample: LatencySampleSummary | undefined;
    let latencyFields: {
      latencyMinMs?: number;
      latencyP50Ms?: number;
      latencyP95Ms?: number;
      latencyP99Ms?: number;
      latencyAvgMs?: number;
      latencyMaxMs?: number;
    };

    if (runPostWinrkSample) {
      await prepareForPostWinrkLatencySample(server.url);
      const sample = await samplePostWinrkLatency(
        server.url,
        sampleCount,
        benchLatencyConcurrency(),
      );
      latencySample = {
        sampleCount: sample.sampleCount,
        p50Ms: sample.p50Ms,
        p95Ms: sample.p95Ms,
        p99Ms: sample.p99Ms,
      };
      latencyFields = {
        latencyMinMs: sample.minMs,
        latencyP50Ms: sample.p50Ms,
        latencyP95Ms: sample.p95Ms,
        latencyP99Ms: sample.p99Ms,
        latencyAvgMs: sample.avgMs,
        latencyMaxMs: sample.maxMs,
      };
    } else {
      latencyFields = latencyFromWinrk(winrk);
    }

    return {
      ...meta,
      status: "ok",
      url: server.url,
      requestsPerSec: winrk.requestsPerSec,
      ...latencyFields,
      errorRatePercent: winrk.errorRatePercent ?? 0,
      transferPerSec: winrk.transferPerSec,
      responseBytes,
      responseBytesLabel,
      resources,
      latencySample,
      winrk,
    };
  } catch (err) {
    return {
      ...meta,
      status: "error",
      reason: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (server) await server.close();
    const cooldownMs = benchStackCooldownMs();
    if (cooldownMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, cooldownMs));
    }
    releaseBetweenStacks();
  }
}

export async function runAllWinrkStacks(
  rows = WINRK_STACKS,
  opts?: { onProgress?: (results: WinrkBenchResult[]) => void | Promise<void> },
): Promise<WinrkBenchResult[]> {
  const results: WinrkBenchResult[] = [];
  for (const row of rows) {
    results.push(await runWinrkStack(row));
    await opts?.onProgress?.(results);
  }
  return results;
}
