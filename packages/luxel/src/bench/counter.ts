import { createTestServer } from "../test/server.ts";
import { compileCounterApp } from "../route/compile-app.ts";
import { bundleClient } from "../build/client-bundle.ts";
import { BENCH_ITERATIONS, runFetchThroughputBench } from "./competitors/throughput-harness.ts";
import { getLuxelRepoRoot } from "../paths.ts";

export async function runCounterBench(): Promise<{
  throughputRps: number;
  clientBytes: number;
  htmlBytes: number;
}> {
  const repoRoot = getLuxelRepoRoot();
  const server = await createTestServer();
  const sampleRes = await fetch(server.url);
  const sampleHtml = await sampleRes.text();
  const htmlBytes = new TextEncoder().encode(sampleHtml).byteLength;
  const { throughputRps } = await runFetchThroughputBench(server.url, BENCH_ITERATIONS);
  const app = await compileCounterApp(repoRoot);
  const genRoot = await app.writeCache();
  const { js } = await bundleClient(genRoot);
  const clientBytes = new TextEncoder().encode(js).byteLength;
  server.close();
  return { throughputRps, clientBytes, htmlBytes };
}
