import { afterEach, describe, expect, test } from "bun:test";
import { resolveBenchLoadTester, resolveBenchLoadTesterMeta } from "./load-test.ts";

const ENV_KEY = "BENCH_LOAD_TESTER";

describe("resolveBenchLoadTester", () => {
  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  test("defaults to auto (bombardier when available, else winrk)", () => {
    const tester = resolveBenchLoadTester();
    expect(tester === "bombardier" || tester === "winrk").toBe(true);
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
