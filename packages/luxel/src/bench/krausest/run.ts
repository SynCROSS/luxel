import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import type { BenchJsonLine } from "../registry.ts";
import { median } from "../gate.ts";
import { findNodeExecutable } from "../../util/find-node.ts";
import { isHeadlessShellChrome, findChromeExecutable, resetChromeExecutableCache } from "../../util/find-chrome.ts";
import { killProcessTree } from "../../util/kill-process-tree.ts";
import {
  ensureKrausestDriverBuilt,
  ensureKrausestServerDeps,
  KRAUSEST_NPM_ENV,
  krausestBenchmarkRunnerScript,
  krausestCreateResultScript,
  krausestServerTsxCli,
  runKrausestNodeSync,
} from "./setup-driver.ts";
import { ensureKrausestComparisonFrameworks } from "./setup-frameworks.ts";
import { resolveKrausestChromeBinary, warnKrausestChromeVersion } from "./krausest-chrome.ts";
import {
  formatKrausestHarnessTimings,
  KrausestProgressTracker,
  logKrausestProgress,
  withKrausestPhaseTimeout,
} from "./progress.ts";
import { summarizeKrausestDriverFailure } from "./summary.ts";
import {
  installKrausestAbortHooks,
  killTrackedKrausestChildren,
  trackKrausestChild,
} from "./abort.ts";
import {
  KRAUSEST_DURATION_SCENARIOS,
  KRAUSEST_MEMORY_SCENARIOS,
  KRAUSEST_TRANSFER_SCENARIOS,
  KRAUSEST_SLICE1_SCENARIOS,
  KRAUSEST_UPSTREAM_BENCHMARK_IDS,
  KRAUSEST_UPSTREAM_MEMORY_IDS,
  KRAUSEST_UPSTREAM_SIZE_MAIN_ID,
  KRAUSEST_UPSTREAM_TRANSFER_IDS,
  krausestMemoryMetricId,
  krausestScenarioMetricId,
  krausestTransferMetricId,
  repoKrausestSubmodulePath,
  type KrausestDurationScenario,
} from "./contract.ts";
import {
  detectKrausestFrameworks,
  filterOfficialNonKeyedFrameworks,
  findLuxelKrausestFramework,
  resolveKrausestFrameworks,
  type KrausestFrameworkInfo,
} from "./frameworks.ts";

export type KrausestRunOptions = {
  repoRoot: string;
  scenarios?: readonly string[];
  memoryScenarios?: readonly string[];
  transferScenarios?: readonly string[];
  frameworkLabels?: readonly string[];
  includeAllFrameworks?: boolean;
  /** When true with includeAllFrameworks, run keyed + non-keyed (default: non-keyed only). */
  includeKeyedFrameworks?: boolean;
  /** When true with non-keyed full matrix, hard-fail if any official 66 missing after setup. */
  requireOfficialNonKeyedMatrix?: boolean;
  skipComparisonFrameworkSetup?: boolean;
};

export type KrausestRunRow = {
  framework: string;
  scenario: string;
  durationMs: number;
  memoryMb?: number;
  transferKb?: number;
};

const UPSTREAM_SCENARIO_BY_BENCH_ID = new Map<string, string>([
  ...Object.entries(KRAUSEST_UPSTREAM_BENCHMARK_IDS).map(([slug, benchId]) => [benchId, slug]),
  ...Object.entries(KRAUSEST_UPSTREAM_MEMORY_IDS).map(([slug, benchId]) => [benchId, slug]),
  ...Object.entries(KRAUSEST_UPSTREAM_TRANSFER_IDS).map(([slug, benchId]) => [benchId, slug]),
]);

const TRANSFER_BENCH_IDS = new Set<string>(Object.values(KRAUSEST_UPSTREAM_TRANSFER_IDS));
const MEMORY_BENCH_IDS = new Set<string>(Object.values(KRAUSEST_UPSTREAM_MEMORY_IDS));

function metricFromValueArrays(
  values: Record<string, number[]>,
  benchId: string,
): { durationMs?: number; memoryMb?: number; transferKb?: number } {
  if (values.total?.length) return { durationMs: median(values.total) };
  if (values.DEFAULT?.length) {
    const nums = values.DEFAULT;
    if (TRANSFER_BENCH_IDS.has(benchId)) return { transferKb: median(nums) };
    if (MEMORY_BENCH_IDS.has(benchId)) return { memoryMb: median(nums) };
    return { memoryMb: median(nums) };
  }
  const firstKey = Object.keys(values)[0];
  if (!firstKey) return {};
  const nums = values[firstKey]!;
  if (TRANSFER_BENCH_IDS.has(benchId)) return { transferKb: median(nums) };
  if (firstKey.toLowerCase().includes("memory") || MEMORY_BENCH_IDS.has(benchId)) {
    return { memoryMb: median(nums) };
  }
  return { durationMs: median(nums) };
}

/** Parse webdriver-ts `results.json` emitted by createResultJS. */
export function parseKrausestResultsJson(
  raw: unknown,
  officialFrameworkLabels?: readonly string[],
): KrausestRunRow[] {
  const entries = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { results?: unknown[] }).results)
      ? (raw as { results: Array<{ framework: string; benchmark: string; values: Record<string, number[]> }> })
          .results
      : [];
  const rows: KrausestRunRow[] = [];
  const allowedFrameworks = officialFrameworkLabels ? new Set(officialFrameworkLabels) : undefined;
  for (const entry of entries) {
    const framework = entry.framework;
    if (typeof framework !== "string" || (allowedFrameworks && !allowedFrameworks.has(framework))) {
      continue;
    }
    const scenario = UPSTREAM_SCENARIO_BY_BENCH_ID.get(entry.benchmark);
    if (!scenario) continue;
    const metrics = metricFromValueArrays(entry.values ?? {}, entry.benchmark);
    if (metrics.durationMs !== undefined) {
      rows.push({ framework, scenario, durationMs: metrics.durationMs });
    } else if (metrics.memoryMb !== undefined) {
      rows.push({ framework, scenario, durationMs: 0, memoryMb: metrics.memoryMb });
    } else if (metrics.transferKb !== undefined) {
      rows.push({ framework, scenario, durationMs: 0, transferKb: metrics.transferKb });
    }
  }
  return rows;
}

function selectedKrausestFrameworks(
  detected: readonly KrausestFrameworkInfo[],
  options: KrausestRunOptions,
): KrausestFrameworkInfo[] {
  if (options.frameworkLabels) return resolveKrausestFrameworks(detected, options.frameworkLabels);
  if (options.includeAllFrameworks) {
    if (options.includeKeyedFrameworks) return [...detected];
    if (options.requireOfficialNonKeyedMatrix) {
      return filterOfficialNonKeyedFrameworks(detected);
    }
    return detected.filter((framework) => framework.type === "non-keyed");
  }
  const luxel = findLuxelKrausestFramework(detected);
  return luxel ? [luxel] : [];
}

export function krausestRowsToBenchLines(rows: KrausestRunRow[]): BenchJsonLine[] {
  const lines: BenchJsonLine[] = [];
  for (const row of rows) {
    if (row.memoryMb !== undefined && row.durationMs === 0) {
      lines.push({
        fixture: "krausest",
        framework: row.framework,
        metric: krausestMemoryMetricId(String(row.scenario)),
        value: row.memoryMb,
      });
      continue;
    }
    if (row.transferKb !== undefined && row.durationMs === 0) {
      lines.push({
        fixture: "krausest",
        framework: row.framework,
        metric: krausestTransferMetricId(String(row.scenario)),
        value: row.transferKb,
      });
      continue;
    }
    lines.push({
      fixture: "krausest",
      framework: row.framework,
      metric: krausestScenarioMetricId(String(row.scenario)),
      value: row.durationMs,
    });
  }
  return lines;
}

export function filterKrausestRows(
  rows: KrausestRunRow[],
  scenarios: readonly string[],
  frameworkLabels: readonly string[],
): KrausestRunRow[] {
  const allowedScenarios = new Set(scenarios);
  const allowedFrameworks = new Set(frameworkLabels);
  return rows.filter(
    (row) => allowedScenarios.has(String(row.scenario)) && allowedFrameworks.has(row.framework),
  );
}

function krausestDriverIterationCount(): number {
  const raw = process.env.KRAUSEST_DRIVER_COUNT?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  }
  return 1;
}

/** Cap retained driver log bytes — full matrix logs can reach GB if unbounded. */
export const KRAUSEST_DRIVER_OUTPUT_TAIL_MAX = 32_768;

export function appendKrausestDriverOutputTail(
  acc: string,
  chunk: string,
  max = KRAUSEST_DRIVER_OUTPUT_TAIL_MAX,
): string {
  const combined = acc + chunk;
  if (combined.length <= max) return combined;
  return combined.slice(-max);
}

/** Split large framework matrices into fresh upstream driver processes (limits Node/Chrome RSS). */
export function krausestFrameworkBatchSize(frameworkCount: number): number {
  const raw = process.env.KRAUSEST_FRAMEWORK_BATCH_SIZE?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(Math.floor(parsed), frameworkCount);
    }
  }
  if (frameworkCount <= 12) return frameworkCount;
  return Math.min(8, frameworkCount);
}

export function chunkKrausestFrameworks<T>(items: readonly T[], batchSize: number): T[][] {
  if (batchSize >= items.length) return [items.slice()];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    chunks.push(items.slice(i, i + batchSize));
  }
  return chunks;
}

function clearKrausestDriverResults(submodule: string): void {
  const resultsDir = join(submodule, "webdriver-ts/results");
  if (existsSync(resultsDir)) {
    rmSync(resultsDir, { recursive: true, force: true });
  }
}

function upstreamBenchIds(
  scenarios: readonly string[],
  memoryScenarios: readonly string[],
  transferScenarios: readonly string[],
): string[] {
  const ids: string[] = [];
  for (const slug of scenarios) {
    const benchId = KRAUSEST_UPSTREAM_BENCHMARK_IDS[slug as KrausestDurationScenario];
    if (benchId) ids.push(benchId);
  }
  for (const slug of memoryScenarios) {
    const benchId = KRAUSEST_UPSTREAM_MEMORY_IDS[slug as keyof typeof KRAUSEST_UPSTREAM_MEMORY_IDS];
    if (benchId) ids.push(benchId);
  }
  if (transferScenarios.length > 0) ids.push(KRAUSEST_UPSTREAM_SIZE_MAIN_ID);
  return ids;
}

async function ensureKrausestBrowser(
  repoRoot: string,
  smoketest: boolean,
  needsMemoryApi: boolean,
): Promise<string> {
  if (smoketest) {
    let existing = findChromeExecutable();
    if (!existing) {
      const install = Bun.spawn(["bunx", "playwright", "install", "chromium"], {
        cwd: join(import.meta.dir, "../../../.."),
        stdout: "pipe",
        stderr: "pipe",
      });
      const code = await install.exited;
      if (code !== 0) {
        const err = await new Response(install.stderr).text();
        throw new Error(`playwright chromium install failed:\n${err}`);
      }
      resetChromeExecutableCache();
      existing = findChromeExecutable();
    }
    if (!existing) {
      throw new Error("playwright chromium install finished but browser path still missing");
    }
    if (needsMemoryApi && isHeadlessShellChrome(existing)) {
      throw new Error(
        "krausest memory benchmarks need full Chrome/Chromium, not chrome-headless-shell.",
      );
    }
    return existing;
  }

  const resolution = await resolveKrausestChromeBinary(repoRoot, needsMemoryApi);
  warnKrausestChromeVersion(resolution);
  return resolution.path;
}

async function runKrausestDriver(
  submodule: string,
  args: string[],
  progress?: KrausestProgressTracker,
): Promise<string> {
  const node = findNodeExecutable();
  if (!node) {
    throw new Error("node executable not found — install Node 20+ for krausest driver");
  }

  const runner = krausestBenchmarkRunnerScript(submodule);
  if (!existsSync(runner)) {
    throw new Error("krausest benchmarkRunner.js missing — run: bun packages/luxel/scripts/setup-krausest-driver.ts");
  }

  const webdriverDir = join(submodule, "webdriver-ts");
  const child = spawn(node, [runner, ...args], {
    cwd: webdriverDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...KRAUSEST_NPM_ENV, LANG: "en_US.UTF-8" },
    windowsHide: true,
  });
  trackKrausestChild(child);
  return await new Promise<string>((resolve, reject) => {
    let out = "";
    let pending = "";
    const flushLines = (chunk: string) => {
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (!progress) continue;
        const state = progress.onDriverLine(line);
        if (state) logKrausestProgress(state, false);
      }
    };
    child.stdout?.on("data", (chunk) => {
      const text = String(chunk);
      out = appendKrausestDriverOutputTail(out, text);
      flushLines(text);
    });
    child.stderr?.on("data", (chunk) => {
      const text = String(chunk);
      out = appendKrausestDriverOutputTail(out, text);
      flushLines(text);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (pending && progress) {
        const state = progress.onDriverLine(pending);
        if (state) logKrausestProgress(state, true);
      }
      progress?.finalize();
      if (code !== 0) reject(new Error(`krausest benchmarkRunner exit ${code}:\n${out}`));
      else resolve("");
    });
  });
}

async function krausestServerReady(host: string, port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://${host}:${port}/ls`, { signal: AbortSignal.timeout(2_000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureKrausestServer(submodule: string): Promise<{ child: ChildProcess | null }> {
  await ensureKrausestServerDeps(submodule);
  const host = process.env.KRAUSEST_HOST ?? "localhost";
  const port = Number(process.env.KRAUSEST_PORT ?? 8080);
  if (await krausestServerReady(host, port)) return { child: null };

  const node = findNodeExecutable();
  if (!node) {
    throw new Error("node executable not found — install Node 20+ for krausest server");
  }

  const serverDir = join(submodule, "server");
  const tsxCli = krausestServerTsxCli(submodule);
  if (!existsSync(tsxCli)) {
    throw new Error("krausest server deps missing — run: bun packages/luxel/scripts/setup-krausest-driver.ts");
  }

  let serverLog = "";
  // Non-detached so Ctrl+C / finally can taskkill /T the whole tree (server + children).
  const child = spawn(node, [tsxCli, "index.ts"], {
    cwd: serverDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: KRAUSEST_NPM_ENV,
    windowsHide: true,
  });
  trackKrausestChild(child);
  child.stdout?.on("data", (chunk) => {
    serverLog += String(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    serverLog += String(chunk);
  });

  for (let attempt = 0; attempt < 60; attempt++) {
    if (await krausestServerReady(host, port)) return { child };
    await Bun.sleep(500);
  }
  killProcessTree(child.pid);
  throw new Error(
    `krausest server not ready on http://${host}:${port}/ls${serverLog ? `:\n${serverLog.trim()}` : ""}`,
  );
}

export async function runKrausestBench(options: KrausestRunOptions): Promise<
  | { status: "ok"; rows: KrausestRunRow[] }
  | { status: "pending"; reason: string }
> {
  const submodule = repoKrausestSubmodulePath(options.repoRoot);
  if (!existsSync(submodule)) {
    return { status: "pending", reason: "vendor/js-framework-benchmark submodule missing" };
  }
  const luxelFramework = join(submodule, "frameworks/non-keyed/luxel/index.html");
  if (!existsSync(luxelFramework)) {
    return {
      status: "pending",
      reason: "krausest luxel framework missing — run examples/krausest-table sync:krausest",
    };
  }

  const detectedFrameworks = detectKrausestFrameworks(submodule);
  let selectedFrameworks = selectedKrausestFrameworks(detectedFrameworks, options);
  const luxelFrameworkInfo = findLuxelKrausestFramework(selectedFrameworks);
  if (!luxelFrameworkInfo) {
    return { status: "pending", reason: "krausest luxel framework metadata missing" };
  }

  const scenarios = options.scenarios ?? KRAUSEST_SLICE1_SCENARIOS;
  const memoryScenarios = options.memoryScenarios ?? [];
  const transferScenarios = options.transferScenarios ?? [];
  let frameworkLabels = selectedFrameworks.map((framework) => framework.label);

  let serverChild: ChildProcess | null = null;
  let setupZipMs = 0;
  let setupRebuildMs = 0;
  installKrausestAbortHooks();
  try {
    await withKrausestPhaseTimeout("driver-build", async () => {
      await ensureKrausestDriverBuilt(submodule);
    });
    if (!options.skipComparisonFrameworkSetup) {
      const setup = await ensureKrausestComparisonFrameworks(
        submodule,
        selectedFrameworks,
        options.repoRoot,
        {
          requireOfficialNonKeyedMatrix: options.requireOfficialNonKeyedMatrix,
          useBuildZip: true,
        },
      );
      setupZipMs = setup.zipMs;
      setupRebuildMs = setup.rebuildMs;
    }
    ({ child: serverChild } = await withKrausestPhaseTimeout("server-ready", async () =>
      ensureKrausestServer(submodule),
    ));

    const smoketest =
      process.env.LUXEL_KRAUSEST_SMOKETEST === "1" || process.env.LUXEL_KRAUSEST_SMOKETEST === "true";
    const needsMemoryApi = memoryScenarios.length > 0;
    const chromeBinary = await withKrausestPhaseTimeout("chrome-resolve", async () =>
      ensureKrausestBrowser(options.repoRoot, smoketest, needsMemoryApi),
    );
    // Prefer headless for full Chrome (stable on Windows — headed picks up stray mouse).
    // Upstream default is headed; force with LUXEL_KRAUSEST_FORCE_HEADED=1 if needed.
    // chrome-headless-shell cannot use --headless flag the same way — skip when shell.
    const forceHeaded =
      process.env.LUXEL_KRAUSEST_FORCE_HEADED === "1" ||
      process.env.LUXEL_KRAUSEST_FORCE_HEADED === "true";
    const useHeadless = !forceHeaded && !isHeadlessShellChrome(chromeBinary);
    console.error(useHeadless ? "krausest: headless Chrome" : "krausest: headed Chrome");
    const benchIds = upstreamBenchIds(scenarios, memoryScenarios, transferScenarios);
    const baseDriverArgs = [
      "--chromeBinary",
      chromeBinary,
      ...(useHeadless ? ["--headless"] : []),
      "--count",
      String(krausestDriverIterationCount()),
    ];
    const benchIdArgs = benchIds.flatMap((benchId) => ["--benchmark", benchId]);
    const frameworkBatches = chunkKrausestFrameworks(
      selectedFrameworks,
      krausestFrameworkBatchSize(selectedFrameworks.length),
    );
    const progress = new KrausestProgressTracker(
      selectedFrameworks.length,
      benchIds.length,
      selectedFrameworks.map((framework) => ({
        driverPath: framework.driverPath,
        label: framework.label,
        customURL: framework.customURL,
      })),
    );
    clearKrausestDriverResults(submodule);
    let driverMs = 0;
    for (let batchIndex = 0; batchIndex < frameworkBatches.length; batchIndex++) {
      const batch = frameworkBatches[batchIndex]!;
      if (frameworkBatches.length > 1) {
        console.error(
          `krausest driver batch ${batchIndex + 1}/${frameworkBatches.length} (${batch.length} frameworks)`,
        );
      }
      const driverArgs = [
        ...baseDriverArgs,
        ...batch.flatMap((framework) => ["--framework", framework.driverPath]),
        ...benchIdArgs,
      ];
      const driverStart = Date.now();
      await withKrausestPhaseTimeout("driver-batch", async () => {
        await runKrausestDriver(submodule, driverArgs, progress);
      });
      driverMs += Date.now() - driverStart;
      if (batchIndex < frameworkBatches.length - 1 && typeof Bun !== "undefined" && "gc" in Bun) {
        Bun.gc(true);
      }
    }
    console.error(
      formatKrausestHarnessTimings({
        zipMs: setupZipMs,
        rebuildMs: setupRebuildMs,
        driverMs,
      }),
    );
    const aggregate = runKrausestNodeSync(
      join(submodule, "webdriver-ts"),
      krausestCreateResultScript(submodule),
    );
    if (aggregate.status !== 0) {
      throw new Error(`krausest createResultJS failed:\n${aggregate.stdout}\n${aggregate.stderr}`);
    }

    const resultsPath = join(submodule, "webdriver-ts/results.json");
    if (!existsSync(resultsPath)) {
      return { status: "pending", reason: "krausest results.json missing after driver run" };
    }
    const raw = JSON.parse(await Bun.file(resultsPath).text()) as unknown;
    const rows = filterKrausestRows(
      parseKrausestResultsJson(raw, frameworkLabels),
      [...scenarios, ...memoryScenarios, ...transferScenarios],
      frameworkLabels,
    );
    if (rows.length === 0) {
      return { status: "pending", reason: "no krausest rows parsed" };
    }
    return { status: "ok", rows };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "krausest driver failed";
    return {
      status: "pending",
      reason: summarizeKrausestDriverFailure(raw),
    };
  } finally {
    killProcessTree(serverChild?.pid);
    killTrackedKrausestChildren();
  }
}

export function allKrausestDurationScenarios(): readonly string[] {
  return KRAUSEST_DURATION_SCENARIOS;
}

export function allKrausestMemoryScenarios(): readonly string[] {
  return KRAUSEST_MEMORY_SCENARIOS;
}

export function allKrausestTransferScenarios(): readonly string[] {
  return KRAUSEST_TRANSFER_SCENARIOS;
}
