/**
 * HITL-free: open alins page, click #run, report row count + console errors.
 * Uses puppeteer-core from webdriver-ts if available, else playwright.
 */
import { join } from "node:path";
import { existsSync } from "node:fs";
import { resolveKrausestChromeBinary } from "../src/bench/krausest/krausest-chrome.ts";
import { repoKrausestSubmodulePath } from "../src/bench/krausest/contract.ts";
import { ensureKrausestServerDeps, krausestServerTsxCli, KRAUSEST_NPM_ENV } from "../src/bench/krausest/setup-driver.ts";
import { findNodeExecutable } from "../src/util/find-node.ts";
import { spawn } from "node:child_process";
import { killProcessTree } from "../src/util/kill-process-tree.ts";

const repoRoot = join(import.meta.dir, "../../..");
const submodule = repoKrausestSubmodulePath(repoRoot);
const host = "localhost";
const port = 8080;

async function waitReady(): Promise<boolean> {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://${host}:${port}/ls`, { signal: AbortSignal.timeout(1000) });
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
const tsx = krausestServerTsxCli(submodule);
let server = null as ReturnType<typeof spawn> | null;
if (!(await waitReady())) {
  server = spawn(node, [tsx, "index.ts"], {
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
console.error(`chrome=${chrome.path} source=${chrome.source} version=${chrome.version}`);

const puppeteerPath = join(submodule, "webdriver-ts/node_modules/puppeteer-core");
if (!existsSync(puppeteerPath)) throw new Error("puppeteer-core missing — setup driver first");

const puppeteer = await import(puppeteerPath + "/lib/esm/puppeteer/puppeteer-core.js");
const browser = await puppeteer.launch({
  executablePath: chrome.path,
  headless: true,
  args: ["--js-flags=--expose-gc", "--enable-precise-memory-info"],
});
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (err: Error) => errors.push(String(err)));
page.on("console", (msg: { type: () => string; text: () => string }) => {
  if (msg.type() === "error") errors.push(msg.text());
});

const url = `http://${host}:${port}/frameworks/non-keyed/alins/`;
await page.goto(url, { waitUntil: "networkidle0", timeout: 30_000 });
await page.waitForSelector("#run", { timeout: 10_000 });
const before = await page.$$eval("tbody tr", (rows: Element[]) => rows.length);
await page.click("#run");
await Bun.sleep(500);
const after = await page.$$eval("tbody tr", (rows: Element[]) => rows.length);
const htmlSnippet = await page.$eval("tbody", (el: Element) => el.innerHTML.slice(0, 200));

console.error(
  JSON.stringify(
    {
      url,
      before,
      after,
      errors,
      htmlSnippet,
      ok: after === 1000,
    },
    null,
    2,
  ),
);

await browser.close();
killProcessTree(server?.pid);
process.exit(after === 1000 && errors.length === 0 ? 0 : 1);
