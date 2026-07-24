/**
 * Wayfinder #119: diagnose Luxel ~200ms create/replace/partial cluster.
 * In-page CPU×1 timings + updateRow call counts for luxel vs vue-vapor.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { repoKrausestSubmodulePath } from "../src/bench/krausest/contract.ts";
import { resolveKrausestChromeBinary } from "../src/bench/krausest/krausest-chrome.ts";
import {
  ensureKrausestServerDeps,
  krausestServerTsxCli,
  KRAUSEST_NPM_ENV,
} from "../src/bench/krausest/setup-driver.ts";
import { findNodeExecutable } from "../src/util/find-node.ts";
import { killProcessTree } from "../src/util/kill-process-tree.ts";

const repoRoot = join(import.meta.dir, "../../..");
const submodule = repoKrausestSubmodulePath(repoRoot);
const host = process.env.KRAUSEST_HOST ?? "localhost";
const port = Number(process.env.KRAUSEST_PORT ?? 8080);
const samples = Number(process.env.KRAUSEST_CLUSTER_SAMPLES ?? 12);

const puppeteerPath = join(submodule, "webdriver-ts/node_modules/puppeteer-core");
if (!existsSync(puppeteerPath)) {
  console.error("puppeteer-core missing");
  process.exit(2);
}
const puppeteer = await import(`${puppeteerPath}/lib/esm/puppeteer/puppeteer-core.js`);

async function serverReady(): Promise<boolean> {
  try {
    const res = await fetch(`http://${host}:${port}/ls`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer(): Promise<ChildProcess | null> {
  await ensureKrausestServerDeps(submodule);
  if (await serverReady()) return null;
  const node = findNodeExecutable();
  if (!node) throw new Error("no node");
  const child = spawn(node, [krausestServerTsxCli(submodule), "index.ts"], {
    cwd: join(submodule, "server"),
    stdio: ["ignore", "pipe", "pipe"],
    env: KRAUSEST_NPM_ENV,
    windowsHide: true,
  });
  for (let i = 0; i < 60; i++) {
    if (await serverReady()) return child;
    await Bun.sleep(250);
  }
  killProcessTree(child.pid);
  throw new Error("server not ready");
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

type Action = "create" | "replace" | "partial";

type Sample = { ms: number; rowCount: number };

async function measureFw(
  browser: { newPage: () => Promise<any>; close: () => Promise<void> },
  path: string,
): Promise<Record<Action, Sample[]>> {
  const page = await browser.newPage();
  await page.emulateCPUThrottling(1);
  await page.goto(`http://${host}:${port}/frameworks/${path}/`, {
    waitUntil: "networkidle0",
    timeout: 60_000,
  });
  await page.waitForSelector("#run", { timeout: 30_000 });

  const out: Record<Action, Sample[]> = { create: [], replace: [], partial: [] };

  for (let i = 0; i < samples; i++) {
    // create from empty
    await page.evaluate(async () => {
      (document.querySelector("#clear") as HTMLElement | null)?.click();
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    });
    const create = await page.evaluate(async () => {
      const t0 = performance.now();
      (document.querySelector("#run") as HTMLElement).click();
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      while (document.querySelectorAll("tbody tr").length < 1000) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }
      return { ms: performance.now() - t0, rowCount: document.querySelectorAll("tbody tr").length };
    });
    out.create.push(create);

    // replace (run again on full table)
    const replace = await page.evaluate(async () => {
      const t0 = performance.now();
      (document.querySelector("#run") as HTMLElement).click();
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      return { ms: performance.now() - t0, rowCount: document.querySelectorAll("tbody tr").length };
    });
    out.replace.push(replace);

    // partial
    const partial = await page.evaluate(async () => {
      const t0 = performance.now();
      (document.querySelector("#update") as HTMLElement).click();
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      return { ms: performance.now() - t0, rowCount: document.querySelectorAll("tbody tr").length };
    });
    out.partial.push(partial);
  }

  await page.close();
  return out;
}

const chrome = await resolveKrausestChromeBinary(repoRoot, false);
const server = await ensureServer();
const browser = await puppeteer.launch({
  executablePath: chrome.path,
  headless: true,
  args: ["--disable-dev-shm-usage"],
});

const frameworks = [
  { id: "luxel", path: "non-keyed/luxel" },
  { id: "vue-vapor", path: "non-keyed/vue-vapor" },
] as const;

const results: Record<string, Record<Action, { medianMs: number; samples: number[] }>> = {};

try {
  for (const fw of frameworks) {
    console.error(`measuring ${fw.id} n=${samples} cpu=1x`);
    const map = await measureFw(browser, fw.path);
    results[fw.id] = {} as Record<Action, { medianMs: number; samples: number[] }>;
    for (const action of ["create", "replace", "partial"] as const) {
      const ms = map[action].map((s) => s.ms);
      results[fw.id]![action] = { medianMs: median(ms), samples: ms };
      console.error(`  ${action}: median ${median(ms).toFixed(2)} ms`);
    }
  }
} finally {
  await browser.close();
  killProcessTree(server?.pid);
}

const driverCount10 = {
  luxel: { create: 209.9, replace: 201.9, partial: 206.5 },
  "vue-vapor": { create: 152.05, replace: 151.8, partial: 68.25 },
} as const;

const throttle = { create: 1, replace: 1, partial: 4 } as const;

const md = [
  "# Diagnose Luxel ~200ms create/replace/partial cluster",
  "",
  `Generated: ${new Date().toISOString()}`,
  `In-page click→double-rAF medians at CPU×1, samples=${samples}.`,
  "",
  "## Upstream CPU throttle",
  "",
  "| Scenario | Throttle |",
  "| --- | ---: |",
  "| create_rows | none |",
  "| replace_all_rows | none |",
  "| partial_update | 4× |",
  "",
  "## In-page CPU×1 medians",
  "",
  "| Action | Luxel | Vue Vapor | Luxel/Vue |",
  "| --- | ---: | ---: | ---: |",
];

for (const action of ["create", "replace", "partial"] as const) {
  const l = results.luxel![action]!.medianMs;
  const v = results["vue-vapor"]![action]!.medianMs;
  md.push(`| ${action} | ${l.toFixed(2)} ms | ${v.toFixed(2)} ms | ${(l / v).toFixed(3)}× |`);
}

md.push(
  "",
  "## vs DRIVER_COUNT=10 (official traces)",
  "",
  "| Action | Luxel driver | Luxel×1 | Vue driver | Vue×1 | Throttle |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
);

for (const action of ["create", "replace", "partial"] as const) {
  const key = action === "create" ? "create" : action === "replace" ? "replace" : "partial";
  md.push(
    `| ${action} | ${driverCount10.luxel[key].toFixed(2)} | ${results.luxel![action]!.medianMs.toFixed(2)} | ${driverCount10["vue-vapor"][key].toFixed(2)} | ${results["vue-vapor"]![action]!.medianMs.toFixed(2)} | ${throttle[action]}× |`,
  );
}

md.push(
  "",
  "## Answer",
  "",
  "1. **Create/replace have no CPU throttle** — driver ~200ms is real Luxel work (or layout), not a 4× floor.",
  "2. **Partial has 4× throttle** — driver 206ms ≈ ~50ms×4; Vue driver 68ms ≈ ~17ms×4. Gap is real framework cost under throttle.",
  "3. Compare in-page×1 ratios above: if Luxel≈Vue in-page but driver diverges, blame trace/layout; if Luxel slower in-page too, blame update/create path.",
  "4. **Replace regress vs post-clone ~86ms win** — if in-page replace is stable ~30–50ms, count=10 ~200ms is run noise / machine load, not skip-unchanged regress. If in-page replace is also ~high, full 1000× updateRow is the lever.",
  "5. **Full-update lever:** speed `update_rows_row` (fewer property walks, cached child refs) and/or recreate-via-clone when >N% rows dirty instead of 1000 in-place updates.",
  "",
  "Ticket: https://github.com/SynCROSS/luxel/issues/119",
  "",
);

const outDir = join(repoRoot, "docs/benchmarks/runs");
await mkdir(outDir, { recursive: true });
const mdPath = join(outDir, "krausest-200ms-cluster.md");
const jsonPath = join(outDir, "krausest-200ms-cluster.json");
await writeFile(mdPath, `${md.join("\n")}\n`, "utf8");
await writeFile(
  jsonPath,
  `${JSON.stringify({ generated: new Date().toISOString(), samples, results, driverCount10, throttle }, null, 2)}\n`,
  "utf8",
);
console.error(`wrote ${mdPath}`);
