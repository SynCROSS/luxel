import { describe, expect, test } from "bun:test";
import {
  AGGRESSIVE_ORPHAN_CMD_PATTERNS,
  KRAUSEST_CHROME_ORPHAN_CMD_PATTERNS,
  KRAUSEST_ORPHAN_CMD_PATTERNS,
  ORPHAN_RE,
  WINRK_ORPHAN_CMD_PATTERNS,
  isAggressiveCleanupRequested,
  parseWmicProcessList,
} from "./bench-cleanup-orphans.ts";

describe("bench cleanup orphans", () => {
  test("default patterns cover winrk and krausest cmdline fingerprints", () => {
    expect(WINRK_ORPHAN_CMD_PATTERNS).toContain("winrk-run.ts");
    expect(KRAUSEST_ORPHAN_CMD_PATTERNS).toContain("js-framework-benchmark");
    expect(KRAUSEST_ORPHAN_CMD_PATTERNS).toContain("webdriver-ts");
    expect(KRAUSEST_ORPHAN_CMD_PATTERNS).toContain("benchmarkRunner");
    expect(ORPHAN_RE.test("node vendor/js-framework-benchmark/webdriver-ts/dist/benchmarkRunner.js")).toBe(
      true,
    );
    expect(ORPHAN_RE.test("bun packages/luxel/src/cli.ts bench --krausest --full")).toBe(true);
  });

  test("chrome fingerprints target krausest puppeteer leftovers", () => {
    expect(KRAUSEST_CHROME_ORPHAN_CMD_PATTERNS).toContain("js-framework-benchmark");
    expect(KRAUSEST_CHROME_ORPHAN_CMD_PATTERNS).toContain("krausest-chrome");
  });

  test("aggressive patterns are opt-in and broader", () => {
    expect(AGGRESSIVE_ORPHAN_CMD_PATTERNS.some((p) => p.includes("cli.ts"))).toBe(true);
    expect(isAggressiveCleanupRequested(["node", "cli.ts"], {})).toBe(false);
    expect(isAggressiveCleanupRequested(["node", "cli.ts", "--aggressive"], {})).toBe(true);
    expect(isAggressiveCleanupRequested([], { BENCH_CLEANUP_AGGRESSIVE: "1" })).toBe(true);
    expect(isAggressiveCleanupRequested([], { BENCH_CLEANUP_AGGRESSIVE: "0" })).toBe(false);
  });

  test("parses wmic LIST process blocks", () => {
    const parsed = parseWmicProcessList(`
CommandLine=node webdriver-ts/dist/benchmarkRunner.js
ProcessId=1234

CommandLine=bun packages/luxel/src/cli.ts bench --krausest
ProcessId=5678
`);
    expect(parsed).toEqual([
      { pid: 1234, commandLine: "node webdriver-ts/dist/benchmarkRunner.js" },
      { pid: 5678, commandLine: "bun packages/luxel/src/cli.ts bench --krausest" },
    ]);
  });
});
