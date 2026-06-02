import { createTestServer } from "../test/server.ts";
import { compileCounterApp } from "../route/compile-app.ts";
import { bundleClient } from "../build/client-bundle.ts";
import { join } from "node:path";

export async function runCounterBench(): Promise<{ throughputRps: number; clientBytes: number }> {
  const repoRoot = join(import.meta.dir, "../../../..");
  const server = await createTestServer();
  const iterations = 500;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const res = await fetch(server.url);
    if (!res.ok) throw new Error(`bench request failed: ${res.status}`);
    await res.text();
  }
  const elapsedMs = performance.now() - start;
  const throughputRps = (iterations / elapsedMs) * 1000;
  const app = await compileCounterApp(repoRoot);
  const genRoot = await app.writeCache();
  const { js } = await bundleClient(genRoot);
  const clientBytes = new TextEncoder().encode(js).byteLength;
  server.close();
  return { throughputRps, clientBytes };
}
