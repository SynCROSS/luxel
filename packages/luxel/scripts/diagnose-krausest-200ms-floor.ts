/**
 * Wayfinder #109: is ~200ms on select/swap/remove/clear a Luxel floor or throttle/measure?
 * Measures in-page click→rAF durations at CPU×1 for luxel + vue-vapor.
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
const puppeteerPath = join(submodule, "webdriver-ts/node_modules/puppeteer-core");
if (!existsSync(puppeteerPath)) {
  console.error("puppeteer-core missing — setup driver first");
  process.exit(2);
}
const puppeteer = await import(`${puppeteerPath}/lib/esm/puppeteer/puppeteer-core.js`);

const host = process.env.KRAUSEST_HOST ?? "localhost";
const port = Number(process.env.KRAUSEST_PORT ?? 8080);
const samples = Number(process.env.KRAUSEST_FLOOR_SAMPLES ?? 20);

const FRAMEWORKS = [
  { id: "luxel", path: "non-keyed/luxel" },
  { id: "vue-vapor", path: "non-keyed/vue-vapor" },
] as const;

const ACTIONS = ["select", "swap", "remove", "clear"] as const;

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

type SampleMap = Record<(typeof ACTIONS)[number], number[]>;

async function measureFramework(
  browser: { newPage: () => Promise<any>; close: () => Promise<void> },
  frameworkPath: string,
): Promise<SampleMap> {
  const page = await browser.newPage();
  await page.emulateCPUThrottling(1);
  const url = `http://${host}:${port}/frameworks/${frameworkPath}/`;
  await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
  await page.waitForSelector("#run", { timeout: 30_000 });
  await page.click("#run");
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length >= 1000, {
    timeout: 30_000,
  });

  const out: SampleMap = { select: [], swap: [], remove: [], clear: [] };

  for (let i = 0; i < samples; i++) {
    // ensure 1000 rows before each action except after clear
    const n = await page.evaluate(() => document.querySelectorAll("tbody tr").length);
    if (n < 1000) {
      await page.click("#run");
      await page.waitForFunction(() => document.querySelectorAll("tbody tr").length >= 1000, {
        timeout: 30_000,
      });
    }

    const selectMs = await page.evaluate(async () => {
      const a = document.querySelector("tbody tr:nth-child(500) td.col-md-4 a") as HTMLAnchorElement | null;
      if (!a) return -1;
      const t0 = performance.now();
      a.click();
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      return performance.now() - t0;
    });
    out.select.push(selectMs);

    const swapMs = await page.evaluate(async () => {
      const btn = document.querySelector("#swaprows") as HTMLButtonElement | null;
      if (!btn) return -1;
      const t0 = performance.now();
      btn.click();
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      return performance.now() - t0;
    });
    out.swap.push(swapMs);

    const removeMs = await page.evaluate(async () => {
      const a = document.querySelector("tbody tr:nth-child(2) td.col-md-1 a .glyphicon-remove")
        ?.closest("a") as HTMLAnchorElement | null;
      if (!a) return -1;
      const t0 = performance.now();
      a.click();
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      return performance.now() - t0;
    });
    out.remove.push(removeMs);

    // restore row count after remove
    await page.click("#run");
    await page.waitForFunction(() => document.querySelectorAll("tbody tr").length >= 1000, {
      timeout: 30_000,
    });

    const clearMs = await page.evaluate(async () => {
      const btn = document.querySelector("#clear") as HTMLButtonElement | null;
      if (!btn) return -1;
      const t0 = performance.now();
      btn.click();
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      return performance.now() - t0;
    });
    out.clear.push(clearMs);
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

const results: Record<string, Record<string, { medianMs: number; samples: number[] }>> = {};
try {
  for (const fw of FRAMEWORKS) {
    console.error(`measuring ${fw.id} samples=${samples} cpu=1x`);
    const map = await measureFramework(browser, fw.path);
    results[fw.id] = {};
    for (const action of ACTIONS) {
      const nums = map[action].filter((n) => n >= 0);
      results[fw.id]![action] = { medianMs: median(nums), samples: nums };
      console.error(`  ${action}: median ${median(nums).toFixed(2)} ms`);
    }
  }
} finally {
  await browser.close();
  killProcessTree(server?.pid);
}

const throttle = { select: 4, swap: 4, remove: 2, clear: 4 } as const;
const driverCount10 = {
  luxel: { select: 182.7, swap: 185.45, remove: 171.8, clear: 91.3 },
  "vue-vapor": { select: 188.85, swap: 96.4, remove: 168.25, clear: 162.15 },
} as const;

const md: string[] = [
  "# Diagnose ~200ms floor (select/swap/remove/clear)",
  "",
  `Generated: ${new Date().toISOString()}`,
  `In-page click→double-rAF medians at CPU×1, samples=${samples}.`,
  "",
  "## Upstream CPU throttle (not a Luxel floor)",
  "",
  "| Scenario | CPU throttle |",
  "| --- | ---: |",
  "| select_row | 4× |",
  "| swap_rows | 4× |",
  "| remove_row | 2× |",
  "| clear_rows | 4× |",
  "| create_rows / append_rows | none |",
  "",
  "## In-page CPU×1 medians",
  "",
  "| Action | Luxel | Vue Vapor | Luxel/Vue |",
  "| --- | ---: | ---: | ---: |",
];

for (const action of ACTIONS) {
  const l = results.luxel![action]!.medianMs;
  const v = results["vue-vapor"]![action]!.medianMs;
  md.push(`| ${action} | ${l.toFixed(2)} ms | ${v.toFixed(2)} ms | ${(l / v).toFixed(3)}× |`);
}

md.push(
  "",
  "## Compare to DRIVER_COUNT=10 medians (throttled traces)",
  "",
  "| Action | Luxel driver | Luxel×1 in-page | Vue driver | Vue×1 in-page | Implied throttle stretch |",
  "| --- | ---: | ---: | ---: | ---: | --- |",
);

for (const action of ACTIONS) {
  const l1 = results.luxel![action]!.medianMs;
  const v1 = results["vue-vapor"]![action]!.medianMs;
  const ld = driverCount10.luxel[action];
  const vd = driverCount10["vue-vapor"][action];
  const t = throttle[action];
  md.push(
    `| ${action} | ${ld.toFixed(2)} ms | ${l1.toFixed(2)} ms | ${vd.toFixed(2)} ms | ${v1.toFixed(2)} ms | config ${t}×; driver/in-page L=${(ld / l1).toFixed(2)} V=${(vd / v1).toFixed(2)} |`,
  );
}

md.push(
  "",
  "## Answer",
  "",
  "- Not a Luxel-only ~200ms hard floor.",
  "- Select/remove at count=10 sit near each other for both frameworks under throttle.",
  "- Clear: Luxel already well below 200ms at count=10.",
  "- Swap: real Luxel gap vs Vue (in-page + driver).",
  "- create/append ~200ms Luxel losses are unthrottled — real framework work, not this floor.",
  "",
  "Ticket: https://github.com/SynCROSS/luxel/issues/109",
  "",
);

const outDir = join(repoRoot, "docs/benchmarks/runs");
await mkdir(outDir, { recursive: true });
const mdPath = join(outDir, "krausest-200ms-floor.md");
const jsonPath = join(outDir, "krausest-200ms-floor.json");
await writeFile(mdPath, `${md.join("\n")}\n`, "utf8");
await writeFile(
  jsonPath,
  `${JSON.stringify({ generated: new Date().toISOString(), samples, results, throttle, driverCount10 }, null, 2)}\n`,
  "utf8",
);
console.error(`wrote ${mdPath}`);
console.error(`wrote ${jsonPath}`);
