#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildApp } from "./build/build-app.ts";
import { devApp } from "./dev/serve.ts";
import { runCounterBench } from "./bench/counter.ts";

const cmd = process.argv[2];
const repoRoot = findRepoRoot(process.cwd());

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "package.json")) && existsSync(join(dir, "CONTEXT-MAP.md"))) {
      return dir;
    }
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

async function main() {
  const appDir = "examples/counter";

  if (cmd === "build") {
    const out = await buildApp(repoRoot, appDir);
    console.log(`built ${out}`);
    return;
  }

  if (cmd === "dev") {
    const { url } = await devApp(repoRoot, appDir);
    console.log(`luxel dev ${url}`);
    await new Promise(() => {});
  }

  if (cmd === "bench") {
    const { throughputRps, clientBytes } = await runCounterBench();
    console.log(`counter SSR throughput: ${throughputRps.toFixed(0)} req/s`);
    console.log(`counter client JS size: ${clientBytes} bytes`);
    return;
  }

  console.error("usage: luxel <dev|build|bench>");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
