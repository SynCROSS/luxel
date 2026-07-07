import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ChildProcess } from "node:child_process";
import type { BenchJsonLine } from "../registry.ts";
import { median } from "../gate.ts";
import {
  KRAUSEST_COMPARISON_FRAMEWORKS,
  KRAUSEST_DURATION_SCENARIOS,
  KRAUSEST_FRAMEWORK_MAP,
  KRAUSEST_MEMORY_SCENARIOS,
  KRAUSEST_SLICE1_SCENARIOS,
  KRAUSEST_UPSTREAM_BENCHMARK_IDS,
  KRAUSEST_UPSTREAM_MEMORY_IDS,
  krausestDriverFrameworkPaths,
  krausestMemoryMetricId,
  krausestScenarioMetricId,
  repoKrausestSubmodulePath,
  type KrausestDurationScenario,
} from "./contract.ts";

export type KrausestRunOptions = {
  repoRoot: string;
  scenarios?: readonly string[];
  memoryScenarios?: readonly string[];
  frameworkLabels?: readonly (typeof KRAUSEST_COMPARISON_FRAMEWORKS)[number][];
};

export type KrausestRunRow = {
  framework: string;
  scenario: KrausestDurationScenario | string;
  durationMs: number;
  memoryMb?: number;
};

const UPSTREAM_SCENARIO_BY_BENCH_ID = new Map<string, string>([
  ...Object.entries(KRAUSEST_UPSTREAM_BENCHMARK_IDS).map(([slug, benchId]) => [benchId, slug]),
  ...Object.entries(KRAUSEST_UPSTREAM_MEMORY_IDS).map(([slug, benchId]) => [benchId, slug]),
]);

function mapFrameworkLabel(upstreamId: string): string | null {
  if (KRAUSEST_FRAMEWORK_MAP[upstreamId]) return KRAUSEST_FRAMEWORK_MAP[upstreamId]!;
  for (const [key, label] of Object.entries(KRAUSEST_FRAMEWORK_MAP)) {
    if (upstreamId.startsWith(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))) return label;
  }
  return null;
}

function metricFromValueArrays(values: Record<string, number[]>): { durationMs?: number; memoryMb?: number } {
  if (values.total?.length) return { durationMs: median(values.total) };
  if (values.DEFAULT?.length) return { memoryMb: median(values.DEFAULT) };
  const firstKey = Object.keys(values)[0];
  if (!firstKey) return {};
  const nums = values[firstKey]!;
  if (firstKey.toLowerCase().includes("memory")) return { memoryMb: median(nums) };
  return { durationMs: median(nums) };
}

/** Parse webdriver-ts `results.json` emitted by createResultJS. */
export function parseKrausestResultsJson(raw: unknown): KrausestRunRow[] {
  const entries = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { results?: unknown[] }).results)
      ? (raw as { results: Array<{ framework: string; benchmark: string; values: Record<string, number[]> }> })
          .results
      : [];
  const rows: KrausestRunRow[] = [];
  for (const entry of entries) {
    const framework = mapFrameworkLabel(entry.framework);
    if (!framework) continue;
    const scenario = UPSTREAM_SCENARIO_BY_BENCH_ID.get(entry.benchmark);
    if (!scenario) continue;
    const metrics = metricFromValueArrays(entry.values ?? {});
    if (metrics.durationMs !== undefined) {
      rows.push({ framework, scenario, durationMs: metrics.durationMs });
    } else if (metrics.memoryMb !== undefined) {
      rows.push({ framework, scenario, durationMs: 0, memoryMb: metrics.memoryMb });
    }
  }
  return rows;
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
    lines.push({
      fixture: "krausest",
      framework: row.framework,
      metric: krausestScenarioMetricId(String(row.scenario)),
      value: row.durationMs,
    });
  }
  return lines;
}

function upstreamBenchIds(
  scenarios: readonly string[],
  memoryScenarios: readonly string[],
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
  return ids;
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
  const host = process.env.KRAUSEST_HOST ?? "localhost";
  const port = Number(process.env.KRAUSEST_PORT ?? 8080);
  if (await krausestServerReady(host, port)) return { child: null };

  const { spawn } = await import("node:child_process");
  const child = spawn("npm", ["start"], {
    cwd: submodule,
    shell: true,
    stdio: "ignore",
    detached: true,
  });
  child.unref();

  for (let attempt = 0; attempt < 60; attempt++) {
    if (await krausestServerReady(host, port)) return { child };
    await Bun.sleep(500);
  }
  child.kill();
  throw new Error(`krausest server not ready on http://${host}:${port}/ls`);
}

async function ensureKrausestDriverBuilt(submodule: string): Promise<void> {
  const runner = join(submodule, "webdriver-ts/dist/benchmarkRunner.js");
  if (existsSync(runner)) return;
  const { spawnSync } = await import("node:child_process");
  const install = spawnSync("npm", ["run", "install-webdriver-ts"], {
    cwd: submodule,
    shell: true,
    stdio: "pipe",
    encoding: "utf8",
  });
  if (install.status !== 0) {
    throw new Error(`krausest webdriver-ts install failed:\n${install.stdout}\n${install.stderr}`);
  }
}

async function runNpm(submodule: string, args: string[]): Promise<string> {
  const { spawn } = await import("node:child_process");
  const child = spawn("npm", args, {
    cwd: submodule,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return await new Promise<string>((resolve, reject) => {
    let out = "";
    child.stdout?.on("data", (chunk) => {
      out += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      out += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`npm ${args.join(" ")} exit ${code}:\n${out}`));
      else resolve(out);
    });
  });
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

  const scenarios = options.scenarios ?? KRAUSEST_SLICE1_SCENARIOS;
  const memoryScenarios = options.memoryScenarios ?? [];
  const frameworkLabels = options.frameworkLabels ?? ["luxel"];

  let serverChild: ChildProcess | null = null;
  try {
    await ensureKrausestDriverBuilt(submodule);
    ({ child: serverChild } = await ensureKrausestServer(submodule));

    const smoketest =
      process.env.LUXEL_KRAUSEST_SMOKETEST === "1" || process.env.LUXEL_KRAUSEST_SMOKETEST === "true";
    const benchArgs = [
      "run",
      "bench",
      "--",
      ...krausestDriverFrameworkPaths(frameworkLabels).flatMap((fw) => ["--framework", fw]),
      ...upstreamBenchIds(scenarios, memoryScenarios).flatMap((benchId) => ["--benchmark", benchId]),
      ...(smoketest ? ["--smoketest"] : []),
    ];
    await runNpm(submodule, benchArgs);
    const { spawnSync } = await import("node:child_process");
    const aggregate = spawnSync("node", ["dist/createResultJS.js"], {
      cwd: join(submodule, "webdriver-ts"),
      shell: true,
      stdio: "pipe",
      encoding: "utf8",
    });
    if (aggregate.status !== 0) {
      throw new Error(`krausest createResultJS failed:\n${aggregate.stdout}\n${aggregate.stderr}`);
    }

    const resultsPath = join(submodule, "webdriver-ts/results.json");
    if (!existsSync(resultsPath)) {
      return { status: "pending", reason: "krausest results.json missing after driver run" };
    }
    const raw = JSON.parse(await Bun.file(resultsPath).text()) as unknown;
    const allowedScenarios = new Set([...scenarios, ...memoryScenarios]);
    const rows = parseKrausestResultsJson(raw).filter((row) =>
      allowedScenarios.has(String(row.scenario)),
    );
    if (rows.length === 0) {
      return { status: "pending", reason: "no krausest rows parsed" };
    }
    return { status: "ok", rows };
  } catch (err) {
    return {
      status: "pending",
      reason: err instanceof Error ? err.message : "krausest driver failed",
    };
  } finally {
    serverChild?.kill();
  }
}

export function allKrausestComparisonFrameworks(): readonly (typeof KRAUSEST_COMPARISON_FRAMEWORKS)[number][] {
  return KRAUSEST_COMPARISON_FRAMEWORKS;
}

export function allKrausestDurationScenarios(): readonly string[] {
  return KRAUSEST_DURATION_SCENARIOS;
}

export function allKrausestMemoryScenarios(): readonly string[] {
  return KRAUSEST_MEMORY_SCENARIOS;
}
