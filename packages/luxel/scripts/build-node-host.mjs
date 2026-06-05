#!/usr/bin/env node
import * as esbuild from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const hostEntry = join(pkgRoot, "src/host/node-entry.ts");
const outDir = join(pkgRoot, "dist/host");
const outfile = join(outDir, "run.mjs");

mkdirSync(outDir, { recursive: true });

const result = esbuild.buildSync({
  entryPoints: [hostEntry],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile,
  packages: "external",
  logLevel: "info",
  sourcemap: false,
  loader: { ".svelte": "empty" },
});

if (result.errors.length > 0) {
  console.error(result.errors.map((e) => e.text).join("\n"));
  process.exit(1);
}

console.log(`built ${outfile}`);
