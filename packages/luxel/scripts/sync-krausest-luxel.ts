import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import * as esbuild from "esbuild";
import {
  serializeLuxelData,
  serializeLuxelHydration,
  type TemplateBinding,
} from "../src/resource-store/luxel-data.ts";

const repoRoot = join(import.meta.dir, "../../..");
const exampleDir = join(repoRoot, "examples/krausest-table");
const submoduleLuxel = join(repoRoot, "vendor/js-framework-benchmark/frameworks/non-keyed/luxel");
const templateDir = join(repoRoot, "packages/luxel/templates/krausest-non-keyed");

function krausestShellHtml(dataScript: string, hydrationScript: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Luxel</title>
  <link href="/css/currentStyle.css" rel="stylesheet"/>
</head>
<body>
<main data-luxel-route="/">
<!-- luxel:boundary-start id="boundary:0" directive="load" -->
<div id="main">
  <div class="container">
    <div class="jumbotron">
      <div class="row">
        <div class="col-md-6"><h1>Luxel</h1></div>
        <div class="col-md-6">
          <div class="row">
            <div class="col-sm-6 smallpad"><button type="button" class="btn btn-primary btn-block" id="run" data-luxel-click="run">Create 1,000 rows</button></div>
            <div class="col-sm-6 smallpad"><button type="button" class="btn btn-primary btn-block" id="runlots" data-luxel-click="runLots">Create 10,000 rows</button></div>
            <div class="col-sm-6 smallpad"><button type="button" class="btn btn-primary btn-block" id="add" data-luxel-click="add">Append 1,000 rows</button></div>
            <div class="col-sm-6 smallpad"><button type="button" class="btn btn-primary btn-block" id="update" data-luxel-click="update">Update every 10th row</button></div>
            <div class="col-sm-6 smallpad"><button type="button" class="btn btn-primary btn-block" id="clear" data-luxel-click="clearRows">Clear</button></div>
            <div class="col-sm-6 smallpad"><button type="button" class="btn btn-primary btn-block" id="swaprows" data-luxel-click="swapRows">Swap Rows</button></div>
          </div>
        </div>
      </div>
    </div>
    <table class="table table-hover table-striped test-data">
      <tbody data-luxel-each="rows"></tbody>
    </table>
    <span class="preloadicon glyphicon glyphicon-remove" aria-hidden="true"></span>
  </div>
</div>
<!-- luxel:boundary-end id="boundary:0" -->
</main>
<script type="application/json" id="luxel-data">${dataScript}</script>
<script type="application/json" id="luxel-hydration">${hydrationScript}</script>
<script type="module" src="assets/client.dev0.js"></script>
</body>
</html>`;
}

async function main(): Promise<void> {
  if (!existsSync(join(repoRoot, "vendor/js-framework-benchmark"))) {
    console.error("missing vendor/js-framework-benchmark — run: git submodule update --init");
    process.exit(1);
  }

  const proc = Bun.spawn(["bun", "run", "build"], {
    cwd: exampleDir,
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) process.exit(code);

  const dist = join(exampleDir, "dist");
  const manifest = JSON.parse(await readFile(join(dist, "manifest.json"), "utf8")) as {
    routes: Array<{
      id: string;
      path: string;
      bindings: TemplateBinding[];
      hydration: Array<{ id: string; directive: string }>;
      clientModule: string;
    }>;
  };
  const route = manifest.routes[0];
  if (!route) throw new Error("krausest-table manifest missing route");

  const dataScript = serializeLuxelData({});
  const hydrationScript = serializeLuxelHydration({
    routeId: route.id,
    bindings: [],
    boundaries: route.hydration.map((boundary) => ({
      id: boundary.id,
      directive: boundary.directive,
      clientModule: route.clientModule,
    })),
  });

  await rm(submoduleLuxel, { recursive: true, force: true });
  await mkdir(join(submoduleLuxel, "assets"), { recursive: true });
  // Minify client for krausest size/memory/first-paint (#126) — example build ships unminified.
  const clientRaw = await readFile(join(dist, "assets", "client.dev0.js"), "utf8");
  const clientMin = await esbuild.transform(clientRaw, {
    minify: true,
    target: "es2020",
    legalComments: "none",
  });
  await writeFile(join(submoduleLuxel, "assets/client.dev0.js"), clientMin.code);
  await cp(join(templateDir, "package.json"), join(submoduleLuxel, "package.json"));
  await cp(join(templateDir, "package-lock.json"), join(submoduleLuxel, "package-lock.json"));
  await writeFile(join(submoduleLuxel, "index.html"), krausestShellHtml(dataScript, hydrationScript), "utf8");
  console.log(
    `synced krausest CSR shell -> ${submoduleLuxel} (client ${clientRaw.length} -> ${clientMin.code.length} bytes)`,
  );
}

await main();
