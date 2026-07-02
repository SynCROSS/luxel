import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  BENCH_GATE_THRESHOLD,
  evaluateInpTier,
  evaluateIsrTier,
  evaluateSsrTier,
} from "./gate.ts";
import type { BenchJsonLine } from "./registry.ts";
import type { BoundaryBenchLine } from "./boundary.ts";
import type { SchemaStreamBenchLine } from "../schema/bench.ts";

export type NativeGateInputLine =
  | BenchJsonLine
  | BoundaryBenchLine
  | SchemaStreamBenchLine
  | { fixture: string; metric: string; value: number; framework?: string; runtime?: string };

export const NATIVE_DEFAULT_GATE_THRESHOLDS = {
  rssMb: Number(process.env.LUXEL_NATIVE_GATE_RSS_MB ?? 512),
  coldStartMs: Number(process.env.LUXEL_NATIVE_GATE_COLD_START_MS ?? 3000),
  installMb: Number(process.env.LUXEL_NATIVE_GATE_INSTALL_MB ?? 80),
  boundaryNullUs: Number(process.env.LUXEL_NATIVE_GATE_BOUNDARY_NULL_US ?? 1500),
  inpLuxelMs: Number(process.env.LUXEL_NATIVE_GATE_INP_MS ?? 200),
  winrkGeoMean: BENCH_GATE_THRESHOLD,
  inpGeoMean: BENCH_GATE_THRESHOLD,
} as const;

export type NativeGateCheckStatus = "pass" | "fail" | "pending";

export type NativeGateCheck = {
  metric:
    | "winrk_ssr"
    | "winrk_isr"
    | "inp"
    | "boundary_null_napi"
    | "rss_mb"
    | "cold_start_ms"
    | "install_size_mb"
    | "slice_hot_path"
    | "slice_runtime"
    | "slice_schema_cache"
    | "slice_client_gpu";
  status: NativeGateCheckStatus;
  value?: number;
  limit?: number;
  reason?: string;
};

export type NativeDefaultGateResult = {
  type: "native_default_gate";
  ok: boolean;
  auto_default_enabled: boolean;
  threshold: number;
  checks: NativeGateCheck[];
  slices: string[];
};

function benchLines(lines: NativeGateInputLine[]): BenchJsonLine[] {
  return lines.filter((line): line is BenchJsonLine => {
    if ("status" in line) return false;
    return typeof line.value === "number";
  });
}

function numericValue(lines: NativeGateInputLine[], fixture: string, metric: string): number | undefined {
  for (const line of lines) {
    if ("status" in line) continue;
    if (line.fixture === fixture && line.metric === metric && typeof line.value === "number") {
      return line.value;
    }
  }
  return undefined;
}

function tierCheck(
  metric: NativeGateCheck["metric"],
  tier: ReturnType<typeof evaluateSsrTier>,
  options?: { required?: boolean },
): NativeGateCheck {
  const missing =
    tier.status === "pending" ||
    (options?.required && tier.status === "inactive" && tier.geo_mean_factor === undefined);
  if (missing) {
    return { metric, status: "pending", reason: tier.reason, limit: tier.threshold };
  }
  const value = tier.geo_mean_factor;
  const status: NativeGateCheckStatus =
    tier.status === "fail" || (value !== undefined && value > tier.threshold) ? "fail" : "pass";
  return { metric, status, value, limit: tier.threshold };
}

function limitCheck(
  metric: NativeGateCheck["metric"],
  value: number | undefined,
  limit: number,
  missingReason: string,
): NativeGateCheck {
  if (value === undefined) {
    return { metric, status: "pending", reason: missingReason, limit };
  }
  return { metric, status: value <= limit ? "pass" : "fail", value, limit };
}

function sliceCheck(
  metric: NativeGateCheck["metric"],
  present: boolean,
  slice: string,
): { check: NativeGateCheck; slice?: string } {
  return {
    check: {
      metric,
      status: present ? "pass" : "pending",
      reason: present ? undefined : `${slice} slice evidence missing`,
    },
    slice: present ? slice : undefined,
  };
}

function evaluateNativeInpCheck(registryLines: BenchJsonLine[]): NativeGateCheck {
  const tier = evaluateInpTier(registryLines);
  if (tier.geo_mean_factor !== undefined) {
    return tierCheck("inp", tier, { required: true });
  }

  const luxelInp = registryLines.filter(
    (line): line is Extract<BenchJsonLine, { value: number }> =>
      !("status" in line) &&
      line.metric === "inp_ms" &&
      line.framework === "luxel" &&
      typeof line.value === "number",
  );
  if (luxelInp.length === 0) {
    return tierCheck("inp", tier, { required: true });
  }

  const max = Math.max(...luxelInp.map((line) => line.value));
  const limit = NATIVE_DEFAULT_GATE_THRESHOLDS.inpLuxelMs;
  return {
    metric: "inp",
    status: max <= limit ? "pass" : "fail",
    value: max,
    limit,
    reason: max <= limit ? "luxel-only INP abs gate (competitors pending)" : undefined,
  };
}

export function parseNativeDefaultGateFromJsonl(text: string): NativeDefaultGateResult | null {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as { type?: string };
      if (parsed.type === "native_default_gate") {
        return parsed as NativeDefaultGateResult;
      }
    } catch {
      // skip malformed lines
    }
  }
  return null;
}

export function assertNativeDefaultReleaseReady(gate: NativeDefaultGateResult): void {
  if (!gate.auto_default_enabled) {
    const blocked = gate.checks
      .filter((check) => check.status !== "pass")
      .map((check) => `${check.metric}:${check.status}`)
      .join(", ");
    throw new Error(`native default not release-ready: auto_default_enabled=false (${blocked})`);
  }
}

export function evaluateNativeDefaultGate(lines: NativeGateInputLine[]): NativeDefaultGateResult {
  const registryLines = benchLines(lines);
  const checks: NativeGateCheck[] = [
    tierCheck("winrk_ssr", evaluateSsrTier(registryLines)),
    tierCheck("winrk_isr", evaluateIsrTier(registryLines)),
    evaluateNativeInpCheck(registryLines),
    limitCheck(
      "boundary_null_napi",
      numericValue(lines, "boundary", "native_null_call_p50_us"),
      NATIVE_DEFAULT_GATE_THRESHOLDS.boundaryNullUs,
      "native addon unavailable",
    ),
    limitCheck(
      "rss_mb",
      numericValue(lines, "native-resource", "rss_mb"),
      NATIVE_DEFAULT_GATE_THRESHOLDS.rssMb,
      "native RSS sample missing",
    ),
    limitCheck(
      "cold_start_ms",
      numericValue(lines, "native-resource", "cold_start_ms"),
      NATIVE_DEFAULT_GATE_THRESHOLDS.coldStartMs,
      "native cold-start sample missing",
    ),
    limitCheck(
      "install_size_mb",
      numericValue(lines, "native-resource", "install_size_mb"),
      NATIVE_DEFAULT_GATE_THRESHOLDS.installMb,
      "native install-size sample missing",
    ),
  ];

  const slices: string[] = [];
  const hotPath = sliceCheck(
    "slice_hot_path",
    numericValue(lines, "boundary", "typed_array_cross_p50_us") !== undefined,
    "hot-path",
  );
  const runtime = sliceCheck(
    "slice_runtime",
    lines.some((line) => line.fixture === "ipc"),
    "runtime",
  );
  const schemaCache = sliceCheck(
    "slice_schema_cache",
    numericValue(lines, "schema-stream", "cache_hit_ratio_bytes") !== undefined,
    "schema-cache",
  );
  const clientGpu = sliceCheck(
    "slice_client_gpu",
    lines.some(
      (line) =>
        line.fixture === "client-gpu" ||
        (line.metric === "webgpu_parity_ok" && "value" in line && line.value === 1),
    ),
    "client-gpu",
  );

  for (const slice of [hotPath, runtime, schemaCache, clientGpu]) {
    checks.push(slice.check);
    if (slice.slice) slices.push(slice.slice);
  }

  const ok = checks.every((check) => check.status !== "fail");
  const critical: NativeGateCheck["metric"][] = [
    "winrk_ssr",
    "winrk_isr",
    "inp",
    "boundary_null_napi",
    "rss_mb",
    "cold_start_ms",
    "install_size_mb",
  ];
  const auto_default_enabled =
    ok &&
    critical.every((metric) => checks.find((check) => check.metric === metric)?.status === "pass");

  return {
    type: "native_default_gate",
    ok,
    auto_default_enabled,
    threshold: BENCH_GATE_THRESHOLD,
    checks,
    slices,
  };
}

export type NativeDefaultGateArtifactPaths = {
  jsonl: string;
  scorecard: string;
  notes: string;
};

export async function writeNativeDefaultGateArtifact(
  repoRoot: string,
  gate: NativeDefaultGateResult,
  lines: NativeGateInputLine[],
  options?: { outDir?: string },
): Promise<NativeDefaultGateArtifactPaths> {
  const outDir = options?.outDir ?? join(repoRoot, "docs/benchmarks/runs");
  await mkdir(outDir, { recursive: true });
  const jsonlPath = join(outDir, "native-default-gate-latest.jsonl");
  const scorecardPath = join(outDir, "native-default-gate-scorecard.md");
  const notesPath = join(outDir, "native-default-gate-notes.md");
  const jsonl = `${[...lines.map((line) => JSON.stringify(line)), JSON.stringify(gate)].join("\n")}\n`;
  const scorecard = [
    "# Luxel-native default enablement gate",
    "",
    `**Result:** ${gate.ok ? "PASS" : "FAIL"} — \`native.mode: auto\` default ${gate.auto_default_enabled ? "**allowed**" : "**blocked**"} for this release.`,
    "",
    "| Check | Status | Value | Limit |",
    "| --- | --- | --- | --- |",
    ...gate.checks.map((check) => {
      const value = check.value === undefined ? "—" : String(check.value);
      const limit = check.limit === undefined ? "—" : String(check.limit);
      return `| \`${check.metric}\` | ${check.status} | ${value} | ${limit} |`;
    }),
    "",
    `**Completed slices referenced:** ${gate.slices.length > 0 ? gate.slices.map((s) => `\`${s}\``).join(", ") : "none"}`,
    "",
  ].join("\n");
  const notes = [
    "# Luxel-native default enablement notes",
    "",
    "## Why auto may be blocked",
    "",
    gate.auto_default_enabled
      ? "All required WinRK, Web Vitals proxy, boundary, RSS, cold-start, and install-size checks passed in this run."
      : "At least one required check failed or is pending. `native.mode: auto` stays config-default but **must not** ship as unconditional product default until `auto_default_enabled` is true in CI.",
    "",
    "## Required checks",
    "",
    "- WinRK SSR + ISR geo-mean ≤ 1.08",
    "- INP geo-mean ≤ 1.08 (Playwright micro fixtures), or luxel-only abs ≤ `LUXEL_NATIVE_GATE_INP_MS` when competitors pending",
    "- Boundary null NAPI p50 within cap",
    "- RSS / cold-start / install-size within caps",
    "",
    "## Slice evidence (informational)",
    "",
    "- `hot-path` — route-specific native kernels (`typed_array_cross` boundary row)",
    "- `runtime` — luxel-renderd IPC bench rows present",
    "- `schema-cache` — trusted schema stream cache hit ratio row present",
    "- `client-gpu` — WebGPU parity bench row present",
    "",
    "## CI",
    "",
    "Run `luxel bench --gate --native-gate` after `build:core-node`. Exit code 1 when `native_default_gate.ok` is false.",
    "",
  ].join("\n");
  await writeFile(jsonlPath, jsonl, "utf8");
  await writeFile(scorecardPath, scorecard, "utf8");
  await writeFile(notesPath, notes, "utf8");
  return { jsonl: jsonlPath, scorecard: scorecardPath, notes: notesPath };
}
