#!/usr/bin/env node
/**
 * Native Node entry (v1.1). Uses shipped dist/host bundle when present; dev self-bundles to .cache.
 */
import * as esbuild from "esbuild";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const binDir = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(binDir, "..");
const pkgSrc = join(pkgRoot, "src");
const prebuiltPath = join(pkgRoot, "dist/host/run.mjs");
const hostEntry = join(pkgSrc, "host/node-entry.ts");
const devBundlePath = join(pkgRoot, ".cache/node-host/run.mjs");
const bundleStampPath = join(pkgRoot, ".cache/node-host/stamp.txt");
const BUNDLE_STAMP = "external-pkgs-v14-third-party-wire";
const HOST_SOURCE_PATHS = [
  hostEntry,
  join(pkgSrc, "host/host-runtime.ts"),
  join(pkgSrc, "host/native-host.ts"),
  join(pkgSrc, "host/backends/esbuild-backend.ts"),
  join(pkgSrc, "build/build-app.ts"),
  join(pkgSrc, "compiler/compile-route.ts"),
  join(pkgSrc, "config/load.ts"),
  join(pkgSrc, "config/native-mode.ts"),
  join(pkgSrc, "config/native-runtime.ts"),
  join(pkgSrc, "bench/boundary.ts"),
  join(pkgSrc, "bench/ipc/bench.ts"),
  join(pkgSrc, "renderd/spawn.ts"),
  join(pkgSrc, "renderd/client.ts"),
  join(pkgSrc, "ipc/custom-frame.ts"),
  join(pkgSrc, "schema/stream-parser.ts"),
  join(pkgSrc, "schema/validate.ts"),
  join(pkgSrc, "schema/third-party.ts"),
  join(pkgSrc, "schema/string-cache.ts"),
  join(pkgSrc, "schema/sidecar-ingest.ts"),
  join(pkgSrc, "config/native-schemas.ts"),
  join(pkgSrc, "schema/bench.ts"),
  join(pkgSrc, "renderd/luxel-data-stream.ts"),
  join(pkgSrc, "renderd/client.ts"),
  join(pkgSrc, "dev/serve.ts"),
  join(pkgSrc, "http/listen-fetch.ts"),
  join(pkgSrc, "paths.ts"),
];

function needsDevRebuild() {
  if (!existsSync(devBundlePath) || !existsSync(bundleStampPath)) return true;
  if (readFileSync(bundleStampPath, "utf8") !== BUNDLE_STAMP) return true;
  const bundleMtime = statSync(devBundlePath).mtimeMs;
  return HOST_SOURCE_PATHS.some((path) => existsSync(path) && statSync(path).mtimeMs > bundleMtime);
}

function ensureDevHostBundle() {
  if (!needsDevRebuild()) return;
  mkdirSync(dirname(devBundlePath), { recursive: true });
  const result = esbuild.buildSync({
    entryPoints: [hostEntry],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    outfile: devBundlePath,
    packages: "external",
    logLevel: "silent",
    sourcemap: false,
    loader: { ".svelte": "empty" },
    banner: {
      js: 'import * as React from "react";',
    },
  });
  if (result.errors.length > 0) {
    throw new Error(result.errors.map((e) => e.text).join("\n"));
  }
  writeFileSync(bundleStampPath, BUNDLE_STAMP, "utf8");
}

function hostSourcesStaleComparedTo(bundlePath) {
  if (!existsSync(bundlePath)) return true;
  const bundleMtime = statSync(bundlePath).mtimeMs;
  return HOST_SOURCE_PATHS.some((path) => existsSync(path) && statSync(path).mtimeMs > bundleMtime);
}

function resolveBundlePath() {
  if (existsSync(prebuiltPath) && !hostSourcesStaleComparedTo(prebuiltPath)) {
    return prebuiltPath;
  }
  ensureDevHostBundle();
  return devBundlePath;
}

const bundlePath = resolveBundlePath();

const { runLuxelNode } = await import(pathToFileURL(bundlePath).href);
const code = await runLuxelNode(process.argv.slice(2), { pkgSrc });
process.exit(code);
