/**
 * Dump wallace page console/errors after load.
 *   bun packages/luxel/scripts/diagnose-wallace-dom.ts
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
} from "../src/bench/krausest/setup-driver.ts";
import { findNodeExecutable } from "../src/util/find-node.ts";
import { killProcessTree } from "../src/util/kill-process-tree.ts";

const repoRoot = join(import.meta.dir, "../../..");
const submodule = repoKrausestSubmodulePath(repoRoot);
const host = "localhost";
const port = 8080;

async function waitReady(): Promise<boolean> {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://${host}:${port}/ls`, {
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
const browser = await puppeteer.launch({
  executablePath: chrome.path,
  headless: true,
});
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (err: Error) => errors.push(`pageerror:${err.message}`));
page.on("console", (msg: { type: () => string; text: () => string }) => {
  if (msg.type() === "error") errors.push(`console:${msg.text()}`);
});

const url = `http://${host}:${port}/frameworks/non-keyed/wallace/index.html`;
const res = await page.goto(url, { waitUntil: "networkidle0", timeout: 30_000 });
await Bun.sleep(1000);
const html = await page.content();
const mainJs = await page.evaluate(() => {
  const scripts = [...document.scripts].map((s) => s.src);
  return { scripts, mainChildCount: document.querySelector("#main")?.childElementCount ?? -1 };
});

console.error(
  JSON.stringify(
    {
      status: res?.status(),
      hasRun: /id=["']run["']/.test(html),
      mainJs,
      errors,
      bodySnippet: html.includes("<body")
        ? html.slice(html.indexOf("<body"), html.indexOf("<body") + 600)
        : html.slice(0, 600),
    },
    null,
    2,
  ),
);

await browser.close();
killProcessTree(server?.pid);
process.exit(/id=["']run["']/.test(html) ? 0 : 1);
