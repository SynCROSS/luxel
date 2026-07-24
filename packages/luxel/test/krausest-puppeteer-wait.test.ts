import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  krausestPuppeteerPostWaitMs,
  patchKrausestPuppeteerPostWait,
} from "../src/bench/krausest/setup-driver.ts";

describe("krausest puppeteer post-wait patch", () => {
  test("defaults to 350ms", () => {
    const prev = process.env.KRAUSEST_PUPPETEER_POST_WAIT_MS;
    delete process.env.KRAUSEST_PUPPETEER_POST_WAIT_MS;
    try {
      expect(krausestPuppeteerPostWaitMs()).toBe(350);
    } finally {
      if (prev !== undefined) process.env.KRAUSEST_PUPPETEER_POST_WAIT_MS = prev;
    }
  });

  test("rewrites await wait(100) before tracing.stop", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-wait-"));
    const distDir = join(root, "webdriver-ts", "dist");
    mkdirSync(distDir, { recursive: true });
    const file = join(distDir, "forkedBenchmarkRunnerPuppeteer.js");
    writeFileSync(
      file,
      [
        "await runBenchmark(page, benchmark, framework);",
        "            await wait(100);",
        "            await page.tracing.stop();",
        "",
      ].join("\n"),
    );
    const prev = process.env.KRAUSEST_PUPPETEER_POST_WAIT_MS;
    process.env.KRAUSEST_PUPPETEER_POST_WAIT_MS = "350";
    try {
      expect(patchKrausestPuppeteerPostWait(root)).toBe(true);
      const next = readFileSync(file, "utf8");
      expect(next).toContain("await wait(350);");
      expect(next).not.toContain("await wait(100);");
    } finally {
      if (prev !== undefined) process.env.KRAUSEST_PUPPETEER_POST_WAIT_MS = prev;
      else delete process.env.KRAUSEST_PUPPETEER_POST_WAIT_MS;
    }
  });
});
