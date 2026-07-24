/**
 * AFK gap verify: luxel vs vue-vapor.
 *
 * Env:
 * - KRAUSEST_DRIVER_COUNT (default 10)
 * - KRAUSEST_GAP_RUNS (default 1; use 3 for median-of-medians stability)
 * - KRAUSEST_GAP_SKIP_MEMORY=1 — duration+transfer only (faster; skip flaky memory)
 *
 * Writes:
 * - docs/benchmarks/runs/krausest-vue-vapor-gap-count{N}.{json,md}
 * - when GAP_RUNS>1, also …-stable.{json,md} (median across runs)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import {
  allKrausestDurationScenarios,
  allKrausestMemoryScenarios,
  allKrausestTransferScenarios,
  krausestRowsToBenchLines,
  runKrausestBench,
  type KrausestRunRow,
} from "../src/bench/krausest/run.ts";
import {
  detectKrausestFrameworks,
  findLuxelKrausestFramework,
} from "../src/bench/krausest/frameworks.ts";
import { repoKrausestSubmodulePath } from "../src/bench/krausest/contract.ts";

const repoRoot = join(import.meta.dir, "../../..");
const submodule = repoKrausestSubmodulePath(repoRoot);
const detected = detectKrausestFrameworks(submodule);
const luxel = findLuxelKrausestFramework(detected);
const vueVapor = detected.find(
  (f) => f.directory === "vue-vapor" && f.type === "non-keyed",
);

if (!luxel || !vueVapor) {
  console.error("missing luxel or vue-vapor framework metadata", {
    luxel: luxel?.label,
    vueVapor: vueVapor?.label,
  });
  process.exit(2);
}

process.env.KRAUSEST_DRIVER_COUNT ??= "10";
const count = process.env.KRAUSEST_DRIVER_COUNT;
const gapRuns = Math.max(1, Number(process.env.KRAUSEST_GAP_RUNS ?? "1") || 1);
const skipMemory = process.env.KRAUSEST_GAP_SKIP_MEMORY === "1";

type MetricKind = "duration" | "memory" | "transfer";

function kindOf(row: KrausestRunRow): MetricKind {
  if (row.memoryMb !== undefined && row.durationMs === 0) return "memory";
  if (row.transferKb !== undefined && row.durationMs === 0) return "transfer";
  return "duration";
}

function valueOf(row: KrausestRunRow): number {
  if (row.memoryMb !== undefined && row.durationMs === 0) return row.memoryMb;
  if (row.transferKb !== undefined && row.durationMs === 0) return row.transferKb;
  return row.durationMs;
}

function unitOf(kind: MetricKind): string {
  if (kind === "memory") return "MB";
  if (kind === "transfer") return "kB";
  return "ms";
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

type GapLine = {
  scenario: string;
  kind: MetricKind;
  luxel: number;
  vueVapor: number;
  ratio: number;
  status: "win" | "lose" | "tie";
};

const scenarioSpecs = [
  ...allKrausestDurationScenarios().map((s) => ({ scenario: s, kind: "duration" as const })),
  ...(skipMemory
    ? []
    : allKrausestMemoryScenarios().map((s) => ({ scenario: s, kind: "memory" as const }))),
  ...allKrausestTransferScenarios().map((s) => ({ scenario: s, kind: "transfer" as const })),
];

function gapsFromRows(rows: readonly KrausestRunRow[]): GapLine[] {
  const byKey = new Map<string, KrausestRunRow>();
  for (const row of rows) {
    byKey.set(`${row.framework}\0${row.scenario}\0${kindOf(row)}`, row);
  }
  const gaps: GapLine[] = [];
  for (const { scenario, kind } of scenarioSpecs) {
    const luxelRow = byKey.get(`${luxel!.label}\0${scenario}\0${kind}`);
    const vueRow = byKey.get(`${vueVapor!.label}\0${scenario}\0${kind}`);
    if (!luxelRow || !vueRow) {
      console.error(`missing row for ${scenario} (${kind})`);
      continue;
    }
    const luxelVal = valueOf(luxelRow);
    const vueVal = valueOf(vueRow);
    const ratio = vueVal === 0 ? Number.POSITIVE_INFINITY : luxelVal / vueVal;
    const status: GapLine["status"] =
      luxelVal < vueVal ? "win" : luxelVal > vueVal ? "lose" : "tie";
    gaps.push({ scenario, kind, luxel: luxelVal, vueVapor: vueVal, ratio, status });
  }
  return gaps;
}

function medianGaps(runGaps: GapLine[][]): GapLine[] {
  const out: GapLine[] = [];
  for (const { scenario, kind } of scenarioSpecs) {
    const luxelVals: number[] = [];
    const vueVals: number[] = [];
    for (const gaps of runGaps) {
      const line = gaps.find((g) => g.scenario === scenario && g.kind === kind);
      if (!line) continue;
      luxelVals.push(line.luxel);
      vueVals.push(line.vueVapor);
    }
    if (luxelVals.length === 0 || vueVals.length === 0) continue;
    const luxelVal = median(luxelVals);
    const vueVal = median(vueVals);
    const ratio = vueVal === 0 ? Number.POSITIVE_INFINITY : luxelVal / vueVal;
    const status: GapLine["status"] =
      luxelVal < vueVal ? "win" : luxelVal > vueVal ? "lose" : "tie";
    out.push({ scenario, kind, luxel: luxelVal, vueVapor: vueVal, ratio, status });
  }
  return out;
}

async function writeGapAsset(
  outDir: string,
  baseName: string,
  gaps: GapLine[],
  meta: Record<string, unknown>,
  rows: KrausestRunRow[] | null,
): Promise<void> {
  const stamp = new Date().toISOString();
  const jsonPath = join(outDir, `${baseName}.json`);
  const mdPath = join(outDir, `${baseName}.md`);
  const wins = gaps.filter((g) => g.status === "win").length;
  const losses = gaps.filter((g) => g.status === "lose").length;
  const ties = gaps.filter((g) => g.status === "tie").length;
  const payload = {
    generated: stamp,
    ...meta,
    luxel: luxel!.label,
    vueVapor: vueVapor!.label,
    chromePin: "chrome150",
    gaps,
    summary: { wins, losses, ties },
    ...(rows
      ? { rows, benchLines: krausestRowsToBenchLines(rows) }
      : {}),
  };
  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const mdLines = [
    `# Luxel vs Vue Vapor gap (DRIVER_COUNT=${count}${gapRuns > 1 ? `, GAP_RUNS=${gapRuns} median` : ""})`,
    "",
    `Generated: ${stamp}`,
    `Luxel: \`${luxel!.label}\``,
    `Vue Vapor: \`${vueVapor!.label}\``,
    `Chrome pin: chrome150`,
  ];
  if (gapRuns > 1) {
    mdLines.push(`Stability: median of ${gapRuns} independent DRIVER_COUNT=${count} runs.`);
  }
  mdLines.push(
    "",
    "Win rule: Luxel median < Vue Vapor median (lower is better).",
    "",
    "| Scenario | Kind | Luxel | Vue Vapor | Luxel/Vue | Status |",
    "| --- | --- | ---: | ---: | ---: | --- |",
  );
  for (const g of gaps) {
    const unit = unitOf(g.kind);
    mdLines.push(
      `| ${g.scenario} | ${g.kind} | ${g.luxel.toFixed(2)} ${unit} | ${g.vueVapor.toFixed(2)} ${unit} | ${g.ratio.toFixed(3)}× | ${g.status} |`,
    );
  }
  mdLines.push(
    "",
    `Summary: **${wins} win** / **${losses} lose** / **${ties} tie** of ${gaps.length} metrics.`,
    "",
    "Parent map: https://github.com/SynCROSS/luxel/issues/107",
    "Ticket: https://github.com/SynCROSS/luxel/issues/126",
    "Note: #126 — minify sync + rAF fixture; GAP_RUNS=5 **15/0**.",
    "",
  );
  await writeFile(mdPath, `${mdLines.join("\n")}\n`, "utf8");
  console.error(`wrote ${jsonPath}`);
  console.error(`wrote ${mdPath}`);
  console.error(`summary: ${wins} win / ${losses} lose / ${ties} tie`);
}

console.error(
  `gap verify: ${luxel.label} vs ${vueVapor.label} count=${count} runs=${gapRuns}`,
);

const outDir = join(repoRoot, "docs/benchmarks/runs");
await mkdir(outDir, { recursive: true });

const perRunGaps: GapLine[][] = [];
let lastRows: KrausestRunRow[] | null = null;

for (let run = 1; run <= gapRuns; run++) {
  const runBase = `krausest-vue-vapor-gap-count${count}-run${run}`;
  const runJsonPath = join(outDir, `${runBase}.json`);
  if (existsSync(runJsonPath)) {
    try {
      const prev = JSON.parse(await readFile(runJsonPath, "utf8")) as {
        gaps?: GapLine[];
      };
      if (Array.isArray(prev.gaps) && prev.gaps.length === scenarioSpecs.length) {
        console.error(`gap verify run ${run}/${gapRuns}: resume from ${runJsonPath}`);
        perRunGaps.push(prev.gaps);
        continue;
      }
    } catch {
      // fall through to fresh run
    }
  }
  console.error(`gap verify run ${run}/${gapRuns}`);
  const result = await runKrausestBench({
    repoRoot,
    frameworkLabels: [luxel.label, vueVapor.label],
    scenarios: [...allKrausestDurationScenarios()],
    memoryScenarios: skipMemory ? [] : [...allKrausestMemoryScenarios()],
    transferScenarios: [...allKrausestTransferScenarios()],
  });
  if (result.status === "pending") {
    console.error(result.reason);
    process.exit(1);
  }
  lastRows = result.rows;
  const gaps = gapsFromRows(result.rows);
  perRunGaps.push(gaps);
  await writeGapAsset(
    outDir,
    runBase,
    gaps,
    { driverCount: Number(count), gapRun: run, gapRuns },
    result.rows,
  );
}

const finalGaps = gapRuns === 1 ? perRunGaps[0]! : medianGaps(perRunGaps);
const baseName =
  gapRuns === 1
    ? `krausest-vue-vapor-gap-count${count}`
    : `krausest-vue-vapor-gap-count${count}-stable`;

await writeGapAsset(
  outDir,
  baseName,
  finalGaps,
  { driverCount: Number(count), gapRuns, aggregate: gapRuns > 1 ? "median" : "single" },
  gapRuns === 1 ? lastRows : null,
);

// Keep legacy count10 path when count=10 for map links.
if (count === "10") {
  await writeGapAsset(
    outDir,
    "krausest-vue-vapor-gap-count10",
    finalGaps,
    { driverCount: 10, gapRuns, aggregate: gapRuns > 1 ? "median" : "single" },
    gapRuns === 1 ? lastRows : null,
  );
}

const losses = finalGaps.filter((g) => g.status === "lose").length;
const wins = finalGaps.filter((g) => g.status === "win").length;
const ties = finalGaps.filter((g) => g.status === "tie").length;
process.exit(finalGaps.length === 0 || losses + wins + ties !== finalGaps.length ? 1 : 0);
