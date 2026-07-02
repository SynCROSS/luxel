import * as esbuild from "esbuild";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getLuxelPkgSrc } from "../paths.ts";

const BUNDLE_STAMP = "renderd-node-child-v2-schema-stream";
const RENDERD_SOURCE_PATHS = [
  "renderd/renderd-entry.ts",
  "renderd/binary-protocol.ts",
  "renderd/luxel-data-stream.ts",
  "schema/stream-parser.ts",
  "schema/validate.ts",
  "schema/types.ts",
  "schema/stats.ts",
  "resource-store/luxel-data.ts",
  "resource-store/types.ts",
  "ipc/custom-frame.ts",
  "bench/ensure-core-node.ts",
  "luxel-core/native-route-document.ts",
  "paths.ts",
];

function pkgCacheDir(): string {
  return join(getLuxelPkgSrc(), "../.cache/renderd");
}

function bundlePath(): string {
  return join(pkgCacheDir(), "entry.mjs");
}

function stampPath(): string {
  return join(pkgCacheDir(), "stamp.txt");
}

function needsRebuild(): boolean {
  const out = bundlePath();
  const stamp = stampPath();
  if (!existsSync(out) || !existsSync(stamp)) return true;
  if (readFileSync(stamp, "utf8") !== BUNDLE_STAMP) return true;
  const bundleMtime = statSync(out).mtimeMs;
  const srcRoot = getLuxelPkgSrc();
  return RENDERD_SOURCE_PATHS.some((rel) => {
    const path = join(srcRoot, rel);
    return existsSync(path) && statSync(path).mtimeMs > bundleMtime;
  });
}

export function ensureRenderdNodeBundle(): string {
  const out = bundlePath();
  if (!needsRebuild()) return out;

  mkdirSync(dirname(out), { recursive: true });
  const entry = join(getLuxelPkgSrc(), "renderd/renderd-entry.ts");
  const result = esbuild.buildSync({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    outfile: out,
    packages: "external",
    logLevel: "silent",
    sourcemap: false,
  });
  if (result.errors.length > 0) {
    throw new Error(result.errors.map((e) => e.text).join("\n"));
  }
  writeFileSync(stampPath(), BUNDLE_STAMP, "utf8");
  return out;
}
