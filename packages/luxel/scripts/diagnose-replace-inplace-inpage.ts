/**
 * Wayfinder #128: in-page CPU×1 replace timing — update-in-place (current) only,
 * plus DOM counters. Confirms whether replace is still layout-bound.
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
const samples = Number(process.env.KRAUSEST_PROFILE_SAMPLES ?? 10);

const puppeteerPath = join(submodule, "webdriver-ts/node_modules/puppeteer-core");
if (!existsSync(puppeteerPath)) {
  console.error("puppeteer-core missing");
  process.exit(2);
}
const puppeteer = await import(`${puppeteerPath}/lib/esm/puppeteer/puppeteer-core.js`);

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

type Sample = {
  ms: number;
  createElement: number;
  appendChild: number;
  replaceChildren: number;
  setAttribute: number;
};

async function measureFramework(page: any, path: string): Promise<{ medianMs: number; samples: Sample[] }> {
  await page.goto(`http://${host}:${port}${path}`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("#run", { timeout: 30000 });
  await page.click("#run");
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 1000);

  await page.evaluate(() => {
    const g = globalThis as typeof globalThis & {
      __rep?: {
        createElement: number;
        appendChild: number;
        replaceChildren: number;
        setAttribute: number;
        reset: () => void;
      };
    };
    const counters = {
      createElement: 0,
      appendChild: 0,
      replaceChildren: 0,
      setAttribute: 0,
      reset() {
        this.createElement = 0;
        this.appendChild = 0;
        this.replaceChildren = 0;
        this.setAttribute = 0;
      },
    };
    g.__rep = counters;
    const doc = Document.prototype;
    const origCreate = doc.createElement;
    doc.createElement = function (this: Document, ...args: Parameters<Document["createElement"]>) {
      counters.createElement++;
      return origCreate.apply(this, args);
    };
    const origAppend = Node.prototype.appendChild;
    Node.prototype.appendChild = function <T extends Node>(this: Node, child: T): T {
      counters.appendChild++;
      return origAppend.call(this, child) as T;
    };
    const origReplace = Element.prototype.replaceChildren;
    Element.prototype.replaceChildren = function (this: Element, ...nodes: (Node | string)[]) {
      counters.replaceChildren++;
      return origReplace.apply(this, nodes);
    };
    const origSetAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
      counters.setAttribute++;
      return origSetAttr.call(this, name, value);
    };
  });

  const samplesOut: Sample[] = [];
  for (let i = 0; i < samples; i++) {
    const sample = (await page.evaluate(async () => {
      const g = globalThis as typeof globalThis & {
        __rep: {
          createElement: number;
          appendChild: number;
          replaceChildren: number;
          setAttribute: number;
          reset: () => void;
        };
      };
      g.__rep.reset();
      const t0 = performance.now();
      (document.querySelector("#run") as HTMLButtonElement).click();
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      const ms = performance.now() - t0;
      return {
        ms,
        createElement: g.__rep.createElement,
        appendChild: g.__rep.appendChild,
        replaceChildren: g.__rep.replaceChildren,
        setAttribute: g.__rep.setAttribute,
      };
    })) as Sample;
    samplesOut.push(sample);
  }
  return { medianMs: median(samplesOut.map((s) => s.ms)), samples: samplesOut };
}

const server = await ensureServer();
const chrome = await resolveKrausestChromeBinary(repoRoot, false);
const browser = await puppeteer.launch({
  executablePath: chrome.path,
  headless: true,
  args: ["--disable-dev-shm-usage"],
});

try {
  const luxelPage = await browser.newPage();
  const vuePage = await browser.newPage();
  const luxel = await measureFramework(luxelPage, "/frameworks/non-keyed/luxel/");
  const vue = await measureFramework(vuePage, "/frameworks/non-keyed/vue-vapor/");
  const med = (samplesList: Sample[], key: keyof Sample) =>
    median(samplesList.map((s) => Number(s[key])));

  const report = {
    generated: new Date().toISOString(),
    treatment: "same-length-update-inplace-no-recreate",
    samples,
    luxel: {
      medianMs: luxel.medianMs,
      createElement: med(luxel.samples, "createElement"),
      appendChild: med(luxel.samples, "appendChild"),
      replaceChildren: med(luxel.samples, "replaceChildren"),
      setAttribute: med(luxel.samples, "setAttribute"),
    },
    vue: {
      medianMs: vue.medianMs,
      createElement: med(vue.samples, "createElement"),
      appendChild: med(vue.samples, "appendChild"),
      replaceChildren: med(vue.samples, "replaceChildren"),
      setAttribute: med(vue.samples, "setAttribute"),
    },
  };
  console.log(JSON.stringify(report, null, 2));
  await mkdir(join(repoRoot, "docs/benchmarks/runs"), { recursive: true });
  const out = join(repoRoot, "docs/benchmarks/runs/krausest-replace-inplace-inpage.json");
  await writeFile(out, JSON.stringify(report, null, 2));
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
  if (server?.pid) killProcessTree(server.pid);
}
