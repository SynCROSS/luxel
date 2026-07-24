/**
 * Probe where reflex-dom 04_select1k wedges CDP.
 *   bun packages/luxel/scripts/diagnose-reflex-select-hang.ts
 */
import { join } from "node:path";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { repoKrausestSubmodulePath } from "../src/bench/krausest/contract.ts";
import { resolveKrausestChromeBinary } from "../src/bench/krausest/krausest-chrome.ts";
import {
  ensureKrausestServerDeps,
  krausestServerTsxCli,
  KRAUSEST_NPM_ENV,
  applyKrausestDriverPatches,
} from "../src/bench/krausest/setup-driver.ts";
import { findNodeExecutable } from "../src/util/find-node.ts";
import { killProcessTree } from "../src/util/kill-process-tree.ts";

const repoRoot = join(import.meta.dir, "../../..");
const submodule = repoKrausestSubmodulePath(repoRoot);
applyKrausestDriverPatches(submodule);

async function waitReady(): Promise<boolean> {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch("http://localhost:8080/ls", {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await Bun.sleep(250);
  }
  return false;
}

await ensureKrausestServerDeps(submodule);
const node = findNodeExecutable();
if (!node) throw new Error("no node");
let server = null as ReturnType<typeof spawn> | null;
if (!(await waitReady())) {
  server = spawn(node, [krausestServerTsxCli(submodule), "index.ts"], {
    cwd: join(submodule, "server"),
    stdio: ["ignore", "pipe", "pipe"],
    env: KRAUSEST_NPM_ENV,
    windowsHide: true,
  });
  if (!(await waitReady())) {
    killProcessTree(server.pid);
    throw new Error("server not ready");
  }
}

const chrome = await resolveKrausestChromeBinary(repoRoot, true);
const puppeteerPath = join(submodule, "webdriver-ts/node_modules/puppeteer-core");
if (!existsSync(puppeteerPath)) throw new Error("puppeteer-core missing");
const puppeteer = await import(`${puppeteerPath}/lib/esm/puppeteer/puppeteer-core.js`);

const protocolTimeout = Number(process.env.KRAUSEST_PROBE_PROTOCOL_TIMEOUT_MS ?? 15_000);
const browser = await puppeteer.launch({
  executablePath: chrome.path,
  headless: true,
  args: ["--js-flags=--expose-gc", "--no-default-browser-check"],
  protocolTimeout,
});

const steps: { step: string; ms: number; ok: boolean; error?: string }[] = [];
async function step(name: string, fn: () => Promise<void>): Promise<boolean> {
  const t0 = Date.now();
  try {
    await fn();
    steps.push({ step: name, ms: Date.now() - t0, ok: true });
    console.error(`OK ${name} ${Date.now() - t0}ms`);
    return true;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    steps.push({ step: name, ms: Date.now() - t0, ok: false, error: error.slice(0, 200) });
    console.error(`FAIL ${name} ${Date.now() - t0}ms — ${error.slice(0, 120)}`);
    return false;
  }
}

const page = await browser.newPage();
const url =
  "http://localhost:8080/frameworks/non-keyed/reflex-dom/bundled-dist/index.html";

let ok = await step("goto", async () => {
  await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
});
if (ok) {
  ok = await step("wait #run", async () => {
    await page.waitForSelector("#run", { timeout: 15_000 });
  });
}
if (ok) {
  ok = await step("click #run", async () => {
    await page.click("#run");
  });
}
if (ok) {
  ok = await step("wait row 1000", async () => {
    await page.waitForFunction(
      () => document.querySelector("tbody tr:nth-of-type(1000) td:nth-of-type(1)")?.textContent === "1000",
      { timeout: 30_000 },
    );
  });
}
if (ok) {
  ok = await step("click row5 select", async () => {
    await page.click("tbody tr:nth-of-type(5) td:nth-of-type(2) a");
  });
}
if (ok) {
  ok = await step("evaluate classList row5", async () => {
    const cls = await page.$eval("tbody tr:nth-of-type(5)", (el) =>
      Array.from(el.classList),
    );
    if (!cls.includes("danger")) throw new Error(`no danger: ${cls.join(",")}`);
  });
}
if (ok) {
  ok = await step("click row2 select (run)", async () => {
    await page.click("tbody tr:nth-of-type(2) td:nth-of-type(2) a");
  });
}
if (ok) {
  ok = await step("evaluate classList row2", async () => {
    const cls = await page.$eval("tbody tr:nth-of-type(2)", (el) =>
      Array.from(el.classList),
    );
    if (!cls.includes("danger")) throw new Error(`no danger: ${cls.join(",")}`);
  });
}
if (ok) {
  ok = await step("evaluate window.gc", async () => {
    await page.evaluate("window.gc && window.gc()");
  });
}

console.error(JSON.stringify({ protocolTimeout, verdict: ok ? "GREEN" : "RED", steps }, null, 2));
await browser.close();
killProcessTree(server?.pid);
process.exit(ok ? 0 : 1);
