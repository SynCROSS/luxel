import { join } from "node:path";
import { existsSync } from "node:fs";

import {
  buildApp,
  createBenchServer,
  createIsrBenchServer,
  createTestServer,
  getLuxelRepoRoot,
  prepareLuxelSpiralNativeBench,
  prepareLuxelCounterNativeBench,
} from "@luxel/luxel/bench";
import { createStaticServer, type BenchServer } from "../http-server.ts";

type CounterBenchOpts = {
  ssrBackend?: "ts" | "native";
  benchFullRender?: boolean;
  benchNativeLab?: boolean;
};

async function startLuxelCounterBenchServer(opts: CounterBenchOpts = {}): Promise<BenchServer> {
  const ssrBackend = opts.ssrBackend ?? "ts";
  if (ssrBackend === "native") {
    await prepareLuxelCounterNativeBench();
  }
  return createTestServer(0, {
    benchFullRender: opts.benchFullRender ?? false,
    benchNativeLab: opts.benchNativeLab ?? false,
    routeSsrBackends: { "/": ssrBackend },
  });
}

export async function startLuxelSsrServer(): Promise<BenchServer> {
  return startLuxelCounterBenchServer({ ssrBackend: "ts", benchFullRender: false });
}

export async function startLuxelSsrFullServer(): Promise<BenchServer> {
  return startLuxelCounterBenchServer({ ssrBackend: "ts", benchFullRender: true });
}

/** Counter luxel-core native SSR (opt-in row until native ≥ TS on WinRK). */
export async function startLuxelSsrNativeServer(): Promise<BenchServer> {
  return startLuxelCounterBenchServer({
    ssrBackend: "native",
    benchFullRender: false,
    benchNativeLab: true,
  });
}

type SpiralBenchOpts = {
  ssrBackend?: "ts" | "native";
  benchFullRender?: boolean;
  benchNativeLab?: boolean;
};

async function startLuxelSpiralBenchServer(opts: SpiralBenchOpts = {}): Promise<BenchServer> {
  const ssrBackend = opts.ssrBackend;
  if (ssrBackend === "native") {
    await prepareLuxelSpiralNativeBench();
  }
  return createBenchServer("spiral", 0, {
    benchFullRender: opts.benchFullRender ?? false,
    benchNativeLab: opts.benchNativeLab ?? false,
    ...(ssrBackend ? { routeSsrBackends: { "/": ssrBackend } } : {}),
    benchSlimFetch: true,
    benchMinimalHtml: true,
  });
}

/** Spiral tier-2 — auto native when core-node loadable; per-request tile load (fairness.md). */
export async function startLuxelSpiralSsrServer(): Promise<BenchServer> {
  return startLuxelSpiralBenchServer({ benchFullRender: false });
}

export async function startLuxelSpiralSsrFullServer(): Promise<BenchServer> {
  return startLuxelSpiralBenchServer({ ssrBackend: "ts", benchFullRender: true });
}

/** Spiral luxel-core native SSR lab row — per-request native bisect. */
export async function startLuxelSpiralSsrNativeServer(): Promise<BenchServer | null> {
  try {
    return await startLuxelSpiralBenchServer({
      ssrBackend: "native",
      benchFullRender: false,
      benchNativeLab: true,
    });
  } catch {
    return null;
  }
}

/** @deprecated use startLuxelSpiralSsrNativeServer */
export const startLuxelSpiralSsrTsServer = startLuxelSpiralSsrNativeServer;

export async function startLuxelCsrServer(): Promise<BenchServer> {
  const repoRoot = getLuxelRepoRoot();
  const staticRoot = join(repoRoot, "examples/counter/dist/static");
  if (!existsSync(join(staticRoot, "index.html"))) {
    const outDir = await buildApp(repoRoot, "examples/counter");
    return createStaticServer(join(outDir, "static"));
  }
  return createStaticServer(staticRoot);
}

export async function startLuxelIsrServer(): Promise<BenchServer> {
  return createIsrBenchServer();
}

export { createBenchServer };
