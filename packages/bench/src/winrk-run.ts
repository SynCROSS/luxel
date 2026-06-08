import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  runAllWinrkStacks,
  stacksForFixture,
  type WinrkBenchResult,
  type WinrkFixtureId,
} from "./winrk/registry.ts";
import { resolveWinrk } from "./winrk/resolve.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function parseFixture(raw: string | undefined): WinrkFixtureId {
  const norm = raw?.trim().replace(/^["']|["']$/g, "").toLowerCase();
  if (norm === "spiral") return "spiral";
  if (norm && norm !== "counter") {
    console.error(
      `unknown WINRK_FIXTURE=${JSON.stringify(raw)} — falling back to counter (valid: counter, spiral)`,
    );
  }
  return "counter";
}

function toMarkdown(
  results: WinrkBenchResult[],
  meta: Record<string, unknown> & { fixture: string },
): string {
  const lines = [
    "# WinRK benchmark results",
    "",
    `Generated: ${meta.generatedAt}`,
    `Tool: ${meta.winrkPath}`,
    `Duration: ${meta.durationSec}s | Connections: ${meta.connections} | Threads: ${meta.threads}`,
    `Fixture: ${meta.fixture} (see docs/benchmarks/fairness.md)`,
    "",
    "| Stack | Framework | Mode | RPS | Latency avg | Status |",
    "|-------|-----------|------|-----|-------------|--------|",
  ];
  for (const row of results) {
    if (row.status === "ok") {
      lines.push(
        `| ${row.id} | ${row.framework} | ${row.mode} | ${row.requestsPerSec.toFixed(2)} | ${row.latencyAvgMs?.toFixed(2) ?? "—"} ms | ok |`,
      );
    } else {
      lines.push(`| ${row.id} | ${row.framework} | ${row.mode} | — | — | ${row.status}: ${row.reason} |`);
    }
  }
  lines.push(
    "",
    "## Notes",
    "",
    "- Deployed HTTP servers; measured with [winrk](https://github.com/fomalhaut88/winrk) on Windows.",
    "- CSR rows serve production-built static `index.html` + client bundle.",
    "- SSR/RSC/ISR rows render per request (Luxel ISR uses html cache with 1s TTL).",
    "- Spiral rows = tier-2 Platformatic workload (~2.4k tiles); see docs/benchmarks/ssr-showdown.md.",
    "",
  );
  return lines.join("\n");
}

function outputBasename(fixture: WinrkFixtureId): string {
  return fixture === "counter" ? "winrk-latest" : `winrk-${fixture}-latest`;
}

async function writeFixtureRun(
  fixture: WinrkFixtureId,
  results: WinrkBenchResult[],
  meta: {
    generatedAt: string;
    winrkPath: string;
    durationSec: number;
    connections: number;
    threads: number;
  },
): Promise<void> {
  const outDir = join(repoRoot, "docs/benchmarks/runs");
  await mkdir(outDir, { recursive: true });
  const base = outputBasename(fixture);
  const payload = {
    type: "winrk_bench",
    generatedAt: meta.generatedAt,
    host: "win32",
    tool: { name: "winrk", path: meta.winrkPath },
    params: {
      durationSec: meta.durationSec,
      connections: meta.connections,
      threads: meta.threads,
    },
    fixture,
    results,
  };
  await writeFile(join(outDir, `${base}.json`), `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(
    join(outDir, `${base}.md`),
    toMarkdown(results, { ...meta, fixture }),
  );
  await writeFile(
    join(outDir, `${base}.jsonl`),
    `${results.map((r) => JSON.stringify(r)).join("\n")}\n`,
  );
  console.error(`wrote docs/benchmarks/runs/${base}.{json,md,jsonl}`);
}

async function main() {
  const winrkPath = resolveWinrk();
  const durationSec = Number(process.env.WINRK_DURATION ?? "15");
  const connections = Number(process.env.WINRK_CONNECTIONS ?? "400");
  const threads = Number(process.env.WINRK_THREADS ?? "8");
  const fixture = parseFixture(process.env.WINRK_FIXTURE);
  const generatedAt = new Date().toISOString();
  const meta = { generatedAt, winrkPath, durationSec, connections, threads };

  console.error(`winrk: ${winrkPath}`);
  console.error(`fixture: ${fixture}`);
  console.error(`running ${durationSec}s @ ${connections} conn, ${threads} threads`);

  const results = await runAllWinrkStacks(stacksForFixture(fixture));
  await writeFixtureRun(fixture, results, meta);
  for (const row of results) {
    console.log(JSON.stringify(row));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
