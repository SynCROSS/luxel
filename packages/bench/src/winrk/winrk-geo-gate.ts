import type { WinrkBenchResult, WinrkFixtureId } from "./registry.ts";
import { stackRole } from "./registry.ts";

export const WINRK_GEO_GATE_THRESHOLD = 1.08;

export type WinrkGeoGateResult = {
  ok: boolean;
  threshold: number;
  fixture: WinrkFixtureId;
  geo_mean_factor: number;
  median_factor: number;
  luxel_rows: Array<{ id: string; rps: number; factor: number }>;
  fastest_rps: number;
  reason?: string;
};

function geometricMean(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const logSum = values.reduce((sum, v) => sum + Math.log(v), 0);
  return Math.exp(logSum / values.length);
}

function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function isLuxelStack(id: string): boolean {
  return id.startsWith("luxel");
}

/** Tier-2 geo-mean: every ok `role: framework` row counts (inline + prod-stack + worker-pool). */
export function evaluateWinrkGeoGate(
  fixture: WinrkFixtureId,
  results: WinrkBenchResult[],
  threshold = WINRK_GEO_GATE_THRESHOLD,
): WinrkGeoGateResult {
  const okFramework = results.filter(
    (row) =>
      row.fixture === fixture &&
      row.status === "ok" &&
      stackRole(row) === "framework" &&
      row.requestsPerSec !== undefined,
  );

  const competitorRps = okFramework
    .filter((row) => !isLuxelStack(row.id))
    .map((row) => row.requestsPerSec!);
  const luxelRows = okFramework.filter((row) => isLuxelStack(row.id));

  if (competitorRps.length === 0) {
    return {
      ok: false,
      threshold,
      fixture,
      geo_mean_factor: Number.NaN,
      median_factor: Number.NaN,
      luxel_rows: [],
      fastest_rps: Number.NaN,
      reason: "no ok competitor framework rows",
    };
  }
  if (luxelRows.length === 0) {
    return {
      ok: false,
      threshold,
      fixture,
      geo_mean_factor: Number.NaN,
      median_factor: Number.NaN,
      luxel_rows: [],
      fastest_rps: Number.NaN,
      reason: "no ok luxel framework rows",
    };
  }

  const fastestRps = Math.max(...competitorRps);
  const luxelFactors = luxelRows.map((row) => ({
    id: row.id,
    rps: row.requestsPerSec!,
    factor: fastestRps / row.requestsPerSec!,
  }));
  const factors = luxelFactors.map((row) => row.factor);
  const geo = geometricMean(factors);
  const med = median(factors);

  return {
    ok: geo <= threshold,
    threshold,
    fixture,
    geo_mean_factor: geo,
    median_factor: med,
    luxel_rows: luxelFactors,
    fastest_rps: fastestRps,
  };
}

export function formatWinrkGeoGateResult(gate: WinrkGeoGateResult): string {
  const lines = [
    `fixture ${gate.fixture}: geo-mean ${gate.geo_mean_factor.toFixed(4)} (threshold ${gate.threshold})`,
    `fastest competitor: ${gate.fastest_rps.toFixed(0)} rps`,
    ...gate.luxel_rows.map(
      (row) => `  - ${row.id}: ${row.rps.toFixed(0)} rps (factor ${row.factor.toFixed(4)})`,
    ),
  ];
  if (gate.reason) lines.unshift(gate.reason);
  return lines.join("\n");
}
