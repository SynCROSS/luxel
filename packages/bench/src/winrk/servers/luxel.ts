import { join } from "node:path";
import { existsSync } from "node:fs";
import {
  buildApp,
  createBenchServer,
  createIsrBenchServer,
  createTestServer,
  getLuxelRepoRoot,
} from "@luxel/luxel/bench";
import { createStaticServer, type BenchServer } from "../http-server.ts";

export async function startLuxelSsrServer(): Promise<BenchServer> {
  return createTestServer();
}

export async function startLuxelSpiralSsrServer(): Promise<BenchServer> {
  return createBenchServer("spiral");
}

export async function startLuxelCsrServer(): Promise<BenchServer> {
  const repoRoot = getLuxelRepoRoot();
  const staticRoot = join(repoRoot, "examples/counter/dist/static/about");
  if (!existsSync(join(staticRoot, "index.html"))) {
    const outDir = await buildApp(repoRoot, join(repoRoot, "examples/counter"));
    return createStaticServer(join(outDir, "static", "about"));
  }
  return createStaticServer(staticRoot);
}

export async function startLuxelIsrServer(): Promise<BenchServer> {
  return createIsrBenchServer();
}

export { createBenchServer };
