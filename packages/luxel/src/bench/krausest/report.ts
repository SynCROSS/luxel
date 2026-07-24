import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BenchJsonLine } from "../registry.ts";
import type { TierGateResult } from "../gate.ts";
import { evaluateKrausestTier } from "../gate.ts";
import {
  KRAUSEST_CHROME_PIN,
  KRAUSEST_DURATION_SCENARIOS,
  KRAUSEST_MEMORY_SCENARIOS,
  KRAUSEST_SCENARIO_WEIGHTS,
  KRAUSEST_TRANSFER_SCENARIOS,
  krausestMemoryMetricId,
  krausestScenarioMetricId,
  krausestTransferMetricId,
  type KrausestDurationScenario,
} from "./contract.ts";
import {
  krausestFrameworkVariantFromLabel,
  type KrausestFrameworkType,
} from "./frameworks.ts";

export type KrausestReportSection = {
  variant: KrausestFrameworkType;
  table: KrausestReportTable;
};

export type KrausestComparatorSource = "live";

export type KrausestScenarioMeta = {
  label: string;
  description: string;
};

export const KRAUSEST_DURATION_SCENARIO_META: Record<KrausestDurationScenario, KrausestScenarioMeta> =
  {
    create_rows: { label: "create rows", description: "creating 1,000 rows. (5 warmup runs)." },
    replace_all_rows: {
      label: "replace all rows",
      description: "updating all 1,000 rows. (5 warmup runs).",
    },
    partial_update: {
      label: "partial update",
      description: "updating every 10th row for 1,000 row. (3 warmup runs). 4 x CPU slowdown.",
    },
    select_row: {
      label: "select row",
      description: "highlighting a selected row. (5 warmup runs). 4 x CPU slowdown.",
    },
    swap_rows: {
      label: "swap rows",
      description: "swap 2 rows for table with 1,000 rows. (5 warmup runs). 4 x CPU slowdown.",
    },
    remove_row: {
      label: "remove row",
      description: "removing one row. (5 warmup runs). 2 x CPU slowdown.",
    },
    create_many_rows: {
      label: "create many rows",
      description: "creating 10,000 rows. (5 warmup runs).",
    },
    append_rows: {
      label: "append rows to large table",
      description: "appending 1,000 to a table of 1,000 rows. (5 warmup runs).",
    },
    clear_rows: {
      label: "clear rows",
      description: "clearing a table with 1,000 rows. (5 warmup runs). 4 x CPU slowdown.",
    },
  };

export const KRAUSEST_MEMORY_SCENARIO_META: Record<
  (typeof KRAUSEST_MEMORY_SCENARIOS)[number],
  KrausestScenarioMeta
> = {
  ready_memory: { label: "ready memory", description: "Memory usage after page load." },
  run_memory: { label: "run memory", description: "Memory usage after adding 1,000 rows." },
  create_clear_1k_x5: {
    label: "creating/clearing 1k rows (5 cycles)",
    description: "Memory usage after creating and clearing 1000 rows 5 times",
  },
};

export const KRAUSEST_TRANSFER_SCENARIO_META: Record<
  (typeof KRAUSEST_TRANSFER_SCENARIOS)[number],
  KrausestScenarioMeta
> = {
  uncompressed_size: {
    label: "uncompressed size",
    description:
      "uncompressed size of all implementation files (excluding /css and http headers)",
  },
  compressed_size: {
    label: "compressed size",
    description:
      "brotli compressed size of all implementation files (excluding /css and http headers)",
  },
  first_paint: { label: "first paint", description: "first paint" },
};

export type KrausestScenarioKind = "duration" | "memory" | "transfer";

export type KrausestReportMeta = {
  generatedAt: string;
  chromePin: string;
  comparatorSource: KrausestComparatorSource;
  driverCount: number;
};

export type KrausestScenarioRow = {
  slug: string;
  label: string;
  description: string;
  kind: KrausestScenarioKind;
  values: Map<string, number>;
};

export type KrausestReportTable = {
  frameworks: string[];
  durationRows: KrausestScenarioRow[];
  memoryRows: KrausestScenarioRow[];
  transferRows: KrausestScenarioRow[];
  /** Per-framework weighted geometric mean of duration slowdown factors (upstream default weights). */
  durationGeoMean: Map<string, number>;
  /** Per-framework unweighted geometric mean of memory slowdown factors. */
  memoryGeoMean: Map<string, number>;
  /** Per-framework unweighted geometric mean of transfer slowdown factors. */
  transferGeoMean: Map<string, number>;
  pendingReason?: string;
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

function runnerPendingReason(lines: BenchJsonLine[]): string | undefined {
  for (const line of lines) {
    if (
      "status" in line &&
      line.fixture === "krausest" &&
      line.metric === "runner" &&
      line.status === "pending"
    ) {
      return line.reason ?? "krausest runner pending";
    }
  }
  return undefined;
}

function orderedFrameworks(lines: BenchJsonLine[], expected?: readonly string[]): string[] {
  const present: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if ("status" in line || line.fixture !== "krausest" || !line.framework) continue;
    if (seen.has(line.framework)) continue;
    seen.add(line.framework);
    present.push(line.framework);
  }
  if (expected) {
    for (const framework of expected) {
      if (!seen.has(framework)) {
        seen.add(framework);
        present.push(framework);
      }
    }
  }
  return present;
}

function buildScenarioRows(
  scenarios: readonly string[],
  kind: KrausestScenarioKind,
  lines: BenchJsonLine[],
): KrausestScenarioRow[] {
  const rows: KrausestScenarioRow[] = [];
  for (const slug of scenarios) {
    const metric =
      kind === "duration"
        ? krausestScenarioMetricId(slug)
        : kind === "memory"
          ? krausestMemoryMetricId(slug)
          : krausestTransferMetricId(slug);
    const values = new Map<string, number>();
    for (const line of numericKrausestLines(lines, metric)) {
      if (!line.framework) continue;
      values.set(line.framework, line.value);
    }
    if (values.size === 0) continue;
    const meta =
      kind === "duration"
        ? KRAUSEST_DURATION_SCENARIO_META[slug as KrausestDurationScenario]
        : kind === "memory"
          ? KRAUSEST_MEMORY_SCENARIO_META[slug as (typeof KRAUSEST_MEMORY_SCENARIOS)[number]]
          : KRAUSEST_TRANSFER_SCENARIO_META[slug as (typeof KRAUSEST_TRANSFER_SCENARIOS)[number]];
    rows.push({
      slug,
      label: meta?.label ?? slug,
      description: meta?.description ?? "",
      kind,
      values,
    });
  }
  return rows;
}

function fastestInRow(values: Map<string, number>): number {
  return Math.min(...values.values());
}

function slowdown(value: number, fastest: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(fastest) || fastest <= 0) return Number.NaN;
  return value / fastest;
}

/** Slowdown factor (value / fastest in row) for one framework, or undefined when absent/invalid. */
function frameworkRowFactor(row: KrausestScenarioRow, framework: string): number | undefined {
  const value = row.values.get(framework);
  if (value === undefined) return undefined;
  const factor = slowdown(value, fastestInRow(row.values));
  return Number.isFinite(factor) && factor > 0 ? factor : undefined;
}

/**
 * Geometric mean of a framework's per-scenario slowdown factors.
 * Duration passes upstream weights (weighted geo-mean); memory passes none (plain geo-mean).
 */
function frameworkGeoMean(
  rows: KrausestScenarioRow[],
  framework: string,
  weights?: Partial<Record<string, number>>,
): number {
  let logSum = 0;
  let weightSum = 0;
  for (const row of rows) {
    const factor = frameworkRowFactor(row, framework);
    if (factor === undefined) continue;
    const weight = weights ? (weights[row.slug] ?? 0) : 1;
    if (weight <= 0) continue;
    logSum += weight * Math.log(factor);
    weightSum += weight;
  }
  return weightSum > 0 ? Math.exp(logSum / weightSum) : Number.NaN;
}

function sortFrameworksByDurationGeoMean(
  frameworks: readonly string[],
  durationGeoMean: Map<string, number>,
): string[] {
  return [...frameworks].sort((a, b) => {
    const ga = durationGeoMean.get(a);
    const gb = durationGeoMean.get(b);
    const va = ga !== undefined && Number.isFinite(ga) ? ga : Number.POSITIVE_INFINITY;
    const vb = gb !== undefined && Number.isFinite(gb) ? gb : Number.POSITIVE_INFINITY;
    if (va !== vb) return va - vb;
    return a.localeCompare(b);
  });
}

export function krausestLinesToReportTable(
  lines: BenchJsonLine[],
  opts?: { expectedFrameworkLabels?: readonly string[] },
): KrausestReportTable {
  const pendingReason = runnerPendingReason(lines);
  const present = orderedFrameworks(lines, opts?.expectedFrameworkLabels);
  const durationRows = buildScenarioRows(KRAUSEST_DURATION_SCENARIOS, "duration", lines);
  const memoryRows = buildScenarioRows(KRAUSEST_MEMORY_SCENARIOS, "memory", lines);
  const transferRows = buildScenarioRows(KRAUSEST_TRANSFER_SCENARIOS, "transfer", lines);
  const durationGeoMean = new Map<string, number>();
  const memoryGeoMean = new Map<string, number>();
  const transferGeoMean = new Map<string, number>();
  for (const framework of present) {
    durationGeoMean.set(framework, frameworkGeoMean(durationRows, framework, KRAUSEST_SCENARIO_WEIGHTS));
    memoryGeoMean.set(framework, frameworkGeoMean(memoryRows, framework));
    transferGeoMean.set(framework, frameworkGeoMean(transferRows, framework));
  }
  return {
    frameworks: sortFrameworksByDurationGeoMean(present, durationGeoMean),
    durationRows,
    memoryRows,
    transferRows,
    durationGeoMean,
    memoryGeoMean,
    transferGeoMean,
    pendingReason,
  };
}

function filterKrausestLinesByVariant(
  lines: BenchJsonLine[],
  variant: KrausestFrameworkType,
): BenchJsonLine[] {
  return lines.filter((line) => {
    if ("status" in line && line.fixture === "krausest") return true;
    if (!("framework" in line) || !line.framework) return false;
    return krausestFrameworkVariantFromLabel(line.framework) === variant;
  });
}

export function krausestReportSections(
  lines: BenchJsonLine[],
  opts?: { expectedFrameworkLabels?: readonly string[] },
): KrausestReportSection[] {
  const present = orderedFrameworks(lines, opts?.expectedFrameworkLabels);
  const variants = new Set(present.map((framework) => krausestFrameworkVariantFromLabel(framework)));
  if (variants.size <= 1) {
    const variant = variants.values().next().value ?? "non-keyed";
    return [{ variant, table: krausestLinesToReportTable(lines, opts) }];
  }
  return (["non-keyed", "keyed"] as const)
    .filter((variant) => variants.has(variant))
    .map((variant) => ({
      variant,
      table: krausestLinesToReportTable(filterKrausestLinesByVariant(lines, variant), opts),
    }))
    .filter((section) => section.table.frameworks.length > 0);
}

function variantSectionLabel(variant: KrausestFrameworkType): string {
  return variant === "keyed" ? "Keyed" : "Non-keyed";
}

function formatDurationMs(value: number): string {
  return value >= 100 ? value.toFixed(1) : value.toFixed(2);
}

function formatMemoryMb(value: number): string {
  return value.toFixed(2);
}

function formatTransferValue(slug: string, value: number): string {
  if (slug === "first_paint") return `${value.toFixed(1)} ms`;
  return `${value.toFixed(1)} kB`;
}

function formatCell(value: number, fastest: number, row: KrausestScenarioRow): string {
  const ratio = slowdown(value, fastest);
  const formatted =
    row.kind === "duration"
      ? `${formatDurationMs(value)} ms`
      : row.kind === "memory"
        ? `${formatMemoryMb(value)} MB`
        : formatTransferValue(row.slug, value);
  if (!Number.isFinite(ratio)) return formatted;
  return `${formatted} (${ratio.toFixed(2)})`;
}

function formatFactor(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value) ? value.toFixed(2) : "—";
}

export type KrausestAggregateRow = {
  label: string;
  values: Map<string, number>;
};

const DURATION_AGGREGATE_LABEL = "weighted geometric mean of all factors in the table";
const MEMORY_AGGREGATE_LABEL = "geometric mean of all factors in the table";
const TRANSFER_AGGREGATE_LABEL = "geometric mean of all factors in the table";

function slowdownBackground(ratio: number): string {
  if (!Number.isFinite(ratio)) return "transparent";
  if (ratio <= 1.05) return "#63be7b";
  if (ratio <= 1.2) return "#ffeb84";
  if (ratio <= 1.5) return "#fcaa78";
  return "#f8696b";
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function gateSummaryLines(gate: TierGateResult): string[] {
  const lines = [
    `Gate status: **${gate.status}**`,
    `Duration weighted geo-mean: ${gate.geo_mean_factor !== undefined ? gate.geo_mean_factor.toFixed(3) : "—"} (threshold ${gate.threshold})`,
    `Duration median factor: ${gate.median_factor !== undefined ? gate.median_factor.toFixed(3) : "—"}`,
  ];
  if (gate.reason) lines.push(`Note: ${gate.reason}`);
  if (gate.frameworks?.length) lines.push(`Frameworks: ${gate.frameworks.join(", ")}`);
  return lines;
}

function renderMarkdownTable(
  title: string,
  subtitle: string,
  frameworks: string[],
  rows: KrausestScenarioRow[],
  aggregate?: KrausestAggregateRow,
): string[] {
  if (rows.length === 0) return [];
  const header = ["| Benchmark |", ...frameworks.map((fw) => ` ${fw} |`)].join("");
  const divider = ["| --- |", ...frameworks.map(() => " ---: |")].join("");
  const body = rows.map((row) => {
    const fastest = fastestInRow(row.values);
    const cells = frameworks.map((fw) => {
      const value = row.values.get(fw);
      return value === undefined ? " — |" : ` ${formatCell(value, fastest, row)} |`;
    });
    return `| **${row.label}** |${cells.join("")}`;
  });
  if (aggregate) {
    const cells = frameworks.map((fw) => ` ${formatFactor(aggregate.values.get(fw))} |`);
    body.push(`| **${aggregate.label}** |${cells.join("")}`);
  }
  return ["", `## ${title}`, "", subtitle, "", header, divider, ...body, ""];
}

export function renderKrausestMarkdown(
  lines: BenchJsonLine[],
  meta: KrausestReportMeta,
  gate: TierGateResult = evaluateKrausestTier(lines),
  opts?: { expectedFrameworkLabels?: readonly string[] },
): string {
  const sections = krausestReportSections(lines, opts);
  const out = [
    "# Krausest benchmark results",
    "",
    `Generated: ${meta.generatedAt}`,
    `Chrome pin: ${meta.chromePin}`,
    `Comparator source: ${meta.comparatorSource}`,
    `Driver iterations: ${meta.driverCount}`,
    "",
    ...gateSummaryLines(gate).map((line) => line.replace(/\*\*/g, "")),
    "",
  ];

  for (const section of sections) {
    const label = variantSectionLabel(section.variant);
    const table = section.table;
    if (table.pendingReason) {
      out.push(`> Runner pending (${label}): ${table.pendingReason}`, "");
    }
    out.push(
      ...renderMarkdownTable(
        `${label} — duration in milliseconds (slowdown = value / fastest)`,
        `${label} table scenarios from [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark).`,
        table.frameworks,
        table.durationRows,
        { label: DURATION_AGGREGATE_LABEL, values: table.durationGeoMean },
      ),
      ...renderMarkdownTable(
        `${label} — memory allocation in MB (slowdown = value / fastest)`,
        "Per-scenario memory ceiling gate: luxel / fastest ≤ 1.5.",
        table.frameworks,
        table.memoryRows,
        { label: MEMORY_AGGREGATE_LABEL, values: table.memoryGeoMean },
      ),
      ...renderMarkdownTable(
        `${label} — transferred size (in kBs) and first paint`,
        "Bundle size from upstream `/sizeInfo` and first paint from the Performance API.",
        table.frameworks,
        table.transferRows,
        { label: TRANSFER_AGGREGATE_LABEL, values: table.transferGeoMean },
      ),
    );
  }

  out.push(
    "## Notes",
    "",
    "- Luxel and competitors run live via upstream Puppeteer driver against krausest framework implementations.",
    "- Framework columns are sorted by their weighted geometric mean (fastest first), matching krausest.github.io.",
    "- Duration table shows the weighted geometric mean of all factors; memory table shows the unweighted geometric mean, as on the official site.",
    "- See `docs/benchmarks/krausest-runbook.md` for reproduction.",
    "",
  );
  return out.join("\n");
}

function renderHtmlAggregateRow(
  frameworks: string[],
  aggregate: KrausestAggregateRow,
): string {
  const cells = frameworks
    .map((fw) => {
      const value = aggregate.values.get(fw);
      if (value === undefined || !Number.isFinite(value)) return "<td>—</td>";
      const bg = slowdownBackground(value);
      return `<td style="background:${bg}"><span class="value">${value.toFixed(2)}</span></td>`;
    })
    .join("");
  return `<tr class="aggregate"><th scope="row"><div class="bench-label">${escapeHtml(aggregate.label)}</div></th>${cells}</tr>`;
}

function renderHtmlTable(
  title: string,
  subtitle: string,
  frameworks: string[],
  rows: KrausestScenarioRow[],
  aggregate?: KrausestAggregateRow,
): string[] {
  if (rows.length === 0) return [];
  const header = [
    "<thead><tr>",
    '<th scope="col">Benchmark</th>',
    ...frameworks.map((fw) => `<th scope="col">${escapeHtml(fw)}</th>`),
    "</tr></thead>",
  ].join("");
  const scenarioRows = rows
    .map((row) => {
      const fastest = fastestInRow(row.values);
      const cells = frameworks
        .map((fw) => {
          const value = row.values.get(fw);
          if (value === undefined) return "<td>—</td>";
          const ratio = slowdown(value, fastest);
          const main =
            row.kind === "duration"
              ? `${formatDurationMs(value)} ms`
              : row.kind === "memory"
                ? `${formatMemoryMb(value)} MB`
                : formatTransferValue(row.slug, value);
          const bg = slowdownBackground(ratio);
          return `<td style="background:${bg}"><span class="value">${escapeHtml(main)}</span><span class="ratio">${Number.isFinite(ratio) ? ratio.toFixed(2) : "—"}</span></td>`;
        })
        .join("");
      return `<tr><th scope="row"><div class="bench-label">${escapeHtml(row.label)}</div><div class="bench-desc">${escapeHtml(row.description)}</div></th>${cells}</tr>`;
    })
    .join("");
  const body = aggregate ? scenarioRows + renderHtmlAggregateRow(frameworks, aggregate) : scenarioRows;
  return [
    `<section><h2>${escapeHtml(title)}</h2><p class="subtitle">${escapeHtml(subtitle)}</p>`,
    '<div class="table-wrap"><table>',
    header,
    `<tbody>${body}</tbody>`,
    "</table></div></section>",
  ];
}

export function renderKrausestHtml(
  lines: BenchJsonLine[],
  meta: KrausestReportMeta,
  gate: TierGateResult = evaluateKrausestTier(lines),
  opts?: { expectedFrameworkLabels?: readonly string[] },
): string {
  const sections = krausestReportSections(lines, opts);
  const gateClass =
    gate.status === "pass" ? "pass" : gate.status === "fail" ? "fail" : "pending";
  const sectionHtml = sections
    .flatMap((section) => {
      const label = variantSectionLabel(section.variant);
      const table = section.table;
      const pending = table.pendingReason
        ? `<p class="pending">${escapeHtml(table.pendingReason)}</p>`
        : "";
      return [
        pending,
        ...renderHtmlTable(
          `${label} — duration in milliseconds`,
          "Slowdown = duration / fastest in row (green = fastest band). Bottom row = weighted geometric mean of all factors.",
          table.frameworks,
          table.durationRows,
          { label: DURATION_AGGREGATE_LABEL, values: table.durationGeoMean },
        ),
        ...renderHtmlTable(
          `${label} — memory allocation in MB`,
          "Slowdown = memory / fastest in row. Memory ceiling gate: luxel / fastest ≤ 1.5. Bottom row = geometric mean of all factors.",
          table.frameworks,
          table.memoryRows,
          { label: MEMORY_AGGREGATE_LABEL, values: table.memoryGeoMean },
        ),
        ...renderHtmlTable(
          `${label} — transferred size (in kBs) and first paint`,
          "Slowdown = value / fastest in row. Bottom row = geometric mean of all factors.",
          table.frameworks,
          table.transferRows,
          { label: TRANSFER_AGGREGATE_LABEL, values: table.transferGeoMean },
        ),
      ];
    })
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Krausest results — Luxel subset</title>
  <style>
    :root { color-scheme: light dark; }
    body { font: 14px/1.45 system-ui, sans-serif; margin: 24px; color: #1a1a1a; background: #fafafa; }
    h1 { font-size: 1.5rem; margin: 0 0 8px; }
    h2 { font-size: 1.1rem; margin: 24px 0 8px; }
    .meta, .subtitle { color: #555; margin: 0 0 12px; }
    .gate { border: 1px solid #ddd; border-radius: 8px; padding: 12px 16px; margin: 16px 0; background: #fff; }
    .gate.pass { border-color: #63be7b; }
    .gate.fail { border-color: #f8696b; }
    .gate.pending { border-color: #ffeb84; }
    .pending { color: #8a6d00; }
    .table-wrap { overflow-x: auto; border: 1px solid #ddd; border-radius: 8px; background: #fff; }
    table { border-collapse: collapse; width: 100%; min-width: 720px; }
    th, td { border: 1px solid #e5e5e5; padding: 8px 10px; vertical-align: top; text-align: right; }
    th[scope="row"] { text-align: left; min-width: 220px; }
    th[scope="col"] { text-align: center; font-size: 12px; }
    .bench-label { font-weight: 600; }
    .bench-desc { font-size: 12px; color: #666; margin-top: 2px; }
    .value { display: block; font-weight: 600; }
    .ratio { display: block; font-size: 11px; opacity: 0.85; }
    tr.aggregate th, tr.aggregate td { border-top: 2px solid #999; font-weight: 700; }
    tr.aggregate .value { font-weight: 700; }
    a { color: #0b57d0; }
  </style>
</head>
<body>
  <h1>Krausest benchmark results (Luxel comparison set)</h1>
  <p class="meta">Generated ${escapeHtml(meta.generatedAt)} · Chrome pin ${escapeHtml(meta.chromePin)} · comparators: ${escapeHtml(meta.comparatorSource)} · driver count ${meta.driverCount}</p>
  <div class="gate ${gateClass}">
    <strong>Gate: ${escapeHtml(gate.status)}</strong><br />
    Duration weighted geo-mean: ${gate.geo_mean_factor !== undefined ? gate.geo_mean_factor.toFixed(3) : "—"} (threshold ${gate.threshold})<br />
    Duration median factor: ${gate.median_factor !== undefined ? gate.median_factor.toFixed(3) : "—"}
    ${gate.reason ? `<br />${escapeHtml(gate.reason)}` : ""}
  </div>
  ${sectionHtml}
  <p class="meta">Layout inspired by <a href="https://krausest.github.io/js-framework-benchmark/">krausest.github.io</a>. Weights: ${escapeHtml(
    Object.entries(KRAUSEST_SCENARIO_WEIGHTS)
      .map(([slug, weight]) => `${slug}=${weight}`)
      .join(", "),
  )}.</p>
</body>
</html>`;
}

export function buildKrausestReportMeta(opts?: {
  comparatorSource?: KrausestComparatorSource;
  driverCount?: number;
}): KrausestReportMeta {
  const raw = process.env.KRAUSEST_DRIVER_COUNT?.trim();
  let driverCount = opts?.driverCount ?? 1;
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) driverCount = Math.floor(parsed);
  }
  return {
    generatedAt: new Date().toISOString(),
    chromePin: KRAUSEST_CHROME_PIN,
    comparatorSource: opts?.comparatorSource ?? "live",
    driverCount,
  };
}

export async function writeKrausestRunArtifact(
  repoRoot: string,
  lines: BenchJsonLine[],
  meta: KrausestReportMeta,
  opts?: { announce?: boolean; expectedFrameworkLabels?: readonly string[] },
): Promise<void> {
  const outDir = join(repoRoot, "docs/benchmarks/runs");
  await mkdir(outDir, { recursive: true });
  const gate = evaluateKrausestTier(lines);
  const reportOpts = { expectedFrameworkLabels: opts?.expectedFrameworkLabels };
  const payload = {
    type: "krausest_bench",
    generatedAt: meta.generatedAt,
    chromePin: meta.chromePin,
    comparatorSource: meta.comparatorSource,
    driverCount: meta.driverCount,
    gate,
    lines: lines.filter((line) => line.fixture === "krausest"),
  };
  await writeFile(join(outDir, "krausest-latest.json"), `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(
    join(outDir, "krausest-latest.jsonl"),
    `${payload.lines.map((line) => JSON.stringify(line)).join("\n")}\n`,
  );
  await writeFile(join(outDir, "krausest-latest.md"), renderKrausestMarkdown(lines, meta, gate, reportOpts));
  await writeFile(join(outDir, "krausest-latest.html"), renderKrausestHtml(lines, meta, gate, reportOpts));
  if (opts?.announce !== false) {
    console.error("wrote docs/benchmarks/runs/krausest-latest.{json,jsonl,md,html}");
  }
}
