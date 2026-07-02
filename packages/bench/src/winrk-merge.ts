import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { WinrkBenchResult } from "./winrk/registry.ts";
import type { WinrkFixtureId } from "./winrk/registry.ts";
import {
  evaluateWinrkReproGate,
  formatWinrkReproGateFailures,
} from "./winrk/repro-gate.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

type FixturePayload = {
  type: "winrk_bench";
  generatedAt: string;
  host: string;
  tool: { name: string; path: string };
  params: Record<string, number>;
  fixture: WinrkFixtureId;
  results: WinrkBenchResult[];
};

function fixturePath(fixture: WinrkFixtureId): string {
  const base = fixture === "counter" ? "winrk-latest" : `winrk-${fixture}-latest`;
  return join(repoRoot, "docs/benchmarks/runs", `${base}.json`);
}

async function readFixture(fixture: WinrkFixtureId): Promise<FixturePayload | null> {
  try {
    const raw = await readFile(fixturePath(fixture), "utf8");
    return JSON.parse(raw) as FixturePayload;
  } catch {
    return null;
  }
}

async function main() {
  const counter = await readFixture("counter");
  const spiral = await readFixture("spiral");
  if (!counter && !spiral) {
    console.error("no fixture JSON found — run bench:winrk for counter and/or spiral first");
    process.exit(1);
  }

  const generatedAt = spiral?.generatedAt ?? counter!.generatedAt;
  const meta = spiral ?? counter!;
  const fixtures: Partial<Record<WinrkFixtureId, WinrkBenchResult[]>> = {};
  if (counter) fixtures.counter = counter.results;
  if (spiral) fixtures.spiral = spiral.results;

  const outDir = join(repoRoot, "docs/benchmarks/runs");
  await mkdir(outDir, { recursive: true });
  const payload = {
    type: "winrk_bench_all" as const,
    generatedAt,
    host: meta.host,
    tool: meta.tool,
    params: meta.params,
    fixtures,
  };
  await writeFile(join(outDir, "winrk-all-latest.json"), `${JSON.stringify(payload, null, 2)}\n`);
  console.error("wrote docs/benchmarks/runs/winrk-all-latest.json");

  const failures: string[] = [];
  if (process.env.BENCH_REPRO_GATE === "1") {
    for (const fixture of ["counter", "spiral"] as const) {
      const rows = fixtures[fixture];
      if (!rows) continue;
      const gate = evaluateWinrkReproGate(fixture, rows);
      if (!gate.ok) {
        failures.push(`${fixture}:\n${formatWinrkReproGateFailures(gate.failures)}`);
      }
    }
  }
  if (failures.length > 0) {
    console.error(`repro merge gate failed:\n${failures.join("\n\n")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
