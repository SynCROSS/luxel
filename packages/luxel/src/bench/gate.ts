import type { BenchJsonLine } from "./registry.ts";

export const BENCH_GATE_THRESHOLD = 1.08;

/** Tiers enforced by `luxel bench --gate` (extend as runners land). */
export const ACTIVE_GATE_TIERS = ["ssr"] as const satisfies readonly BenchTier[];

export type BenchTier = "inp" | "ssr" | "krausest" | "transfer";

export type TierGateStatus = "pass" | "fail" | "pending" | "inactive";

export type TierGateResult = {
  tier: BenchTier;
  status: TierGateStatus;
  threshold: number;
  geo_mean_factor?: number;
  median_factor?: number;
  frameworks?: string[];
  reason?: string;
};

export type BenchGateResult = {
  type: "bench_gate";
  ok: boolean;
  threshold: number;
  active_tiers: readonly BenchTier[];
  tiers: TierGateResult[];
};

export const COMPARISON_FRAMEWORKS = [
  "luxel",
  "react",
  "vue-vdom",
  "vue-vapor",
  "svelte",
  "solid",
] as const;

export function geometricMean(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const logSum = values.reduce((sum, v) => sum + Math.log(v), 0);
  return Math.exp(logSum / values.length);
}

export function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function isComparisonFramework(fw: string | undefined): fw is (typeof COMPARISON_FRAMEWORKS)[number] {
  return fw !== undefined && (COMPARISON_FRAMEWORKS as readonly string[]).includes(fw);
}

function numericLines(
  lines: BenchJsonLine[],
  filter: (line: Extract<BenchJsonLine, { value: number }>) => boolean,
): Extract<BenchJsonLine, { value: number }>[] {
  return lines.filter((line): line is Extract<BenchJsonLine, { value: number }> => {
    if ("status" in line) return false;
    return filter(line as Extract<BenchJsonLine, { value: number }>);
  });
}

/** Throughput: factor = rps_fastest / rps_luxel (≥ 1 when Luxel is slower). */
function throughputFactors(
  lines: BenchJsonLine[],
  fixture: string,
  metric: string,
): { factors: number[]; frameworks: string[] } | { pending: string } {
  const rps = new Map<string, number>();
  for (const line of numericLines(lines, (l) => l.fixture === fixture && l.metric === metric)) {
    if (!isComparisonFramework(line.framework)) continue;
    rps.set(line.framework, line.value);
  }
  if (!rps.has("luxel")) return { pending: "missing luxel throughput" };
  const frameworks = COMPARISON_FRAMEWORKS.filter((f) => rps.has(f));
  if (frameworks.length < 2) return { pending: "insufficient comparison frameworks" };
  const fastest = Math.max(...frameworks.map((f) => rps.get(f)!));
  const luxel = rps.get("luxel")!;
  return { factors: [fastest / luxel], frameworks };
}

/** Latency / duration: factor = value_luxel / value_fastest. */
function latencyFactors(
  lines: BenchJsonLine[],
  metric: string,
): { factors: number[]; frameworks: string[] } | { pending: string } {
  const byKey = new Map<string, Map<string, number>>();
  for (const line of numericLines(lines, (l) => l.metric === metric)) {
    if (!isComparisonFramework(line.framework)) continue;
    const key = `${line.fixture}:${line.interaction ?? "default"}`;
    let map = byKey.get(key);
    if (!map) {
      map = new Map();
      byKey.set(key, map);
    }
    map.set(line.framework, line.value);
  }
  const factors: number[] = [];
  const frameworkSet = new Set<string>();
  for (const map of byKey.values()) {
    if (!map.has("luxel")) continue;
    const frameworks = COMPARISON_FRAMEWORKS.filter((f) => map.has(f));
    if (frameworks.length < 2) continue;
    const fastest = Math.min(...frameworks.map((f) => map.get(f)!));
    const luxel = map.get("luxel")!;
    factors.push(luxel / fastest);
    for (const f of frameworks) frameworkSet.add(f);
  }
  if (factors.length === 0) return { pending: "no comparable inp rows" };
  return { factors, frameworks: [...frameworkSet] };
}

function evaluateTier(
  tier: BenchTier,
  lines: BenchJsonLine[],
  factorsResult: { factors: number[]; frameworks: string[] } | { pending: string },
): TierGateResult {
  const active = (ACTIVE_GATE_TIERS as readonly string[]).includes(tier);
  if ("pending" in factorsResult) {
    return {
      tier,
      status: active ? "pending" : "inactive",
      threshold: BENCH_GATE_THRESHOLD,
      reason: factorsResult.pending,
    };
  }
  const geo = geometricMean(factorsResult.factors);
  const med = median(factorsResult.factors);
  const status: TierGateStatus = geo <= BENCH_GATE_THRESHOLD ? "pass" : "fail";
  return {
    tier,
    status: active ? status : "inactive",
    threshold: BENCH_GATE_THRESHOLD,
    geo_mean_factor: geo,
    median_factor: med,
    frameworks: factorsResult.frameworks,
  };
}

export function evaluateSsrTier(lines: BenchJsonLine[]): TierGateResult {
  return evaluateTier("ssr", lines, throughputFactors(lines, "counter", "ssr_throughput_rps"));
}

export function evaluateInpTier(lines: BenchJsonLine[]): TierGateResult {
  return evaluateTier("inp", lines, latencyFactors(lines, "inp_ms"));
}

export function evaluateKrausestTier(lines: BenchJsonLine[]): TierGateResult {
  const factors: number[] = [];
  const frameworkSet = new Set<string>();
  for (const line of numericLines(
    lines,
    (l) => l.metric.startsWith("krausest_") && l.metric.endsWith("_factor"),
  )) {
    if (!line.framework) continue;
    factors.push(line.value);
    frameworkSet.add(line.framework);
  }
  if (factors.length === 0) {
    return {
      tier: "krausest",
      status: (ACTIVE_GATE_TIERS as readonly string[]).includes("krausest") ? "pending" : "inactive",
      threshold: BENCH_GATE_THRESHOLD,
      reason: "krausest scenarios not wired",
    };
  }
  return evaluateTier("krausest", lines, { factors, frameworks: [...frameworkSet] });
}

export function evaluateTransferTier(lines: BenchJsonLine[]): TierGateResult {
  const factors: number[] = [];
  const frameworkSet = new Set<string>();
  for (const line of numericLines(lines, (l) => l.metric === "transfer_bytes")) {
    if (!isComparisonFramework(line.framework)) continue;
    const key = line.fixture;
    // grouped below
    void key;
  }
  const byFixture = new Map<string, Map<string, number>>();
  for (const line of numericLines(lines, (l) => l.metric === "transfer_bytes")) {
    if (!isComparisonFramework(line.framework)) continue;
    let map = byFixture.get(line.fixture);
    if (!map) {
      map = new Map();
      byFixture.set(line.fixture, map);
    }
    map.set(line.framework, line.value);
  }
  for (const map of byFixture.values()) {
    if (!map.has("luxel")) continue;
    const frameworks = COMPARISON_FRAMEWORKS.filter((f) => map.has(f));
    if (frameworks.length < 2) continue;
    const fastest = Math.min(...frameworks.map((f) => map.get(f)!));
    factors.push(map.get("luxel")! / fastest);
    for (const f of frameworks) frameworkSet.add(f);
  }
  if (factors.length === 0) {
    return {
      tier: "transfer",
      status: (ACTIVE_GATE_TIERS as readonly string[]).includes("transfer") ? "pending" : "inactive",
      threshold: BENCH_GATE_THRESHOLD,
      reason: "transfer_bytes not wired",
    };
  }
  return evaluateTier("transfer", lines, { factors, frameworks: [...frameworkSet] });
}

export function evaluateBenchGate(lines: BenchJsonLine[]): BenchGateResult {
  const tiers = [
    evaluateInpTier(lines),
    evaluateSsrTier(lines),
    evaluateKrausestTier(lines),
    evaluateTransferTier(lines),
  ];
  const ok = ACTIVE_GATE_TIERS.every((tier) => tiers.find((t) => t.tier === tier)?.status === "pass");
  return {
    type: "bench_gate",
    ok,
    threshold: BENCH_GATE_THRESHOLD,
    active_tiers: ACTIVE_GATE_TIERS,
    tiers,
  };
}
