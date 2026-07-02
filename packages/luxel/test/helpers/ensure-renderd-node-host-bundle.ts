import * as esbuild from "esbuild";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getLuxelPkgSrc } from "../../src/paths.ts";

const BUNDLE_STAMP = "renderd-node-host-v1";

export function ensureRenderdNodeHostBundle(): string {
  const out = join(getLuxelPkgSrc(), "../.cache/renderd/node-host-child.mjs");
  const stamp = join(dirname(out), "node-host-stamp.txt");
  const entry = join(getLuxelPkgSrc(), "../test/helpers/renderd-node-host-child.ts");
  if (existsSync(out) && existsSync(stamp) && readFileSync(stamp, "utf8") === BUNDLE_STAMP) {
    const bundleMtime = statSync(out).mtimeMs;
    if (statSync(entry).mtimeMs <= bundleMtime) return out;
  }
  mkdirSync(dirname(out), { recursive: true });
  const result = esbuild.buildSync({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    outfile: out,
    packages: "external",
    logLevel: "silent",
  });
  if (result.errors.length > 0) {
    throw new Error(result.errors.map((e) => e.text).join("\n"));
  }
  writeFileSync(stamp, BUNDLE_STAMP, "utf8");
  return out;
}
