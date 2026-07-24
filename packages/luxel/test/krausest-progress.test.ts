import { describe, expect, test } from "bun:test";
import {
  formatKrausestHarnessTimings,
  formatKrausestProgress,
  KrausestProgressTracker,
  krausestPhaseTimeoutMs,
  krausestProgressFrameworkPath,
  parseKrausestDriverProgressLine,
  withKrausestPhaseTimeout,
} from "../src/bench/krausest/progress.ts";

describe("krausest driver progress", () => {
  test("parses upstream executing log lines", () => {
    expect(
      parseKrausestDriverProgressLine(
        "Executing frameworks/non-keyed/luxel and benchmark 01_run1k",
      ),
    ).toEqual({
      frameworkPath: "non-keyed/luxel",
      benchId: "01_run1k",
    });
  });

  test("formats fw/bench progress with elapsed", () => {
    const line = formatKrausestProgress({
      frameworkIndex: 2,
      frameworkTotal: 67,
      benchIndex: 1,
      benchTotal: 13,
      frameworkLabel: "luxel-v0.0.0-non-keyed",
      benchId: "01_run1k",
      elapsedMs: 65_000,
      etaMs: 120_000,
    });
    expect(line).toContain("[fw 2/67]");
    expect(line).toContain("[bench 1/13]");
    expect(line).toContain("luxel-v0.0.0-non-keyed");
    expect(line).toContain("01_run1k");
    expect(line).toContain("elapsed 1m 5s");
    expect(line).toContain("ETA");
  });

  test("tracker maps customURL Executing paths", () => {
    const tracker = new KrausestProgressTracker(
      1,
      2,
      [
        {
          driverPath: "non-keyed/reflex-dom",
          label: "reflex-dom-v0.4-non-keyed",
          customURL: "/bundled-dist",
        },
      ],
    );
    const state = tracker.onDriverLine(
      "Executing frameworks/non-keyed/reflex-dom/bundled-dist and benchmark 04_select1k",
    );
    expect(state?.frameworkIndex).toBe(1);
    expect(state?.frameworkLabel).toBe("reflex-dom-v0.4-non-keyed");
    expect(state?.benchIndex).toBe(4);
  });

  test("tracker advances on driver lines", () => {
    const tracker = new KrausestProgressTracker(
      2,
      2,
      [
        { driverPath: "non-keyed/luxel", label: "luxel-v0.0.0-non-keyed" },
        { driverPath: "non-keyed/vanillajs", label: "vanillajs-non-keyed" },
      ],
    );
    const first = tracker.onDriverLine(
      "Executing frameworks/non-keyed/luxel and benchmark 01_run1k",
    );
    expect(first?.frameworkLabel).toBe("luxel-v0.0.0-non-keyed");
    const second = tracker.onDriverLine(
      "Executing frameworks/non-keyed/vanillajs and benchmark 09_clear1k_x8",
    );
    expect(second?.frameworkLabel).toBe("vanillajs-non-keyed");
  });

  test("krausestProgressFrameworkPath joins customURL", () => {
    expect(krausestProgressFrameworkPath("non-keyed/reflex-dom", "/bundled-dist")).toBe(
      "non-keyed/reflex-dom/bundled-dist",
    );
    expect(krausestProgressFrameworkPath("non-keyed/luxel")).toBe("non-keyed/luxel");
  });

  test("formats harness phase timings", () => {
    expect(
      formatKrausestHarnessTimings({ zipMs: 1000, rebuildMs: 2000, driverMs: 3000 }),
    ).toBe("krausest harness: setup.zip_ms=1000 setup.rebuild_ms=2000 driver.total_ms=3000");
  });

  test("phase timeout defaults include chrome-resolve 2m", () => {
    expect(krausestPhaseTimeoutMs("chrome-resolve")).toBe(120_000);
    expect(krausestPhaseTimeoutMs("zip")).toBe(30 * 60_000);
  });

  test("withKrausestPhaseTimeout fails loud when phase exceeds budget", async () => {
    await expect(
      withKrausestPhaseTimeout(
        "chrome-resolve",
        async () => {
          await Bun.sleep(200);
          return "ok";
        },
        { timeoutMs: 50, heartbeatMs: 1_000 },
      ),
    ).rejects.toThrow(/chrome-resolve timed out/);
  });

  test("withKrausestPhaseTimeout returns when work finishes under budget", async () => {
    const value = await withKrausestPhaseTimeout(
      "chrome-resolve",
      async () => "done",
      { timeoutMs: 5_000, heartbeatMs: 10_000 },
    );
    expect(value).toBe("done");
  });
});
