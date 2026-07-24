import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import type { BenchJsonLine } from "../src/bench/registry.ts";
import {
  krausestMemoryMetricId,
  krausestScenarioMetricId,
  krausestTransferMetricId,
} from "../src/bench/krausest/contract.ts";
import { writeKrausestRunArtifact } from "../src/bench/krausest/report.ts";

describe("writeKrausestRunArtifact", () => {
  test("writes html with transfer table and aggregate rows", async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "krausest-artifact-"));
    const lines: BenchJsonLine[] = [
      {
        fixture: "krausest",
        framework: "luxel-v0.0.0-non-keyed",
        metric: krausestScenarioMetricId("create_rows"),
        value: 22,
      },
      {
        fixture: "krausest",
        framework: "vanillajs-1-non-keyed",
        metric: krausestScenarioMetricId("create_rows"),
        value: 20,
      },
      {
        fixture: "krausest",
        framework: "luxel-v0.0.0-non-keyed",
        metric: krausestTransferMetricId("uncompressed_size"),
        value: 30.7,
      },
      {
        fixture: "krausest",
        framework: "vanillajs-1-non-keyed",
        metric: krausestTransferMetricId("uncompressed_size"),
        value: 25,
      },
      {
        fixture: "krausest",
        framework: "luxel-v0.0.0-non-keyed",
        metric: krausestMemoryMetricId("ready_memory"),
        value: 0.8,
      },
    ];

    await writeKrausestRunArtifact(
      repoRoot,
      lines,
      {
        generatedAt: "2026-07-07T08:00:00.000Z",
        chromePin: "chrome150",
        comparatorSource: "live",
        driverCount: 1,
      },
      { announce: false },
    );

    const html = readFileSync(join(repoRoot, "docs/benchmarks/runs/krausest-latest.html"), "utf8");
    expect(html).toContain("vanillajs-1-non-keyed");
    expect(html).toContain("transferred size (in kBs) and first paint");
    expect(html).toContain("weighted geometric mean of all factors in the table");
    expect(html).toContain('<tr class="aggregate">');
  });
});
