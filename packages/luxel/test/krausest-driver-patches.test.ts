import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  patchKrausestMousedownRetry,
  patchKrausestPuppeteerProtocolTimeout,
  patchKrausestForceGcTimeout,
  patchKrausestSizeFirstPaintWait,
  patchKrausestCheckElementHasClass,
  krausestPuppeteerProtocolTimeoutMs,
  KRAUSEST_PUPPETEER_PROTOCOL_TIMEOUT_MS_DEFAULT,
} from "../src/bench/krausest/setup-driver.ts";

describe("krausest size first-paint wait patch", () => {
  test("injects paint poll before reading first-paint", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-fp-"));
    const distDir = join(root, "webdriver-ts", "dist");
    mkdirSync(distDir, { recursive: true });
    const file = join(distDir, "forkedBenchmarkRunnerSize.js");
    writeFileSync(
      file,
      [
        'let paintEvents = JSON.parse(await page.evaluate(`JSON.stringify(performance.getEntriesByType("paint"))`));',
        'console.log("paintEvents", paintEvents);',
        'sizeInfo.fp = paintEvents.find((e) => e.name === "first-paint").startTime;',
        "",
      ].join("\n"),
    );
    expect(patchKrausestSizeFirstPaintWait(root)).toBe(true);
    const next = readFileSync(file, "utf8");
    expect(next).toContain("LUXEL_KRAUSEST_SIZE_FP_WAIT");
    expect(next).toContain("first-paint missing after wait");
    expect(patchKrausestSizeFirstPaintWait(root)).toBe(false);
  });
});

describe("krausest mousedown retry patch", () => {
  test("retries mousedown invariant like click", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-md-"));
    const distDir = join(root, "webdriver-ts", "dist");
    mkdirSync(distDir, { recursive: true });
    const file = join(distDir, "forkedBenchmarkRunnerPuppeteer.js");
    writeFileSync(
      file,
      [
        'if (error === "exactly one click event is expected") {',
        '  console.log("*** Repeating run because of \'exactly one click event is expected\' error");',
        "}",
        "",
      ].join("\n"),
    );
    expect(patchKrausestMousedownRetry(root)).toBe(true);
    const next = readFileSync(file, "utf8");
    expect(next).toContain("LUXEL_KRAUSEST_MOUSEDOWN_RETRY");
    expect(next).toContain("at most one mousedown event is expected");
    expect(next).not.toContain(") { {");
    expect(next.match(/\{/g)?.length).toBe(next.match(/\}/g)?.length);
    expect(patchKrausestMousedownRetry(root)).toBe(false);
  });
});

describe("krausest puppeteer protocolTimeout patch", () => {
  test("defaults to 10 minutes", () => {
    const prev = process.env.KRAUSEST_PUPPETEER_PROTOCOL_TIMEOUT_MS;
    delete process.env.KRAUSEST_PUPPETEER_PROTOCOL_TIMEOUT_MS;
    try {
      expect(krausestPuppeteerProtocolTimeoutMs()).toBe(
        KRAUSEST_PUPPETEER_PROTOCOL_TIMEOUT_MS_DEFAULT,
      );
    } finally {
      if (prev !== undefined) process.env.KRAUSEST_PUPPETEER_PROTOCOL_TIMEOUT_MS = prev;
    }
  });

  test("injects protocolTimeout into puppeteer.launch", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-pto-"));
    const distDir = join(root, "webdriver-ts", "dist");
    mkdirSync(distDir, { recursive: true });
    const file = join(distDir, "puppeteerAccess.js");
    writeFileSync(
      file,
      [
        "const browser = await puppeteer.launch({",
        "        headless: false,",
        "        executablePath: browserPath(benchmarkOptions),",
        "        args,",
        "        dumpio: false,",
        "        defaultViewport: {",
        "            width,",
        "            height,",
        "        },",
        "    });",
        "",
      ].join("\n"),
    );
    const prev = process.env.KRAUSEST_PUPPETEER_PROTOCOL_TIMEOUT_MS;
    process.env.KRAUSEST_PUPPETEER_PROTOCOL_TIMEOUT_MS = "120000";
    try {
      expect(patchKrausestPuppeteerProtocolTimeout(root)).toBe(true);
      const next = readFileSync(file, "utf8");
      expect(next).toContain("LUXEL_KRAUSEST_PROTOCOL_TIMEOUT");
      expect(next).toContain("protocolTimeout: 120000");
      process.env.KRAUSEST_PUPPETEER_PROTOCOL_TIMEOUT_MS = "900000";
      expect(patchKrausestPuppeteerProtocolTimeout(root)).toBe(true);
      expect(readFileSync(file, "utf8")).toContain("protocolTimeout: 900000");
    } finally {
      if (prev !== undefined) process.env.KRAUSEST_PUPPETEER_PROTOCOL_TIMEOUT_MS = prev;
      else delete process.env.KRAUSEST_PUPPETEER_PROTOCOL_TIMEOUT_MS;
    }
  });
});

describe("krausest checkElementHasClass patch", () => {
  test("uses classList.contains instead of returning DOMTokenList", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-hasclass-"));
    const distDir = join(root, "webdriver-ts", "dist");
    mkdirSync(distDir, { recursive: true });
    const file = join(distDir, "puppeteerAccess.js");
    writeFileSync(
      file,
      [
        "export async function checkElementHasClass(page, selector, className) {",
        "    let clazzes;",
        "    for (let k = 0; k < 10; k++) {",
        "        let elem = await page.$(selector);",
        "        if (elem) {",
        "            let clazzes = await elem.evaluate((e) => e === null || e === void 0 ? void 0 : e.classList);",
        "            if (clazzes === undefined)",
        '                console.log("WARNING: checkElementHasClass was undefined");',
        "            if (clazzes) {",
        "                let result = Object.values(clazzes).includes(className);",
        "                await elem.dispose();",
        "                if (result)",
        "                    return;",
        "            }",
        "        }",
        "        await wait(k < 3 ? 10 : 1000);",
        "    }",
        "    throw `checkElementHasClass ${selector} failed. expected ${className}, but was ${clazzes}`;",
        "}",
        "",
      ].join("\n"),
    );
    expect(patchKrausestCheckElementHasClass(root)).toBe(true);
    const next = readFileSync(file, "utf8");
    expect(next).toContain("LUXEL_KRAUSEST_HAS_CLASS");
    expect(next).toContain("classList.contains");
    expect(next).not.toContain("e.classList);");
    expect(next).not.toContain("Object.values(clazzes)");
    expect(patchKrausestCheckElementHasClass(root)).toBe(false);
  });
});

describe("krausest forceGC timeout patch", () => {
  test("skips awaiting GC so hung CDP cannot wedge the session", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-fgc-"));
    const distDir = join(root, "webdriver-ts", "dist");
    mkdirSync(distDir, { recursive: true });
    const file = join(distDir, "forkedBenchmarkRunnerPuppeteer.js");
    writeFileSync(
      file,
      [
        "async function forceGC(page) {",
        '    await page.evaluate("window.gc({type:\'major\',execution:\'sync\',flavor:\'last-resort\'})");',
        "}",
        "async function runCPUBenchmark() {}",
        "",
      ].join("\n"),
    );
    expect(patchKrausestForceGcTimeout(root)).toBe(true);
    const next = readFileSync(file, "utf8");
    expect(next).toContain("LUXEL_KRAUSEST_FORCE_GC");
    expect(next).toContain("Never await page.evaluate here");
    expect(next).not.toContain("last-resort");
    expect(next).not.toContain("page.evaluate(\"window.gc");
    expect(patchKrausestForceGcTimeout(root)).toBe(false);
  });

  test("upgrades prior Promise.race soft patch to skip", () => {
    const root = mkdtempSync(join(tmpdir(), "krausest-fgc2-"));
    const distDir = join(root, "webdriver-ts", "dist");
    mkdirSync(distDir, { recursive: true });
    const file = join(distDir, "forkedBenchmarkRunnerPuppeteer.js");
    writeFileSync(
      file,
      [
        "async function forceGC(page) {",
        "    // LUXEL_KRAUSEST_FORCE_GC",
        "    try {",
        "        await Promise.race([",
        '            page.evaluate("window.gc && window.gc()"),',
        '            new Promise((_, reject) => setTimeout(() => reject(new Error("forceGC timeout")), 10000)),',
        "        ]);",
        "    } catch (e) {",
        '        console.log("forceGC skipped:", e && e.message ? e.message : e);',
        "    }",
        "}",
        "",
      ].join("\n"),
    );
    expect(patchKrausestForceGcTimeout(root)).toBe(true);
    expect(readFileSync(file, "utf8")).toContain("Never await page.evaluate here");
  });
});
