#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildApp } from "./build/build-app.ts";
import { devApp } from "./dev/serve.ts";
import { runCounterBench } from "./bench/counter.ts";
import { resolveAppDir } from "./config/resolve-app.ts";
import { serveProd } from "./serve-prod.ts";

const cmd = process.argv[2];
const cwd = process.cwd();
const repoRoot = findRepoRoot(cwd);
const appDir = resolveAppDir(cwd, repoRoot);

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
  if (cmd === "build") {
    const out = await buildApp(repoRoot, appDir);
    console.log(`built ${out} (${appDir})`);
    return;
  }

  if (cmd === "dev") {
    const { url, appDir: served } = await devApp(repoRoot, appDir);
    console.log(`luxel dev ${url} (${served})`);
    await new Promise(() => {});
  }

  if (cmd === "bench") {
    const { throughputRps, clientBytes } = await runCounterBench();
    console.log(`counter SSR throughput: ${throughputRps.toFixed(0)} req/s`);
    console.log(`counter client JS size: ${clientBytes} bytes`);
    return;
  }

  if (cmd === "serve") {
    const runtime = process.argv[3];
    if (runtime !== "node" && runtime !== "deno") {
      console.error("usage: luxel serve <node|deno>");
      process.exit(1);
    }
    await serveProd(repoRoot, appDir, runtime);
    return;
  }

  console.error("usage: luxel <dev|build|bench|serve>");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
