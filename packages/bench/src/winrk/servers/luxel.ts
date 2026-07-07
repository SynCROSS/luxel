import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

import {
  buildApp,
  createBenchServer,
  createIsrBenchServer,
  createTestServer,
  getLuxelRepoRoot,
  htmlBodyHeaders,
  isLuxelCoreNodeLoadable,
  prepareLuxelSpiralNativeBench,
  prepareLuxelCounterNativeBench,
} from "@luxel/luxel/bench";
import { createFetchServer, type BenchServer } from "../http-server.ts";

type CounterBenchOpts = {
  ssrBackend?: "ts" | "native" | "auto";
  benchFullRender?: boolean;
  benchNativeLab?: boolean;
};

async function startLuxelCounterBenchServer(opts: CounterBenchOpts = {}): Promise<BenchServer> {
  const ssrBackend = opts.ssrBackend ?? "auto";
  if (ssrBackend === "native" || (ssrBackend === "auto" && isLuxelCoreNodeLoadable())) {
    await prepareLuxelCounterNativeBench();
  }
  return createTestServer(0, {
    benchSlimFetch: true,
    benchMinimalHtml: false,
    benchFullRender: opts.benchFullRender ?? false,
    benchNativeLab: opts.benchNativeLab ?? false,
    ...(ssrBackend === "auto" ? {} : { routeSsrBackends: { "/": ssrBackend } }),
  });
}

export async function startLuxelSsrServer(): Promise<BenchServer> {
  return startLuxelCounterBenchServer({ benchFullRender: false });
}

export async function startLuxelSsrFullServer(): Promise<BenchServer> {
  return startLuxelCounterBenchServer({ benchFullRender: true });
}

/** Counter luxel-core native SSR with compile precompute when loadable. */
export async function startLuxelSsrNativeServer(): Promise<BenchServer> {
  return startLuxelCounterBenchServer({
    ssrBackend: "native",
    benchFullRender: false,
    benchNativeLab: false,
  });
}

type SpiralBenchOpts = {
  ssrBackend?: "ts" | "native";
  benchFullRender?: boolean;
  benchNativeLab?: boolean;
};

async function startLuxelSpiralBenchServer(opts: SpiralBenchOpts = {}): Promise<BenchServer> {
  const ssrBackend = opts.ssrBackend ?? "native";
  if (ssrBackend === "native") {
    await prepareLuxelSpiralNativeBench();
  }
  return createBenchServer("spiral", 0, {
    benchFullRender: opts.benchFullRender ?? false,
    benchNativeLab: opts.benchNativeLab ?? false,
    routeSsrBackends: { "/": ssrBackend },
    benchSlimFetch: true,
    benchMinimalHtml: true,
  });
}

/** Spiral tier-2 — auto native when core-node loadable; per-request tile load (fairness.md). */
export async function startLuxelSpiralSsrServer(): Promise<BenchServer> {
  return startLuxelSpiralBenchServer({ benchFullRender: false });
}

export async function startLuxelSpiralSsrFullServer(): Promise<BenchServer> {
  return startLuxelSpiralBenchServer({ ssrBackend: "native", benchFullRender: true });
}

/** Spiral luxel-core native SSR — per-request native with compile-time hot body. */
export async function startLuxelSpiralSsrNativeServer(): Promise<BenchServer | null> {
  try {
    return await startLuxelSpiralBenchServer({
      ssrBackend: "native",
      benchFullRender: false,
      benchNativeLab: false,
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
    return createCachedStaticCounterServer(join(outDir, "static"));
  }
  return createCachedStaticCounterServer(staticRoot);
}

async function createCachedStaticCounterServer(staticRoot: string): Promise<BenchServer> {
  const indexPath = join(staticRoot, "index.html");
  const indexBody = await readFile(indexPath);
  const indexHeaders = htmlBodyHeaders(indexBody);
  return createFetchServer(async (req) => {
    const path = new URL(req.url).pathname;
    if (path === "/" || path === "/index.html") {
      return new Response(indexBody, { headers: indexHeaders });
    }
    try {
      const filePath = join(staticRoot, path.replace(/^\//, ""));
      const body = await readFile(filePath);
      const ext = filePath.slice(filePath.lastIndexOf("."));
      const mime =
        ext === ".js"
          ? "text/javascript; charset=utf-8"
          : ext === ".css"
            ? "text/css; charset=utf-8"
            : "application/octet-stream";
      return new Response(body, {
        headers: { "content-type": mime, "content-length": String(body.byteLength) },
      });
    } catch {
      return new Response("not found", { status: 404 });
    }
  });
}

export async function startLuxelIsrServer(): Promise<BenchServer> {
  return createIsrBenchServer();
}

export { createBenchServer };
