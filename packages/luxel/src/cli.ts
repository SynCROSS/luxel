#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildApp } from "./build/build-app.ts";
import { devApp } from "./dev/serve.ts";
import { evaluateBenchGate } from "./bench/gate.ts";
import { runBenchRegistry } from "./bench/registry.ts";
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
    const { url, appDir: served } = await devApp(repoRoot, appDir, {
      port: Number(process.env.PORT ?? "3000"),
    });
    console.log(`luxel dev ${url} (${served})`);
    await new Promise(() => {});
  }

  if (cmd === "bench") {
    const gateMode = process.argv.includes("--gate");
    const skipInp =
      process.env.LUXEL_BENCH_SKIP_INP === "1" || process.env.LUXEL_BENCH_SKIP_INP === "true";
    const benchLines: string[] = [];
    const parsed: Parameters<typeof evaluateBenchGate>[0] = [];
    for await (const line of runBenchRegistry({ skipInp })) {
      const json = JSON.stringify(line);
      console.log(json);
      benchLines.push(json);
      parsed.push(line);
    }
    const gate = evaluateBenchGate(parsed);
    const gateJson = JSON.stringify(gate);
    console.log(gateJson);
    benchLines.push(gateJson);
    const out = process.env.LUXEL_BENCH_OUT;
    if (out) {
      await writeFile(out, `${benchLines.join("\n")}\n`, "utf8");
    }
    if (gateMode && !gate.ok) {
      process.exit(1);
    }
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

  console.error("usage: luxel <dev|build|bench [--gate]|serve>");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
