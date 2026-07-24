/**
 * Wayfinder #132: Chrome-trace replace_all for luxel vs vue-vapor.
 * Seeds 1k rows, traces #run (replace), summarizes Layout/Paint/style windows.
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
const samples = Number(process.env.KRAUSEST_TRACE_SAMPLES ?? 6);
const outDir = join(repoRoot, "docs/benchmarks/runs/replace-traces");

const puppeteerPath = join(submodule, "webdriver-ts/node_modules/puppeteer-core");
if (!existsSync(puppeteerPath)) {
  console.error("puppeteer-core missing");
  process.exit(2);
}
const puppeteer = await import(`${puppeteerPath}/lib/esm/puppeteer/puppeteer-core.js`);

type TraceEvent = {
  name?: string;
  ph?: string;
  ts?: number;
  dur?: number;
  cat?: string;
  args?: { data?: { type?: string } };
};

type TraceSummary = {
  framework: string;
  sample: number;
  clickToIdleMs: number;
  layoutMs: number;
  layoutCount: number;
  paintMs: number;
  paintCount: number;
  recalcStyleMs: number;
  recalcStyleCount: number;
  updateLayerTreeMs: number;
  prePaintMs: number;
  functionCallMs: number;
  evaluateScriptMs: number;
};

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

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

function sumDur(events: TraceEvent[], name: string): { ms: number; count: number } {
  let us = 0;
  let count = 0;
  for (const e of events) {
    if (e.name === name && e.ph === "X" && typeof e.dur === "number") {
      us += e.dur;
      count++;
    }
  }
  return { ms: us / 1000, count };
}

function summarizeTrace(framework: string, sample: number, raw: { traceEvents?: TraceEvent[] }): TraceSummary {
  const events = raw.traceEvents ?? [];
  const click = events.find((e) => e.name === "EventDispatch" && e.args?.data?.type === "click");
  const clickStart = click?.ts ?? events[0]?.ts ?? 0;
  const clickEnd = clickStart + (click?.dur ?? 0);
  const afterClick = events.filter((e) => (e.ts ?? 0) >= clickStart && e.pid === click?.pid);
  // Krausest-like: first Commit after last of (FAF/layout/functioncall) past click end.
  const starters = afterClick.filter(
    (e) =>
      e.ph === "X" &&
      ((e.name === "FireAnimationFrame" && (e.ts ?? 0) >= clickEnd) ||
        e.name === "Layout" ||
        e.name === "FunctionCall"),
  );
  const startFrom = starters[starters.length - 1];
  const commits = afterClick.filter((e) => e.name === "Commit" && e.ph === "X");
  const commit =
    commits.find((e) => (e.ts ?? 0) > (startFrom?.ts ?? 0) + (startFrom?.dur ?? 0)) ?? commits[0];
  const clickToIdleUs = commit
    ? (commit.ts ?? 0) + (commit.dur ?? 0) - clickStart
    : 0;

  const window = afterClick.filter((e) => {
    const end = (e.ts ?? 0) + (e.dur ?? 0);
    return end <= clickStart + clickToIdleUs + 1000;
  });

  const layout = sumDur(window, "Layout");
  const paint = sumDur(window, "Paint");
  const recalc = sumDur(window, "UpdateLayoutTree");
  // Older Chromium uses RecalculateStyles
  const recalcOld = sumDur(window, "RecalculateStyles");
  const layer = sumDur(window, "UpdateLayerTree");
  const prePaint = sumDur(window, "PrePaint");
  const fn = sumDur(window, "FunctionCall");
  const evalScript = sumDur(window, "EvaluateScript");

  return {
    framework,
    sample,
    clickToIdleMs: clickToIdleUs / 1000,
    layoutMs: layout.ms,
    layoutCount: layout.count,
    paintMs: paint.ms,
    paintCount: paint.count,
    recalcStyleMs: recalc.ms + recalcOld.ms,
    recalcStyleCount: recalc.count + recalcOld.count,
    updateLayerTreeMs: layer.ms,
    prePaintMs: prePaint.ms,
    functionCallMs: fn.ms,
    evaluateScriptMs: evalScript.ms,
  };
}

async function traceReplace(page: any, framework: string, sample: number): Promise<TraceSummary> {
  const path =
    framework === "luxel"
      ? "/frameworks/non-keyed/luxel/"
      : "/frameworks/non-keyed/vue-vapor/";
  await page.goto(`http://${host}:${port}${path}`, {
    waitUntil: "networkidle0",
    timeout: 60_000,
  });
  await page.waitForSelector("#run", { timeout: 30_000 });

  // Seed 1k without tracing.
  await page.evaluate(async () => {
    const run = document.querySelector("#run") as HTMLButtonElement;
    run.click();
    const start = performance.now();
    while (document.querySelectorAll("tbody tr").length < 1000) {
      if (performance.now() - start > 30_000) throw new Error("seed timeout");
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    }
  });
  await Bun.sleep(200);

  const tracePath = join(outDir, `${framework}-replace-${sample}.json`);
  const beforeId = await page.evaluate(
    () => document.querySelector("tbody tr td")?.textContent ?? "",
  );

  await page.tracing.start({
    path: tracePath,
    screenshots: false,
    categories: [
      "devtools.timeline",
      "v8.execute",
      "blink.user_timing",
      "disabled-by-default-devtools.timeline",
      "disabled-by-default-devtools.timeline.frame",
    ],
  });

  // Real puppeteer click (matches krausest driver); avoid evaluate rAF wait loops in-trace.
  await page.click("#run");
  await page.waitForFunction(
    (prev) => (document.querySelector("tbody tr td")?.textContent ?? "") !== prev,
    { timeout: 10_000 },
    beforeId,
  );
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  await page.tracing.stop();

  const raw = JSON.parse(await Bun.file(tracePath).text()) as { traceEvents?: TraceEvent[] };
  return summarizeTrace(framework, sample, raw);
}

await mkdir(outDir, { recursive: true });
const chrome = await resolveKrausestChromeBinary(repoRoot, false);
const server = await ensureServer();
const browser = await puppeteer.launch({
  executablePath: chrome.path,
  headless: true,
  protocolTimeout: 600_000,
  args: ["--disable-dev-shm-usage"],
});

const summaries: TraceSummary[] = [];
try {
  for (let i = 1; i <= samples; i++) {
    console.error(`sample ${i}/${samples} luxel`);
    const luxelPage = await browser.newPage();
    try {
      summaries.push(await traceReplace(luxelPage, "luxel", i));
    } finally {
      await luxelPage.close();
    }
    console.error(`sample ${i}/${samples} vue-vapor`);
    const vuePage = await browser.newPage();
    try {
      summaries.push(await traceReplace(vuePage, "vue-vapor", i));
    } finally {
      await vuePage.close();
    }
  }
} finally {
  await browser.close();
  if (server?.pid) killProcessTree(server.pid);
}

function medFor(fw: string, key: keyof TraceSummary): number {
  return median(summaries.filter((s) => s.framework === fw).map((s) => Number(s[key])));
}

const report = {
  generated: new Date().toISOString(),
  samples,
  chrome: chrome.path,
  medians: {
    luxel: {
      clickToIdleMs: medFor("luxel", "clickToIdleMs"),
      layoutMs: medFor("luxel", "layoutMs"),
      layoutCount: medFor("luxel", "layoutCount"),
      paintMs: medFor("luxel", "paintMs"),
      recalcStyleMs: medFor("luxel", "recalcStyleMs"),
      updateLayerTreeMs: medFor("luxel", "updateLayerTreeMs"),
      prePaintMs: medFor("luxel", "prePaintMs"),
      functionCallMs: medFor("luxel", "functionCallMs"),
    },
    vueVapor: {
      clickToIdleMs: medFor("vue-vapor", "clickToIdleMs"),
      layoutMs: medFor("vue-vapor", "layoutMs"),
      layoutCount: medFor("vue-vapor", "layoutCount"),
      paintMs: medFor("vue-vapor", "paintMs"),
      recalcStyleMs: medFor("vue-vapor", "recalcStyleMs"),
      updateLayerTreeMs: medFor("vue-vapor", "updateLayerTreeMs"),
      prePaintMs: medFor("vue-vapor", "prePaintMs"),
      functionCallMs: medFor("vue-vapor", "functionCallMs"),
    },
  },
  samplesDetail: summaries,
};

const jsonPath = join(repoRoot, "docs/benchmarks/runs/krausest-replace-chrome-trace.json");
await writeFile(jsonPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.medians, null, 2));
console.error(`wrote ${jsonPath}`);
console.error(`traces in ${outDir}`);
