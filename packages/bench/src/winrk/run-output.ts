import { writeFile, mkdir, appendFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { WinrkBenchResult, WinrkFixtureId } from "./registry.ts";
import { benchLatencySampleCount } from "./bench-latency-config.ts";
import { resolveBenchLoadTesterMeta, type BenchLoadTester } from "./load-test.ts";
import { winrkDefaultThreads } from "./hardware-concurrency.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

export type RunMeta = {
  generatedAt: string;
  loadTester: BenchLoadTester;
  loadTesterPath: string;
  durationSec: number;
  connections: number;
  threads: number;
};

export function buildRunMeta(generatedAt: string): RunMeta {
  const loadTester = resolveBenchLoadTesterMeta();
  return {
    generatedAt,
    loadTester: loadTester.name,
    loadTesterPath: loadTester.path,
    durationSec: Number(process.env.WINRK_DURATION ?? "15"),
    connections: Number(process.env.WINRK_CONNECTIONS ?? "400"),
    threads: winrkDefaultThreads(),
  };
}

function toMarkdown(
  results: WinrkBenchResult[],
  meta: Record<string, unknown> & { fixture: string },
): string {
  const lines = [
    "# WinRK benchmark results",
    "",
    `Generated: ${meta.generatedAt}`,
    `Load tester: ${meta.loadTester} (${meta.loadTesterPath})`,
    `Duration: ${meta.durationSec}s | Connections: ${meta.connections} | Threads: ${meta.threads}`,
    `Fixture: ${meta.fixture} (see docs/benchmarks/fairness.md)`,
    "",
    "| Stack | Framework | Role | Mode | RPS | p50 | p95 | p99 | CPU avg | Mem peak | Response | Errors | Status |",
    "|-------|-----------|------|------|-----|-----|-----|-----|---------|----------|----------|--------|--------|",
  ];
  for (const row of results) {
    if (row.status === "ok") {
      const cpu = row.resources?.cpuAvgPercent;
      const mem = row.resources?.memoryPeakMb;
      lines.push(
        `| ${row.id} | ${row.framework} | ${row.role ?? "—"} | ${row.mode} | ${row.requestsPerSec.toFixed(2)} | ${row.latencyP50Ms?.toFixed(2) ?? "—"} | ${row.latencyP95Ms?.toFixed(2) ?? "—"} | ${row.latencyP99Ms?.toFixed(2) ?? "—"} | ${cpu !== undefined ? `${cpu.toFixed(1)}%` : "—"} | ${mem !== undefined ? `${mem.toFixed(1)} MB` : "—"} | ${row.responseBytesLabel ?? "—"} | ${row.errorRatePercent?.toFixed(2) ?? "0"}% | ok |`,
      );
    } else {
      lines.push(
        `| ${row.id} | ${row.framework} | ${row.role ?? "—"} | ${row.mode} | — | — | — | — | — | — | — | — | ${row.status}: ${row.reason} |`,
      );
    }
  }
  lines.push(
    "",
    "## Notes",
    "",
    "- Deployed HTTP servers; load test via winrk or bombardier (`BENCH_LOAD_TESTER`).",
    "- RPS from load tester; p95/p99 from post-load latency sample (after cooldown; platform default sample count).",
    "- CPU/memory sampled during load-test window; response bytes = HTML body weight.",
    "- CSR rows serve production-built static `index.html` + client bundle.",
    "- Counter SSR: inline tier (Bun.serve) + prod-stack tier (Next/SolidStart/SvelteKit) — see docs/benchmarks/fairness.md.",
    "- Luxel ISR uses html cache with 1s TTL.",
    "- Spiral rows = tier-2 Platformatic workload (~2.4k tiles); see docs/benchmarks/ssr-showdown.md.",
    "- All rows: NODE_ENV=production + JIT warmup before winrk (see docs/benchmarks/stacks.md).",
    "- Dashboard: `bun run bench:dashboard` in packages/bench.",
    "",
  );
  return lines.join("\n");
}

function outputBasename(fixture: WinrkFixtureId): string {
  return fixture === "counter" ? "winrk-latest" : `winrk-${fixture}-latest`;
}

export type StackObservabilityLine =
  | {
      stackId: string;
      status: "ok";
      generatedAt: string;
      requestsPerSec: number;
      latencyP50Ms?: number;
      latencyP95Ms?: number;
      errorRatePercent?: number;
      raw: string;
    }
  | {
      stackId: string;
      status: "pending" | "error";
      generatedAt: string;
      reason: string;
    };

export function stackObservabilityFromResult(
  row: WinrkBenchResult,
  generatedAt: string,
): StackObservabilityLine {
  if (row.status === "ok") {
    return {
      stackId: row.id,
      status: row.status,
      generatedAt,
      requestsPerSec: row.requestsPerSec,
      latencyP50Ms: row.latencyP50Ms,
      latencyP95Ms: row.latencyP95Ms,
      errorRatePercent: row.errorRatePercent,
      raw: row.winrk.raw,
    };
  }
  return {
    stackId: row.id,
    status: row.status,
    generatedAt,
    reason: row.reason,
  };
}

export async function appendStackObservabilityLine(
  fixture: WinrkFixtureId,
  line: StackObservabilityLine,
): Promise<void> {
  const outDir = join(repoRoot, "docs/benchmarks/runs/stacks", fixture);
  await mkdir(outDir, { recursive: true });
  await appendFile(join(outDir, `${line.stackId}.jsonl`), `${JSON.stringify(line)}\n`);
}

export async function writeFixtureRun(
  fixture: WinrkFixtureId,
  results: WinrkBenchResult[],
  meta: RunMeta,
  opts?: { announce?: boolean },
): Promise<void> {
  const outDir = join(repoRoot, "docs/benchmarks/runs");
  await mkdir(outDir, { recursive: true });
  const base = outputBasename(fixture);
  const payload = {
    type: "winrk_bench",
    generatedAt: meta.generatedAt,
    host: "win32",
    tool: { name: meta.loadTester, path: meta.loadTesterPath },
    params: {
      durationSec: meta.durationSec,
      connections: meta.connections,
      threads: meta.threads,
      latencySamples: benchLatencySampleCount(),
    },
    fixture,
    results,
  };
  await writeFile(join(outDir, `${base}.json`), `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(join(outDir, `${base}.md`), toMarkdown(results, { ...meta, fixture }));
  await writeFile(
    join(outDir, `${base}.jsonl`),
    `${results.map((r) => JSON.stringify(r)).join("\n")}\n`,
  );
  if (opts?.announce !== false) {
    console.error(`wrote docs/benchmarks/runs/${base}.{json,md,jsonl}`);
    console.error(`per-stack observability: docs/benchmarks/runs/stacks/${fixture}/*.jsonl`);
  }
}
