/**
 * Red loop: find official non-keyed frameworks where #run never appears.
 * Symptom: checkElementExists failed for pierce/#run across many benches.
 *
 *   bun packages/luxel/scripts/diagnose-krausest-run-button.ts
 * Exit 1 = RED (one or more frameworks missing #run). Exit 0 = GREEN. Exit 2 = setup.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { repoKrausestSubmodulePath } from "../src/bench/krausest/contract.ts";
import {
  detectKrausestFrameworks,
  resolveKrausestOfficialNonKeyedFrameworks,
} from "../src/bench/krausest/frameworks.ts";
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
const only = process.env.KRAUSEST_DIAGNOSE_FRAMEWORK?.trim();

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

function frameworkUrl(driverPath: string, customURL?: string): string {
  const suffix = customURL
    ? customURL.startsWith("/")
      ? customURL
      : `/${customURL}`
    : "";
  return `http://${host}:${port}/frameworks/${driverPath}${suffix}/index.html`;
}

await ensureKrausestServerDeps(submodule);
const node = findNodeExecutable();
if (!node) {
  console.error("node missing");
  process.exit(2);
}
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
    console.error("server not ready");
    process.exit(2);
  }
}

const chrome = await resolveKrausestChromeBinary(repoRoot, true);
const puppeteerPath = join(submodule, "webdriver-ts/node_modules/puppeteer-core");
if (!existsSync(puppeteerPath)) {
  killProcessTree(server?.pid);
  console.error("puppeteer-core missing");
  process.exit(2);
}

const puppeteer = await import(`${puppeteerPath}/lib/esm/puppeteer/puppeteer-core.js`);
const browser = await puppeteer.launch({
  executablePath: chrome.path,
  headless: true,
  args: ["--js-flags=--expose-gc"],
  protocolTimeout: 60_000,
});

const official = resolveKrausestOfficialNonKeyedFrameworks(submodule);
const detected = detectKrausestFrameworks(submodule);
const targets = (only
  ? detected.filter((f) => f.directory === only || f.driverPath === only)
  : official
).filter((f) => f.type === "non-keyed");

const failures: { label: string; url: string; error: string }[] = [];
const started = Date.now();

for (const fw of targets) {
  const url = frameworkUrl(fw.driverPath, fw.customURL);
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30_000 });
    await page.waitForSelector("#run", { timeout: 8_000 });
    console.error(`OK ${fw.driverPath}`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    failures.push({ label: fw.label, url, error: error.slice(0, 200) });
    console.error(`FAIL ${fw.driverPath} — ${error.slice(0, 120)}`);
  } finally {
    await page.close().catch(() => undefined);
  }
}

await browser.close();
killProcessTree(server?.pid);

const elapsedS = ((Date.now() - started) / 1000).toFixed(1);
if (failures.length === 0) {
  console.error(
    JSON.stringify({ verdict: "GREEN", checked: targets.length, elapsedS }, null, 2),
  );
  process.exit(0);
}

console.error(
  JSON.stringify(
    {
      verdict: "RED",
      checked: targets.length,
      failed: failures.length,
      elapsedS,
      failures,
    },
    null,
    2,
  ),
);
process.exit(1);
