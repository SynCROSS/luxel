import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { findNodeExecutable, findNpmExecutable } from "../../util/find-node.ts";
import { repoKrausestSubmodulePath } from "./contract.ts";

export const KRAUSEST_NPM_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
};

export function frameworkKrausestNpmEnv(cwd: string): NodeJS.ProcessEnv {
  const bin = join(cwd, "node_modules", ".bin");
  const delimiter = process.platform === "win32" ? ";" : ":";
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const pathParts = [bin];
  const node = findNodeExecutable();
  if (node) {
    pathParts.push(dirname(node));
  }
  const npm = findNpmExecutable();
  if (npm) {
    pathParts.push(dirname(npm));
  }
  pathParts.push(process.env[pathKey] ?? "");
  return {
    ...KRAUSEST_NPM_ENV,
    [pathKey]: pathParts.join(delimiter),
  };
}

function requireKrausestNode(): string {
  const node = findNodeExecutable();
  if (!node) {
    throw new Error("node executable not found — install Node 20+ for krausest driver");
  }
  return node;
}

function requireKrausestNpm(): string {
  const npm = findNpmExecutable();
  if (!npm) {
    throw new Error("npm executable not found — install Node/npm for krausest driver");
  }
  return npm;
}

export function runKrausestNodeSync(
  cwd: string,
  script: string,
  args: string[] = [],
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(requireKrausestNode(), [script, ...args], {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
    env: KRAUSEST_NPM_ENV,
    windowsHide: true,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function runKrausestNpmSync(
  cwd: string,
  args: string[],
  env: NodeJS.ProcessEnv = KRAUSEST_NPM_ENV,
): { status: number | null; stdout: string; stderr: string } {
  const npm = env.KRAUSEST_FRAMEWORK_NPM?.trim() || requireKrausestNpm();
  const result = spawnSync(npm, args, {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
    env,
    windowsHide: true,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export async function ensureKrausestServerDeps(submodule: string): Promise<void> {
  const serverModules = join(submodule, "server/node_modules");
  if (existsSync(serverModules)) return;
  const install = runKrausestNpmSync(submodule, ["run", "install-server"]);
  if (install.status !== 0) {
    throw new Error(
      `krausest server install failed:\n${install.stdout}\n${install.stderr}\nRun: bun packages/luxel/scripts/setup-krausest-driver.ts`,
    );
  }
}

export async function ensureKrausestDriverBuilt(submodule: string): Promise<void> {
  const runner = join(submodule, "webdriver-ts/dist/benchmarkRunner.js");
  const runnerSrc = join(submodule, "webdriver-ts/src/benchmarkRunner.ts");
  const forkedSrc = join(submodule, "webdriver-ts/src/forkedBenchmarkRunnerPuppeteer.ts");
  const forkedDist = join(submodule, "webdriver-ts/dist/forkedBenchmarkRunnerPuppeteer.js");
  let needsCompile = !existsSync(runner);
  if (!needsCompile && existsSync(runnerSrc) && existsSync(runner)) {
    const [srcMtime, distMtime] = await Promise.all([
      stat(runnerSrc).then((s) => s.mtimeMs),
      stat(runner).then((s) => s.mtimeMs),
    ]);
    if (srcMtime > distMtime) needsCompile = true;
  }
  if (!needsCompile && existsSync(forkedSrc) && existsSync(forkedDist)) {
    const [srcMtime, distMtime] = await Promise.all([
      stat(forkedSrc).then((s) => s.mtimeMs),
      stat(forkedDist).then((s) => s.mtimeMs),
    ]);
    if (srcMtime > distMtime) needsCompile = true;
  }
  if (!needsCompile) {
    applyKrausestDriverPatches(submodule);
    return;
  }

  await ensureKrausestServerDeps(submodule);

  const webdriverDir = join(submodule, "webdriver-ts");
  const puppeteerCore = join(webdriverDir, "node_modules/puppeteer-core/package.json");

  if (!existsSync(puppeteerCore)) {
    let install = runKrausestNpmSync(webdriverDir, ["ci", "--ignore-scripts"]);
    if (install.status !== 0) {
      install = runKrausestNpmSync(webdriverDir, ["install", "--ignore-scripts"]);
    }
    if (install.status !== 0) {
      throw new Error(
        [
          "krausest webdriver-ts deps failed (Playwright browser install skipped).",
          install.stdout,
          install.stderr,
          "Hint: remove vendor/js-framework-benchmark/webdriver-ts/node_modules, then run:",
          "  bun packages/luxel/scripts/setup-krausest-driver.ts",
        ].join("\n"),
      );
    }
  }

  const compile = runKrausestNpmSync(webdriverDir, ["run", "compile"]);
  if (compile.status !== 0 || !existsSync(runner)) {
    throw new Error(
      `krausest webdriver-ts compile failed:\n${compile.stdout}\n${compile.stderr}`,
    );
  }
  applyKrausestDriverPatches(submodule);
}

/** Re-apply all dist patches (idempotent). Compile wipes them. */
export function applyKrausestDriverPatches(submodule: string): void {
  patchKrausestPuppeteerPostWait(submodule);
  patchKrausestPuppeteerProtocolTimeout(submodule);
  patchKrausestForceGcTimeout(submodule);
  patchKrausestSizeFirstPaintWait(submodule);
  patchKrausestMousedownRetry(submodule);
  patchKrausestCheckElementHasClass(submodule);
}

/**
 * Upstream waits only 100ms after each CPU run before stopping the Chrome trace.
 * Some frameworks (alins) emit Commit ~200ms after click → "No commit event found".
 * Stretch the post-run wait so the compositor Commit is captured.
 */
export function patchKrausestPuppeteerPostWait(submodule: string): boolean {
  const forkedDist = join(submodule, "webdriver-ts/dist/forkedBenchmarkRunnerPuppeteer.js");
  if (!existsSync(forkedDist)) return false;
  const raw = readFileSync(forkedDist, "utf8");
  const waitMs = krausestPuppeteerPostWaitMs();
  const next = raw.replace(
    /await wait\(\d+\);\s*\n\s*await page\.tracing\.stop\(\)/,
    `await wait(${waitMs});\n            await page.tracing.stop()`,
  );
  if (next === raw) {
    // Already patched or pattern drifted — try simpler replace of the known line near tracing.stop
    const alt = raw.replace(
      /(await runBenchmark\(page, benchmark, framework\);\s*\n\s*)await wait\(\d+\);/,
      `$1await wait(${waitMs});`,
    );
    if (alt === raw) return false;
    writeFileSync(forkedDist, alt);
    return true;
  }
  writeFileSync(forkedDist, next);
  return true;
}

export function krausestPuppeteerPostWaitMs(): number {
  const raw = process.env.KRAUSEST_PUPPETEER_POST_WAIT_MS?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 100) return Math.floor(n);
  }
  return 350;
}

/** Default 10m — Puppeteer 180s is too low for major sync GC on heavy frameworks (reflex-dom). */
export const KRAUSEST_PUPPETEER_PROTOCOL_TIMEOUT_MS_DEFAULT = 600_000;

export function krausestPuppeteerProtocolTimeoutMs(): number {
  const raw = process.env.KRAUSEST_PUPPETEER_PROTOCOL_TIMEOUT_MS?.trim();
  if (raw) {
    const n = Number(raw);
    // Allow sub-second for differential diagnose loops; production default is 600s.
    if (Number.isFinite(n) && n >= 50) return Math.floor(n);
  }
  return KRAUSEST_PUPPETEER_PROTOCOL_TIMEOUT_MS_DEFAULT;
}

/**
 * Upstream `puppeteer.launch` omits `protocolTimeout` (Puppeteer default 180s).
 * Long `--full` runs hit `Runtime.callFunctionOn timed out` on slow evaluate/GC
 * (e.g. reflex-dom 04_select1k) → empty results → "Cannot compute stats on empty array".
 */
export function patchKrausestPuppeteerProtocolTimeout(submodule: string): boolean {
  const accessDist = join(submodule, "webdriver-ts/dist/puppeteerAccess.js");
  if (!existsSync(accessDist)) return false;
  const raw = readFileSync(accessDist, "utf8");
  const timeoutMs = krausestPuppeteerProtocolTimeoutMs();
  if (raw.includes("LUXEL_KRAUSEST_PROTOCOL_TIMEOUT")) {
    const next = raw.replace(
      /protocolTimeout:\s*\d+\s*,\s*\/\/\s*LUXEL_KRAUSEST_PROTOCOL_TIMEOUT/,
      `protocolTimeout: ${timeoutMs}, // LUXEL_KRAUSEST_PROTOCOL_TIMEOUT`,
    );
    if (next === raw) return false;
    writeFileSync(accessDist, next);
    return true;
  }
  const needle = `const browser = await puppeteer.launch({
        headless: false,
        executablePath: browserPath(benchmarkOptions),
        args,
        dumpio: false,
        defaultViewport: {`;
  if (!raw.includes(needle)) return false;
  const replacement = `const browser = await puppeteer.launch({
        headless: false,
        executablePath: browserPath(benchmarkOptions),
        args,
        dumpio: false,
        protocolTimeout: ${timeoutMs}, // LUXEL_KRAUSEST_PROTOCOL_TIMEOUT
        defaultViewport: {`;
  const next = raw.replace(needle, replacement);
  if (next === raw) return false;
  writeFileSync(accessDist, next);
  return true;
}

/**
 * Upstream `forceGC` awaits sync major GC (`flavor:'last-resort'`).
 * On heavy frameworks (reflex-dom GHCJS) that evaluate can hang past protocolTimeout.
 * Even `Promise.race` cannot cancel an in-flight CDP `Runtime.callFunctionOn` — the
 * session stays wedged until protocolTimeout fires → empty results on 04_select1k.
 * Skip awaiting GC entirely for CPU benches (best-effort fire-and-forget optional).
 */
export function patchKrausestForceGcTimeout(submodule: string): boolean {
  const forkedDist = join(submodule, "webdriver-ts/dist/forkedBenchmarkRunnerPuppeteer.js");
  if (!existsSync(forkedDist)) return false;
  const raw = readFileSync(forkedDist, "utf8");
  const skipBody = `async function forceGC(page) {
    // LUXEL_KRAUSEST_FORCE_GC
    // Never await page.evaluate here — hung GC wedges CDP until protocolTimeout.
    void page;
}`;
  if (raw.includes("Never await page.evaluate here")) return false;

  // Replace any prior forceGC (upstream last-resort or our Promise.race soft patch).
  const next = raw.replace(
    /async function forceGC\(page\) \{[\s\S]*?\n\}/,
    skipBody,
  );
  if (next === raw) return false;
  writeFileSync(forkedDist, next);
  return true;
}

export function krausestForceGcTimeoutMs(): number {
  const raw = process.env.KRAUSEST_FORCE_GC_TIMEOUT_MS?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 100) return Math.floor(n);
  }
  return 10_000;
}

/**
 * Chrome headless often reports `performance.getEntriesByType("paint")` as [] briefly
 * after networkidle0 even though the page painted → size runner throws on `.startTime`.
 * Poll until first-paint exists (or timeout).
 */
export function patchKrausestSizeFirstPaintWait(submodule: string): boolean {
  const sizeDist = join(submodule, "webdriver-ts/dist/forkedBenchmarkRunnerSize.js");
  if (!existsSync(sizeDist)) return false;
  const raw = readFileSync(sizeDist, "utf8");
  if (raw.includes("LUXEL_KRAUSEST_SIZE_FP_WAIT")) return false;
  const needle =
    'let paintEvents = JSON.parse(await page.evaluate(`JSON.stringify(performance.getEntriesByType("paint"))`));';
  if (!raw.includes(needle)) return false;
  const replacement = `// LUXEL_KRAUSEST_SIZE_FP_WAIT
            let paintEvents = [];
            for (let _fpTry = 0; _fpTry < 50; _fpTry++) {
                paintEvents = JSON.parse(await page.evaluate(\`JSON.stringify(performance.getEntriesByType("paint"))\`));
                if (paintEvents.some((e) => e.name === "first-paint")) break;
                await new Promise((r) => setTimeout(r, 100));
            }`;
  let next = raw.replace(needle, replacement);
  if (next === raw) return false;
  // Fail loud if paint still missing after poll (avoid opaque `.startTime` TypeError).
  next = next.replace(
    'sizeInfo.fp = paintEvents.find((e) => e.name === "first-paint").startTime;',
    'const _fp = paintEvents.find((e) => e.name === "first-paint"); if (!_fp) throw new Error("first-paint missing after wait"); sizeInfo.fp = _fp.startTime;',
  );
  writeFileSync(sizeDist, next);
  return true;
}

/**
 * Upstream `checkElementHasClass` returns `e.classList` (DOMTokenList) over CDP.
 * Serializing a live token list can hang `Runtime.callFunctionOn` on heavy frameworks
 * (reflex-dom GHCJS during 04_select1k) → protocolTimeout → empty stats.
 * Use `classList.contains` (boolean) instead.
 */
export function patchKrausestCheckElementHasClass(submodule: string): boolean {
  const accessDist = join(submodule, "webdriver-ts/dist/puppeteerAccess.js");
  if (!existsSync(accessDist)) return false;
  const raw = readFileSync(accessDist, "utf8");
  if (raw.includes("LUXEL_KRAUSEST_HAS_CLASS")) return false;
  const needle =
    /export async function checkElementHasClass\(page, selector, className\) \{[\s\S]*?\n\}/;
  if (!needle.test(raw)) return false;
  const replacement = `export async function checkElementHasClass(page, selector, className) {
    // LUXEL_KRAUSEST_HAS_CLASS — boolean over CDP; never return DOMTokenList
    let last = false;
    for (let k = 0; k < 10; k++) {
        let elem = await page.$(selector);
        if (elem) {
            last = await elem.evaluate((e, cn) => !!(e && e.classList && e.classList.contains(cn)), className);
            await elem.dispose();
            if (last)
                return;
        }
        await wait(k < 3 ? 10 : 1000);
    }
    throw \`checkElementHasClass \${selector} failed. expected \${className}, but was \${last}\`;
}`;
  const next = raw.replace(needle, replacement);
  if (next === raw) return false;
  writeFileSync(accessDist, next);
  return true;
}

/**
 * Upstream retries only "exactly one click event is expected".
 * Windows/headless traces also flake with "at most one mousedown event is expected".
 */
export function patchKrausestMousedownRetry(submodule: string): boolean {
  const forkedDist = join(submodule, "webdriver-ts/dist/forkedBenchmarkRunnerPuppeteer.js");
  if (!existsSync(forkedDist)) return false;
  const raw = readFileSync(forkedDist, "utf8");
  if (raw.includes("LUXEL_KRAUSEST_MOUSEDOWN_RETRY")) return false;
  // Match `if (...) {` and replace condition only — keep the single opening brace.
  const needle =
    /if \(error === "exactly one click event is expected"\) \{/;
  if (!needle.test(raw)) return false;
  const next = raw.replace(
    needle,
    `// LUXEL_KRAUSEST_MOUSEDOWN_RETRY
                if (error === "exactly one click event is expected" || error === "at most one mousedown event is expected") {`,
  );
  if (next === raw) return false;
  const withLog = next.replace(
    "*** Repeating run because of 'exactly one click event is expected' error",
    "*** Repeating run because of click/mousedown trace invariant error",
  );
  writeFileSync(forkedDist, withLog);
  return true;
}

export async function setupKrausestDriver(repoRoot: string): Promise<void> {
  const submodule = repoKrausestSubmodulePath(repoRoot);
  if (!existsSync(submodule)) {
    throw new Error("missing submodule — run: git submodule update --init vendor/js-framework-benchmark");
  }
  await ensureKrausestDriverBuilt(submodule);
}

export function krausestServerTsxCli(submodule: string): string {
  return resolve(submodule, "server/node_modules/tsx/dist/cli.mjs");
}

export function krausestBenchmarkRunnerScript(submodule: string): string {
  return resolve(submodule, "webdriver-ts/dist/benchmarkRunner.js");
}

export function krausestCreateResultScript(submodule: string): string {
  return resolve(submodule, "webdriver-ts/dist/createResultJS.js");
}
