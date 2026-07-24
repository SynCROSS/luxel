import type { BenchJsonLine } from "../registry.ts";
import { geometricMean } from "../gate.ts";
import {
  KRAUSEST_DURATION_SCENARIOS,
  KRAUSEST_GATE_THRESHOLD,
  KRAUSEST_MEMORY_CEILING,
  KRAUSEST_MEMORY_SCENARIOS,
  KRAUSEST_SCENARIO_WEIGHTS,
  krausestMemoryMetricId,
  krausestScenarioMetricId,
  type KrausestDurationScenario,
} from "./contract.ts";
import { isLuxelKrausestFrameworkLabel } from "./frameworks.ts";

export type KrausestGateEval = {
  durationFactors: Array<{ factor: number; weight: number }>;
  memoryFailures: string[];
  frameworks: string[];
};

function numericKrausestLines(
  lines: BenchJsonLine[],
  metric: string,
): Extract<BenchJsonLine, { value: number }>[] {
  return lines.filter(
    (line): line is Extract<BenchJsonLine, { value: number }> =>
      !("status" in line) && line.fixture === "krausest" && line.metric === metric,
  );
}

export function evaluateKrausestFromRawLines(lines: BenchJsonLine[]): KrausestGateEval {
  const durationFactors: Array<{ factor: number; weight: number }> = [];
  const memoryFailures: string[] = [];
  const frameworkSet = new Set<string>();

  for (const scenario of KRAUSEST_DURATION_SCENARIOS) {
    const metric = krausestScenarioMetricId(scenario);
    const byFramework = new Map<string, number>();
    for (const line of numericKrausestLines(lines, metric)) {
      if (!line.framework) continue;
      byFramework.set(line.framework, line.value);
    }
    const luxelFramework = [...byFramework.keys()].find(isLuxelKrausestFrameworkLabel);
    if (!luxelFramework) continue;
    const executed = [...byFramework.keys()];
    if (executed.length < 2) continue;
    const fastest = Math.min(...executed.map((f) => byFramework.get(f)!));
    const luxel = byFramework.get(luxelFramework)!;
    durationFactors.push({
      factor: luxel / fastest,
      weight: KRAUSEST_SCENARIO_WEIGHTS[scenario as KrausestDurationScenario],
    });
    for (const f of executed) frameworkSet.add(f);
  }

  for (const scenario of KRAUSEST_MEMORY_SCENARIOS) {
    const metric = krausestMemoryMetricId(scenario);
    const byFramework = new Map<string, number>();
    for (const line of numericKrausestLines(lines, metric)) {
      if (!line.framework) continue;
      byFramework.set(line.framework, line.value);
    }
    const luxelFramework = [...byFramework.keys()].find(isLuxelKrausestFrameworkLabel);
    if (!luxelFramework) continue;
    const executed = [...byFramework.keys()];
    if (executed.length < 2) continue;
    const fastest = Math.min(...executed.map((f) => byFramework.get(f)!));
    const luxel = byFramework.get(luxelFramework)!;
    if (luxel / fastest > KRAUSEST_MEMORY_CEILING) {
      memoryFailures.push(`${scenario}:${(luxel / fastest).toFixed(3)}`);
    }
    for (const f of executed) frameworkSet.add(f);
  }

  return { durationFactors, memoryFailures, frameworks: [...frameworkSet] };
}

export function weightedKrausestGeoMean(
  weightedFactors: Array<{ factor: number; weight: number }>,
): number {
  if (weightedFactors.length === 0) return Number.NaN;
  const totalWeight = weightedFactors.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight === 0) return Number.NaN;
  const logSum = weightedFactors.reduce(
    (sum, entry) => sum + entry.weight * Math.log(entry.factor),
    0,
  );
  return Math.exp(logSum / totalWeight);
}

export function krausestGateThreshold(): number {
  return KRAUSEST_GATE_THRESHOLD;
}
