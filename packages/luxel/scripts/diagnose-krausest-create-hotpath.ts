/**
 * Wayfinder #110: profile luxel create/replace/partial/append/create_many hot paths.
 * Injects counters around createElement/appendChild + times button actions at CPU×1.
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
const samples = Number(process.env.KRAUSEST_PROFILE_SAMPLES ?? 8);

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

type Action = "create" | "replace" | "partial" | "append" | "create_many" | "swap";

type ActionSample = {
  ms: number;
  createElement: number;
  appendChild: number;
  setAttribute: number;
  addEventListener: number;
};

async function instrumentPage(page: any): Promise<void> {
  await page.evaluateOnNewDocument(() => {
    const g = globalThis as typeof globalThis & {
      __luxelProf?: {
        createElement: number;
        appendChild: number;
        setAttribute: number;
        addEventListener: number;
        reset: () => void;
      };
    };
    const counters = {
      createElement: 0,
      appendChild: 0,
      setAttribute: 0,
      addEventListener: 0,
      reset() {
        this.createElement = 0;
        this.appendChild = 0;
        this.setAttribute = 0;
        this.addEventListener = 0;
      },
    };
    g.__luxelProf = counters;
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
    const origSetAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
      counters.setAttribute++;
      return origSetAttr.call(this, name, value);
    };
    const origAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (
      this: EventTarget,
      ...args: Parameters<EventTarget["addEventListener"]>
    ) {
      counters.addEventListener++;
      return origAdd.apply(this, args);
    };
  });
}

async function timeAction(page: any, action: Action): Promise<ActionSample> {
  return page.evaluate(async (actionName: Action) => {
    const g = globalThis as typeof globalThis & {
      __luxelProf?: {
        createElement: number;
        appendChild: number;
        setAttribute: number;
        addEventListener: number;
        reset: () => void;
      };
    };
    const prof = g.__luxelProf!;
    const click = async (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) throw new Error(`missing ${sel}`);
      el.click();
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    };
    const waitRows = async (n: number) => {
      const start = performance.now();
      while (document.querySelectorAll("tbody tr").length < n) {
        if (performance.now() - start > 30_000) throw new Error(`timeout waiting for ${n} rows`);
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }
    };

    if (actionName === "create" || actionName === "create_many") {
      const clearBtn = document.querySelector("#clear") as HTMLElement | null;
      clearBtn?.click();
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    } else if (actionName === "append") {
      const clearBtn = document.querySelector("#clear") as HTMLElement | null;
      clearBtn?.click();
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      await click("#run");
      await waitRows(1000);
    } else if (actionName === "replace" || actionName === "partial" || actionName === "swap") {
      const n = document.querySelectorAll("tbody tr").length;
      if (n < 1000) {
        await click("#run");
        await waitRows(1000);
      }
    }

    const sel =
      actionName === "create"
        ? "#run"
        : actionName === "create_many"
          ? "#runlots"
          : actionName === "append"
            ? "#add"
            : actionName === "partial"
              ? "#update"
              : actionName === "swap"
                ? "#swaprows"
                : "#run"; // replace = #run again on full table

    prof.reset();
    const t0 = performance.now();
    await click(sel);
    if (actionName === "create") await waitRows(1000);
    if (actionName === "create_many") await waitRows(10000);
    if (actionName === "append") await waitRows(2000);
    if (actionName === "replace") await waitRows(1000);
    const ms = performance.now() - t0;
    return {
      ms,
      createElement: prof.createElement,
      appendChild: prof.appendChild,
      setAttribute: prof.setAttribute,
      addEventListener: prof.addEventListener,
    };
  }, action);
}

const ACTIONS: Action[] = ["create", "replace", "partial", "append", "create_many", "swap"];

const chrome = await resolveKrausestChromeBinary(repoRoot, false);
const server = await ensureServer();
const browser = await puppeteer.launch({
  executablePath: chrome.path,
  headless: true,
  args: ["--disable-dev-shm-usage"],
});

const byAction: Record<string, ActionSample[]> = Object.fromEntries(ACTIONS.map((a) => [a, []]));

try {
  const page = await browser.newPage();
  await page.emulateCPUThrottling(1);
  await instrumentPage(page);
  await page.goto(`http://${host}:${port}/frameworks/non-keyed/luxel/`, {
    waitUntil: "networkidle0",
    timeout: 60_000,
  });
  await page.waitForSelector("#run", { timeout: 30_000 });

  for (let i = 0; i < samples; i++) {
    console.error(`sample ${i + 1}/${samples}`);
    for (const action of ACTIONS) {
      const sample = await timeAction(page, action);
      byAction[action]!.push(sample);
      console.error(
        `  ${action}: ${sample.ms.toFixed(1)}ms ce=${sample.createElement} ac=${sample.appendChild} sa=${sample.setAttribute} el=${sample.addEventListener}`,
      );
    }
  }
  await page.close();
} finally {
  await browser.close();
  killProcessTree(server?.pid);
}

type Summary = {
  action: Action;
  medianMs: number;
  medianCreateElement: number;
  medianAppendChild: number;
  medianSetAttribute: number;
  medianAddEventListener: number;
};

const summaries: Summary[] = ACTIONS.map((action) => {
  const samplesFor = byAction[action]!;
  return {
    action,
    medianMs: median(samplesFor.map((s) => s.ms)),
    medianCreateElement: median(samplesFor.map((s) => s.createElement)),
    medianAppendChild: median(samplesFor.map((s) => s.appendChild)),
    medianSetAttribute: median(samplesFor.map((s) => s.setAttribute)),
    medianAddEventListener: median(samplesFor.map((s) => s.addEventListener)),
  };
});

const driverCount10 = {
  create_rows: { luxel: 204.95, vue: 73.7 },
  replace_all_rows: { luxel: 85.55, vue: 210.45 },
  partial_update: { luxel: 207.2, vue: 188.2 },
  append_rows: { luxel: 206.2, vue: 99.45 },
  create_many_rows: { luxel: 692.1, vue: 944.95 },
  swap_rows: { luxel: 185.45, vue: 96.4 },
} as const;

const md = [
  "# Luxel create/replace/partial/append hot-path profile",
  "",
  `Generated: ${new Date().toISOString()}`,
  `In-page CPU×1 with DOM API counters, samples=${samples}.`,
  "",
  "## DOM API medians (Luxel)",
  "",
  "| Action | ms | createElement | appendChild | setAttribute | addEventListener |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
  ...summaries.map(
    (s) =>
      `| ${s.action} | ${s.medianMs.toFixed(1)} | ${s.medianCreateElement} | ${s.medianAppendChild} | ${s.medianSetAttribute} | ${s.medianAddEventListener} |`,
  ),
  "",
  "## Code structure (from generated attach)",
  "",
  "- `create_*_row`: **cloneNode(true)** from one-time template (static `className`, `data-luxel-click` markers).",
  "- `bindDelegatedClicks` on each container — no per-row `addEventListener`.",
  "- `update_*_row`: still checks class + id + label for **every** shared index (dirty-index deferred).",
  "- `reconcileNonKeyedList`: shared prefix → update all; append via DocumentFragment when >1.",
  "",
  "## Driver_COUNT=10 context",
  "",
  "| Scenario | Luxel | Vue Vapor | Status |",
  "| --- | ---: | ---: | --- |",
  `| create_rows | ${driverCount10.create_rows.luxel} | ${driverCount10.create_rows.vue} | lose 2.78× |`,
  `| replace_all_rows | ${driverCount10.replace_all_rows.luxel} | ${driverCount10.replace_all_rows.vue} | win |`,
  `| partial_update | ${driverCount10.partial_update.luxel} | ${driverCount10.partial_update.vue} | lose 1.10× |`,
  `| append_rows | ${driverCount10.append_rows.luxel} | ${driverCount10.append_rows.vue} | lose 2.07× |`,
  `| create_many_rows | ${driverCount10.create_many_rows.luxel} | ${driverCount10.create_many_rows.vue} | win |`,
  `| swap_rows | ${driverCount10.swap_rows.luxel} | ${driverCount10.swap_rows.vue} | lose 1.92× |`,
  "",
  "## Hypothesized levers (ranked)",
  "",
  "1. **Template/`cloneNode` row factory** — cut createElement×7 + setAttribute on create/append (biggest losses).",
  "2. **Skip unchanged updateRow** — item reference equality or dirty indices for partial/swap (stops 1000-row walks).",
  "3. **Event delegation** — 1 listener on tbody vs 2000 addEventListener on create 1k.",
  "4. **Static attr codegen** — `className = \"col-md-1\"` instead of setAttribute.",
  "5. **Replace already wins** via in-place update path — preserve that; avoid forcing full recreate.",
  "",
  "Ticket: https://github.com/SynCROSS/luxel/issues/110",
  "",
];

const outDir = join(repoRoot, "docs/benchmarks/runs");
await mkdir(outDir, { recursive: true });
const mdPath = join(outDir, "krausest-create-hotpath.md");
const jsonPath = join(outDir, "krausest-create-hotpath.json");
await writeFile(mdPath, `${md.join("\n")}\n`, "utf8");
await writeFile(
  jsonPath,
  `${JSON.stringify({ generated: new Date().toISOString(), samples, summaries, byAction, driverCount10 }, null, 2)}\n`,
  "utf8",
);
console.error(`wrote ${mdPath}`);
console.error(`wrote ${jsonPath}`);
