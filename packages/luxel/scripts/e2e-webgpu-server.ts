#!/usr/bin/env bun
import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { getLuxelPkgSrc } from "../src/paths.ts";

const port = Number(process.env.LUXEL_E2E_WEBGPU_PORT ?? 4175);
const cacheDir = join(getLuxelPkgSrc(), "../.cache/e2e-webgpu");
const harnessOut = join(cacheDir, "harness.js");
const harnessEntry = join(getLuxelPkgSrc(), "client-gpu/browser-parity.harness.ts");

mkdirSync(cacheDir, { recursive: true });

const built = esbuild.buildSync({
  entryPoints: [harnessEntry],
  bundle: true,
  format: "iife",
  globalName: "LuxelWebgpuHarness",
  platform: "browser",
  target: ["chrome100"],
  outfile: harnessOut,
  logLevel: "silent",
});
if (built.errors.length > 0) {
  console.error(built.errors.map((e) => e.text).join("\n"));
  process.exit(1);
}

const harnessJs = readFileSync(harnessOut, "utf8");
const buildStamp = new Date().toISOString();

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>luxel spiral client GPU</title>
<!-- luxel-webgpu-harness ${buildStamp} -->
<style>
#wrapper { position: relative; width: 960px; height: 720px; }
.tile { position: absolute; width: 10px; height: 10px; background: #333; }
</style>
</head>
<body>
<div id="wrapper"></div>
<script>${harnessJs}</script>
<script>window.__luxelWebgpuParity = () => LuxelWebgpuHarness.runWebgpuSpiralParityInBrowser();</script>
</body>
</html>`;

createServer((req, res) => {
  const path = req.url?.split("?")[0] ?? "/";
  if (path === "/" || path === "/index.html") {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(html);
    return;
  }
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("not found");
}).listen(port, "127.0.0.1", () => {
  console.log(`webgpu e2e harness http://127.0.0.1:${port}`);
});
