/**
 *   bun packages/luxel/scripts/diagnose-reflex-classlist.ts
 */
import { join } from "node:path";
import { spawn } from "node:child_process";
import { resolveKrausestChromeBinary } from "../src/bench/krausest/krausest-chrome.ts";
import { repoKrausestSubmodulePath } from "../src/bench/krausest/contract.ts";
import {
  ensureKrausestServerDeps,
  krausestServerTsxCli,
  KRAUSEST_NPM_ENV,
} from "../src/bench/krausest/setup-driver.ts";
import { findNodeExecutable } from "../src/util/find-node.ts";
import { killProcessTree } from "../src/util/kill-process-tree.ts";

const repoRoot = join(import.meta.dir, "../../..");
const submodule = repoKrausestSubmodulePath(repoRoot);

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
const puppeteer = await import(
  `${join(submodule, "webdriver-ts/node_modules/puppeteer-core")}/lib/esm/puppeteer/puppeteer-core.js`
);
const browser = await puppeteer.launch({
  executablePath: chrome.path,
  headless: true,
  protocolTimeout: 20_000,
});
const page = await browser.newPage();
await page.goto(
  "http://localhost:8080/frameworks/non-keyed/reflex-dom/bundled-dist/index.html",
  { waitUntil: "networkidle0" },
);
await page.click("#run");
await page.waitForFunction(
  () => document.querySelectorAll("tbody tr").length >= 1000,
  { timeout: 30_000 },
);
await page.click("tbody tr:nth-of-type(5) td:nth-of-type(2) a");
await Bun.sleep(500);
const info = await page.evaluate(() => {
  const row = document.querySelector("tbody tr:nth-of-type(5)");
  return {
    className: row?.className ?? "",
    outer: row?.outerHTML?.slice(0, 240) ?? "",
    dangerCount: document.querySelectorAll("tr.danger").length,
  };
});
console.error("after select", info);

const handle = await page.$("tbody tr:nth-of-type(5)");
const t0 = Date.now();
try {
  const clazzes = await Promise.race([
    handle!.evaluate((e: Element) => (e as HTMLElement)?.classList),
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error("classList evaluate timeout")), 10_000),
    ),
  ]);
  console.error("classList evaluate OK", Date.now() - t0, clazzes);
} catch (err) {
  console.error(
    "classList evaluate FAIL",
    Date.now() - t0,
    err instanceof Error ? err.message : err,
  );
}

const t1 = Date.now();
try {
  const arr = await handle!.evaluate((e: Element) => Array.from(e.classList));
  console.error("Array.from classList OK", Date.now() - t1, arr);
} catch (err) {
  console.error(
    "Array.from FAIL",
    Date.now() - t1,
    err instanceof Error ? err.message : err,
  );
}

await browser.close();
killProcessTree(server?.pid);
process.exit(info.dangerCount === 1 ? 0 : 2);
