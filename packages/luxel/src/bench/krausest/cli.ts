import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import type { BenchJsonLine } from "../registry.ts";
import { evaluateKrausestTier } from "../gate.ts";
import { repoKrausestSubmodulePath } from "./contract.ts";
import { detectKrausestFrameworks, findLuxelKrausestFramework, resolveKrausestCompareFrameworks, resolveKrausestOfficialNonKeyedFrameworks } from "./frameworks.ts";
import {
  allKrausestDurationScenarios,
  allKrausestMemoryScenarios,
  allKrausestTransferScenarios,
  krausestRowsToBenchLines,
  runKrausestBench,
  type KrausestRunOptions,
} from "./run.ts";
import { buildKrausestReportMeta, writeKrausestRunArtifact } from "./report.ts";
import { formatKrausestRowsSummary } from "./summary.ts";
import type { KrausestFrameworkInfo } from "./frameworks.ts";

export type KrausestBenchMode = {
  fullMatrix: boolean;
  allFrameworks: boolean;
  compareSet: boolean;
  allScenarios: boolean;
  gate: boolean;
  writeArtifacts: boolean;
};

export function parseKrausestBenchArgv(args: readonly string[]): KrausestBenchMode | null {
  if (!args.includes("--krausest")) return null;
  const allFrameworks = args.includes("--all-frameworks");
  const fullMatrix = args.includes("--full") || allFrameworks;
  const compareSet = args.includes("--compare");
  return {
    fullMatrix,
    allFrameworks,
    compareSet,
    allScenarios: fullMatrix || compareSet || args.includes("--all-scenarios"),
    gate: args.includes("--gate"),
    writeArtifacts: fullMatrix || compareSet || args.includes("--write-artifacts"),
  };
}

export function krausestBenchModeFromEnv(): KrausestBenchMode {
  const allFrameworks = process.env.LUXEL_KRAUSEST_ALL === "1";
  const fullMatrix = process.env.LUXEL_KRAUSEST_FULL === "1" || allFrameworks;
  const compareSet = process.env.LUXEL_KRAUSEST_COMPARE === "1";
  return {
    fullMatrix,
    allFrameworks,
    compareSet,
    allScenarios: fullMatrix || compareSet,
    gate: false,
    writeArtifacts: fullMatrix || compareSet,
  };
}

export function buildKrausestRunOptions(
  repoRoot: string,
  mode: KrausestBenchMode,
  luxel: KrausestFrameworkInfo,
  detected: readonly KrausestFrameworkInfo[] = detectKrausestFrameworks(
    repoKrausestSubmodulePath(repoRoot),
  ),
): KrausestRunOptions {
  if (mode.fullMatrix) {
    return {
      repoRoot,
      includeAllFrameworks: true,
      includeKeyedFrameworks: mode.allFrameworks,
      requireOfficialNonKeyedMatrix: !mode.allFrameworks,
      scenarios: [...allKrausestDurationScenarios()],
      memoryScenarios: [...allKrausestMemoryScenarios()],
      transferScenarios: [...allKrausestTransferScenarios()],
    };
  }
  if (mode.compareSet) {
    const selected = resolveKrausestCompareFrameworks(detected, luxel);
    return {
      repoRoot,
      frameworkLabels: selected.map((framework) => framework.label),
      scenarios: [...allKrausestDurationScenarios()],
      memoryScenarios: [...allKrausestMemoryScenarios()],
      transferScenarios: [...allKrausestTransferScenarios()],
    };
  }
  if (mode.allScenarios) {
    return {
      repoRoot,
      frameworkLabels: [luxel.label],
      skipComparisonFrameworkSetup: true,
      scenarios: [...allKrausestDurationScenarios()],
      memoryScenarios: [...allKrausestMemoryScenarios()],
      transferScenarios: [...allKrausestTransferScenarios()],
    };
  }
  return {
    repoRoot,
    frameworkLabels: [luxel.label],
    skipComparisonFrameworkSetup: true,
  };
}

function resolveLuxelFramework(repoRoot: string): KrausestFrameworkInfo | null {
  const submodule = repoKrausestSubmodulePath(repoRoot);
  return findLuxelKrausestFramework(detectKrausestFrameworks(submodule)) ?? null;
}

function expectedKrausestReportFrameworks(
  repoRoot: string,
  mode: KrausestBenchMode,
): string[] | undefined {
  if (!mode.fullMatrix || mode.allFrameworks) return undefined;
  return resolveKrausestOfficialNonKeyedFrameworks(repoKrausestSubmodulePath(repoRoot)).map(
    (framework) => framework.label,
  );
}

export async function runKrausestBenchCommand(
  repoRoot: string,
  mode: KrausestBenchMode,
): Promise<number> {
  const luxel = resolveLuxelFramework(repoRoot);
  if (!luxel) {
    console.error("krausest luxel framework metadata missing");
    return 1;
  }

  const result = await runKrausestBench(buildKrausestRunOptions(repoRoot, mode, luxel));
  const benchLines: BenchJsonLine[] = [];

  if (result.status === "pending") {
    console.error(result.reason);
    benchLines.push({
      fixture: "krausest",
      metric: "runner",
      status: "pending",
      reason: result.reason,
    });
  } else {
    console.error(formatKrausestRowsSummary(result.rows));
    benchLines.push(...krausestRowsToBenchLines(result.rows));
    if (mode.writeArtifacts) {
      await writeKrausestRunArtifact(
        repoRoot,
        benchLines,
        buildKrausestReportMeta({ comparatorSource: "live" }),
        { expectedFrameworkLabels: expectedKrausestReportFrameworks(repoRoot, mode) },
      );
    }
  }

  for (const line of benchLines) {
    console.log(JSON.stringify(line));
  }

  const tier = evaluateKrausestTier(benchLines);
  console.log(JSON.stringify(tier));

  const out = process.env.LUXEL_BENCH_OUT;
  if (out) {
    await writeFile(out, `${benchLines.map((line) => JSON.stringify(line)).join("\n")}\n`, "utf8");
  }

  if (result.status === "pending") return 1;
  if (mode.gate && tier.status === "fail") return 1;
  return 0;
}

export async function* runKrausestRegistryLines(repoRoot: string): AsyncGenerator<BenchJsonLine> {
  if (
    process.env.LUXEL_BENCH_SKIP_KRAUSEST === "1" ||
    process.env.LUXEL_BENCH_SKIP_KRAUSEST === "true"
  ) {
    return;
  }

  const luxel = resolveLuxelFramework(repoRoot);
  if (!luxel) {
    yield {
      fixture: "krausest",
      metric: "runner",
      status: "pending",
      reason: "krausest luxel framework metadata missing",
    };
    return;
  }

  const mode = krausestBenchModeFromEnv();
  const result = await runKrausestBench(buildKrausestRunOptions(join(repoRoot), mode, luxel));
  if (result.status === "pending") {
    console.error(result.reason);
    yield {
      fixture: "krausest",
      metric: "runner",
      status: "pending",
      reason: result.reason,
    };
    return;
  }

  const rows = [...result.rows];
  console.error(formatKrausestRowsSummary(rows));
  const benchLines = krausestRowsToBenchLines(rows);
  if (mode.writeArtifacts) {
    await writeKrausestRunArtifact(
      repoRoot,
      benchLines,
      buildKrausestReportMeta({ comparatorSource: "live" }),
      { expectedFrameworkLabels: expectedKrausestReportFrameworks(repoRoot, mode) },
    );
  }

  for (const line of benchLines) {
    yield line;
  }
}
