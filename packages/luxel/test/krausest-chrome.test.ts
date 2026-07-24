import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  chromeForTestingDownloadUrl,
  chromeMajor,
  chromeVersionFromOutput,
  chromeVersionWarning,
  resolveKrausestChromeBinary,
  shouldPreferInstalledChromeBeforeDownload,
} from "../src/bench/krausest/krausest-chrome.ts";
import { findChromeExecutable, resetChromeExecutableCache } from "../src/util/find-chrome.ts";

describe("krausest chrome resolution", () => {
  test("parses chrome version from --version output", () => {
    expect(chromeVersionFromOutput("Google Chrome 150.0.7871.47")).toBe("150.0.7871.47");
    expect(chromeVersionFromOutput("Chromium 150.0.7871.46")).toBe("150.0.7871.46");
  });

  test("warns when major or build differs from reference", () => {
    expect(chromeVersionWarning("150.0.7871.47")).toBeNull();
    expect(chromeVersionWarning("150.0.7871.46")).toContain("!= reference");
    expect(chromeVersionWarning("149.0.7827.114")).toContain("major 149");
    expect(chromeVersionWarning(null)).toContain("could not read");
  });

  test("only prefers installed before download when major matches pin", () => {
    expect(chromeMajor("150.0.7871.47")).toBe(150);
    expect(chromeMajor("148.0.7778.96")).toBe(148);
    expect(shouldPreferInstalledChromeBeforeDownload("150.0.7871.46")).toBe(true);
    expect(shouldPreferInstalledChromeBeforeDownload("148.0.7778.96")).toBe(false);
    expect(shouldPreferInstalledChromeBeforeDownload(null)).toBe(false);
  });

  test("builds Chrome for Testing download URL with platform subdir", () => {
    if (process.platform === "win32") {
      expect(chromeForTestingDownloadUrl()).toBe(
        "https://storage.googleapis.com/chrome-for-testing-public/150.0.7871.47/win64/chrome-win64.zip",
      );
    }
  });

  test("skips non-150 installed before download then falls back after timeout", async () => {
    const installed = findChromeExecutable();
    if (!installed) return;

    const prevEnv = process.env.KRAUSEST_CHROME_BINARY;
    const prevBin = process.env.CHROME_BIN;
    const prevPath = process.env.CHROME_PATH;
    const prevTimeout = process.env.KRAUSEST_CHROME_DOWNLOAD_TIMEOUT_MS;
    delete process.env.KRAUSEST_CHROME_BINARY;
    delete process.env.CHROME_BIN;
    delete process.env.CHROME_PATH;
    process.env.KRAUSEST_CHROME_DOWNLOAD_TIMEOUT_MS = "2000";
    resetChromeExecutableCache();

    const repoRoot = mkdtempSync(join(tmpdir(), "krausest-chrome-pref-"));
    mkdirSync(join(repoRoot, ".cache", "krausest-chrome"), { recursive: true });
    mkdirSync(join(repoRoot, ".cache", "krausest-chrome", "ungoogled-150.0.7871.46-1.1"), {
      recursive: true,
    });
    mkdirSync(join(repoRoot, ".cache", "krausest-chrome", "cft-150.0.7871.47"), {
      recursive: true,
    });

    try {
      const resolution = await resolveKrausestChromeBinary(repoRoot, true);
      // Non-150 Playwright must not short-circuit as preferred pin; last resort ok.
      expect(resolution.path).toBe(installed);
      expect(resolution.source).toBe("installed");
    } finally {
      if (prevEnv !== undefined) process.env.KRAUSEST_CHROME_BINARY = prevEnv;
      else delete process.env.KRAUSEST_CHROME_BINARY;
      if (prevBin !== undefined) process.env.CHROME_BIN = prevBin;
      else delete process.env.CHROME_BIN;
      if (prevPath !== undefined) process.env.CHROME_PATH = prevPath;
      else delete process.env.CHROME_PATH;
      if (prevTimeout !== undefined) process.env.KRAUSEST_CHROME_DOWNLOAD_TIMEOUT_MS = prevTimeout;
      else delete process.env.KRAUSEST_CHROME_DOWNLOAD_TIMEOUT_MS;
      resetChromeExecutableCache();
    }
  }, 30_000);

  test("env binary short-circuits without download", async () => {
    const fake = join(mkdtempSync(join(tmpdir(), "krausest-chrome-env-")), "chrome.exe");
    writeFileSync(fake, "");
    const prev = process.env.KRAUSEST_CHROME_BINARY;
    process.env.KRAUSEST_CHROME_BINARY = fake;
    resetChromeExecutableCache();
    try {
      const resolution = await resolveKrausestChromeBinary(
        mkdtempSync(join(tmpdir(), "krausest-chrome-root-")),
        false,
      );
      expect(resolution.source).toBe("env");
      expect(resolution.path).toBe(fake);
    } finally {
      if (prev !== undefined) process.env.KRAUSEST_CHROME_BINARY = prev;
      else delete process.env.KRAUSEST_CHROME_BINARY;
      resetChromeExecutableCache();
    }
  });
});
