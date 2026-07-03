import { afterEach, describe, expect, test } from "bun:test";
import {
  BENCH_LOAD_TESTER_AUTO_CHAIN,
  nextFallbackLoadTester,
  resolveBenchLoadTester,
  resolveBenchLoadTesterMeta,
} from "./load-test.ts";
import { isOhaAvailable } from "./resolve-oha.ts";

const ENV_KEY = "BENCH_LOAD_TESTER";

describe("resolveBenchLoadTester", () => {
  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  test("auto chain order is oha → bombardier → wrk → winrk", () => {
    expect(BENCH_LOAD_TESTER_AUTO_CHAIN).toEqual(["oha", "bombardier", "wrk", "winrk"]);
  });

  test("defaults to auto (first available in chain)", () => {
    const tester = resolveBenchLoadTester();
    expect(BENCH_LOAD_TESTER_AUTO_CHAIN).toContain(tester);
  });

  test("env oha forces oha", () => {
    process.env[ENV_KEY] = "oha";
    expect(resolveBenchLoadTester()).toBe("oha");
  });

  test("env winrk forces winrk", () => {
    process.env[ENV_KEY] = "winrk";
    expect(resolveBenchLoadTester()).toBe("winrk");
  });

  test("env bombardier forces bombardier", () => {
    process.env[ENV_KEY] = "bombardier";
    expect(resolveBenchLoadTester()).toBe("bombardier");
  });

  test("meta matches resolved tester name", () => {
    process.env[ENV_KEY] = "winrk";
    const meta = resolveBenchLoadTesterMeta();
    expect(meta.name).toBe("winrk");
    expect(meta.path.length).toBeGreaterThan(0);
  });
});

describe("nextFallbackLoadTester", () => {
  test("oha falls back to bombardier or later when available", () => {
    const next = nextFallbackLoadTester("oha");
    expect(next === "bombardier" || next === "wrk" || next === "winrk").toBe(true);
  });

  test("winrk has no further fallback", () => {
    expect(nextFallbackLoadTester("winrk")).toBeNull();
  });

  test("prefers oha in auto when installed", () => {
    if (!isOhaAvailable()) return;
    expect(resolveBenchLoadTester()).toBe("oha");
  });
});
