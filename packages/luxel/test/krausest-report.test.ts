import { describe, expect, test } from "bun:test";
import type { BenchJsonLine } from "../src/bench/registry.ts";
import {
  krausestMemoryMetricId,
  krausestScenarioMetricId,
  krausestTransferMetricId,
} from "../src/bench/krausest/contract.ts";
import {
  krausestLinesToReportTable,
  krausestReportSections,
  renderKrausestHtml,
  renderKrausestMarkdown,
} from "../src/bench/krausest/report.ts";

const FRAMEWORKS = [
  "luxel-v0.0.0-non-keyed",
  "react-hooks-v19.2.0-keyed",
  "vue-v3.6.0-alpha.2-non-keyed",
] as const;

function sampleLines(): BenchJsonLine[] {
  const lines: BenchJsonLine[] = [];
  for (const framework of FRAMEWORKS) {
    lines.push({
      fixture: "krausest",
      framework,
      metric: krausestScenarioMetricId("create_rows"),
      value: framework === "luxel-v0.0.0-non-keyed" ? 22 : framework === "react-hooks-v19.2.0-keyed" ? 24 : 20,
    });
    lines.push({
      fixture: "krausest",
      framework,
      metric: krausestScenarioMetricId("clear_rows"),
      value: framework === "luxel-v0.0.0-non-keyed" ? 11 : framework === "react-hooks-v19.2.0-keyed" ? 10 : 12,
    });
    lines.push({
      fixture: "krausest",
      framework,
      metric: krausestMemoryMetricId("ready_memory"),
      value: framework === "luxel-v0.0.0-non-keyed" ? 0.8 : framework === "react-hooks-v19.2.0-keyed" ? 1.0 : 0.7,
    });
    lines.push({
      fixture: "krausest",
      framework,
      metric: krausestTransferMetricId("uncompressed_size"),
      value: framework === "luxel-v0.0.0-non-keyed" ? 45 : framework === "react-hooks-v19.2.0-keyed" ? 50 : 40,
    });
    lines.push({
      fixture: "krausest",
      framework,
      metric: krausestTransferMetricId("first_paint"),
      value: framework === "luxel-v0.0.0-non-keyed" ? 120 : framework === "react-hooks-v19.2.0-keyed" ? 100 : 110,
    });
  }
  return lines;
}

describe("krausest report", () => {
  test("pivots jsonl lines into scenario rows sorted by weighted geo-mean", () => {
    const table = krausestLinesToReportTable(sampleLines());
    // Columns are ordered fastest-first by weighted duration geo-mean: vue 1.07 < luxel 1.10 < react 1.12.
    expect(table.frameworks).toEqual([
      "vue-v3.6.0-alpha.2-non-keyed",
      "luxel-v0.0.0-non-keyed",
      "react-hooks-v19.2.0-keyed",
    ]);
    expect(table.durationRows.map((row) => row.slug)).toEqual(["create_rows", "clear_rows"]);
    expect(table.memoryRows.map((row) => row.slug)).toEqual(["ready_memory"]);
    expect(table.transferRows.map((row) => row.slug)).toEqual([
      "uncompressed_size",
      "first_paint",
    ]);
    expect(table.durationRows[0]?.values.get("vue-v3.6.0-alpha.2-non-keyed")).toBe(20);
    expect(table.durationGeoMean.get("luxel-v0.0.0-non-keyed")).toBeCloseTo(1.1, 4);
    expect(table.durationGeoMean.get("vue-v3.6.0-alpha.2-non-keyed")).toBeCloseTo(1.0749, 3);
    expect(table.memoryGeoMean.get("react-hooks-v19.2.0-keyed")).toBeCloseTo(1.4286, 3);
  });

  test("includes expected official framework columns for full matrix reports", () => {
    const expected = [...FRAMEWORKS, "mikado-v0.8.400-non-keyed", "inferno-v8.2.2-non-keyed"];
    const table = krausestLinesToReportTable(sampleLines(), { expectedFrameworkLabels: expected });
    expect(table.frameworks).toEqual(
      expect.arrayContaining([
        "vue-v3.6.0-alpha.2-non-keyed",
        "mikado-v0.8.400-non-keyed",
        "inferno-v8.2.2-non-keyed",
      ]),
    );
    expect(table.frameworks.length).toBeGreaterThanOrEqual(expected.length);
  });

  test("markdown includes slowdown columns, gate summary, and weighted geo-mean row", () => {
    const md = renderKrausestMarkdown(sampleLines(), {
      generatedAt: "2026-07-07T00:00:00.000Z",
      chromePin: "chrome150",
      comparatorSource: "live",
      driverCount: 1,
    });
    expect(md).toContain("# Krausest benchmark results");
    expect(md).toContain("create rows");
    expect(md).toContain("22.00 ms (1.10)");
    expect(md).toContain("ready memory");
    expect(md).toContain("Gate status:");
    expect(md).toContain("| **weighted geometric mean of all factors in the table** |");
    expect(md).toContain("| **geometric mean of all factors in the table** |");
    expect(md).toContain("Non-keyed — transferred size (in kBs) and first paint");
    expect(md).toContain("45.0 kB");
  });

  test("splits keyed and non-keyed into separate report sections", () => {
    const lines = [
      ...sampleLines(),
      {
        fixture: "krausest",
        framework: "react-hooks-v19.2.0-keyed",
        metric: krausestScenarioMetricId("create_rows"),
        value: 24,
      },
    ];
    const sections = krausestReportSections(lines);
    expect(sections.map((section) => section.variant)).toEqual(["non-keyed", "keyed"]);
    expect(sections[0]?.table.frameworks).not.toContain("react-hooks-v19.2.0-keyed");
    expect(sections[1]?.table.frameworks).toEqual(["react-hooks-v19.2.0-keyed"]);
  });

  test("html colors fastest row band and escapes labels", () => {
    const html = renderKrausestHtml(sampleLines(), {
      generatedAt: "2026-07-07T00:00:00.000Z",
      chromePin: "chrome150",
      comparatorSource: "live",
      driverCount: 15,
    });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('background:#63be7b');
    expect(html).toContain("create rows");
    expect(html).toContain('<tr class="aggregate">');
    expect(html).toContain("weighted geometric mean of all factors in the table");
    expect(html).not.toContain("<script>");
  });
});
