import { join } from "node:path";
import type { BenchJsonLine } from "./registry.ts";
import {
  allKrausestComparisonFrameworks,
  allKrausestDurationScenarios,
  allKrausestMemoryScenarios,
  krausestRowsToBenchLines,
  runKrausestBench,
} from "./krausest/run.ts";

export async function* runKrausestRegistryLines(
  repoRoot: string,
): AsyncGenerator<BenchJsonLine> {
  if (
    process.env.LUXEL_BENCH_SKIP_KRAUSEST === "1" ||
    process.env.LUXEL_BENCH_SKIP_KRAUSEST === "true"
  ) {
    return;
  }

  const fullMatrix = process.env.LUXEL_KRAUSEST_FULL === "1";
  const result = await runKrausestBench({
    repoRoot: join(repoRoot),
    frameworkLabels: fullMatrix ? [...allKrausestComparisonFrameworks()] : ["luxel"],
    scenarios: fullMatrix ? [...allKrausestDurationScenarios()] : undefined,
    memoryScenarios: fullMatrix ? [...allKrausestMemoryScenarios()] : undefined,
  });
  if (result.status === "pending") {
    yield {
      fixture: "krausest",
      metric: "runner",
      status: "pending",
      reason: result.reason,
    };
    return;
  }

  for (const line of krausestRowsToBenchLines(result.rows)) {
    yield line;
  }
}
