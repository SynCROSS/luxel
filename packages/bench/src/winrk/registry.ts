import { runWinrk } from "./run.ts";
import type { WinrkStats } from "./parse.ts";
import type { BenchServer } from "./http-server.ts";
import { startReactSsrServer, startVueSsrServer, startSolidSsrServer, startSvelteSsrServer, startVueVaporServer } from "./servers/inline-ssr.ts";
import {
  startReactSpiralSsrServer,
  startVueSpiralSsrServer,
  startVueVaporSpiralSsrServer,
  startSolidSpiralSsrServer,
  startSvelteSpiralSsrServer,
} from "./servers/inline-ssr-spiral.ts";
import { startLuxelSsrServer, startLuxelCsrServer, startLuxelIsrServer, startLuxelSpiralSsrServer } from "./servers/luxel.ts";
import {
  startReactCsrServer,
  startVueCsrServer,
  startVueVaporCsrServer,
  startSolidCsrServer,
  startSvelteCsrServer,
  startReactRscServer,
  startSolidStartSsrServer,
  startSvelteKitSsrServer,
  startSvelteKitIsrServer,
} from "./servers/framework.ts";

export type StackRow = {
  id: string;
  framework: string;
  mode: "csr" | "ssr" | "rsc" | "isr";
  version?: string;
  start: () => Promise<BenchServer | null>;
  pendingReason?: string;
};

export const WINRK_COUNTER_STACKS: StackRow[] = [
  { id: "react-csr", framework: "react", mode: "csr", version: ">=19", start: startReactCsrServer, pendingReason: "run bun run build in packages/bench/competitors" },
  { id: "react-ssr", framework: "react", mode: "ssr", version: ">=19", start: startReactSsrServer },
  { id: "react-rsc", framework: "react", mode: "rsc", version: ">=19", start: startReactRscServer, pendingReason: "run competitors build (next.js)" },
  { id: "vue-vdom-csr", framework: "vue-vdom", mode: "csr", version: ">=3.5", start: startVueCsrServer, pendingReason: "run competitors build" },
  { id: "vue-vapor-csr", framework: "vue-vapor", mode: "csr", version: ">=3.6", start: startVueVaporCsrServer, pendingReason: "run competitors build (vue-vapor-csr)" },
  { id: "solid-csr", framework: "solid", mode: "csr", version: ">=1.9", start: startSolidCsrServer, pendingReason: "run competitors build" },
  { id: "solidstart-ssr", framework: "solidstart", mode: "ssr", version: ">=1", start: startSolidStartSsrServer, pendingReason: "run competitors build (solidstart)" },
  { id: "svelte-csr", framework: "svelte", mode: "csr", version: ">=5.56", start: startSvelteCsrServer, pendingReason: "run competitors build" },
  { id: "sveltekit-ssr", framework: "sveltekit", mode: "ssr", version: ">=2.63", start: startSvelteKitSsrServer, pendingReason: "run competitors build (sveltekit)" },
  { id: "sveltekit-isr", framework: "sveltekit", mode: "isr", version: ">=2.63", start: startSvelteKitIsrServer, pendingReason: "run competitors build (sveltekit-isr)" },
  { id: "luxel-csr", framework: "luxel", mode: "csr", start: startLuxelCsrServer },
  { id: "luxel-ssr", framework: "luxel", mode: "ssr", start: startLuxelSsrServer },
  { id: "luxel-isr", framework: "luxel", mode: "isr", start: startLuxelIsrServer },
];

/** Tier-2 Platformatic spiral — per-request SSR only (see docs/benchmarks/ssr-showdown.md). */
export const WINRK_SPIRAL_STACKS: StackRow[] = [
  { id: "luxel-spiral-ssr", framework: "luxel", mode: "ssr", start: startLuxelSpiralSsrServer },
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
      version?: string;
      status: "ok";
      url: string;
      requestsPerSec: number;
      latencyAvgMs?: number;
      transferPerSec?: string;
      winrk: WinrkStats;
    }
  | {
      id: string;
      framework: string;
      mode: string;
      version?: string;
      status: "pending" | "error";
      reason: string;
    };

export async function runWinrkStack(row: StackRow): Promise<WinrkBenchResult> {
  let server: BenchServer | null = null;
  try {
    server = await row.start();
    if (!server) {
      return {
        id: row.id,
        framework: row.framework,
        mode: row.mode,
        version: row.version,
        status: "pending",
        reason: row.pendingReason ?? "server not available",
      };
    }
    const probe = await fetch(server.url);
    if (!probe.ok) throw new Error(`probe failed: ${probe.status}`);
    const winrk = await runWinrk({ url: server.url });
    return {
      id: row.id,
      framework: row.framework,
      mode: row.mode,
      version: row.version,
      status: "ok",
      url: server.url,
      requestsPerSec: winrk.requestsPerSec,
      latencyAvgMs: winrk.latencyAvgMs,
      transferPerSec: winrk.transferPerSec,
      winrk,
    };
  } catch (err) {
    return {
      id: row.id,
      framework: row.framework,
      mode: row.mode,
      version: row.version,
      status: "error",
      reason: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (server) await server.close();
  }
}

export async function runAllWinrkStacks(rows = WINRK_STACKS): Promise<WinrkBenchResult[]> {
  const results: WinrkBenchResult[] = [];
  for (const row of rows) {
    results.push(await runWinrkStack(row));
  }
  return results;
}
