import { describe, expect, test } from "bun:test";
import { fixtureForStackIds, resolveWinrkFixture } from "./resolve-winrk-fixture.ts";

describe("resolveWinrkFixture", () => {
  test("WINRK_FIXTURE=all + WINRK_STACK infers counter for inline row", () => {
    const result = resolveWinrkFixture({
      WINRK_FIXTURE: "all",
      WINRK_STACK: "react-ssr",
    });
    expect("fixture" in result && result.fixture).toBe("counter");
    expect("notice" in result && result.notice).toContain("all ignored");
  });

  test("WINRK_FIXTURE=all without stack filter is fatal", () => {
    const result = resolveWinrkFixture({ WINRK_FIXTURE: "all" });
    expect("fatal" in result).toBe(true);
  });

  test("WINRK_FIXTURE=spiral + counter WINRK_STACK infers counter", () => {
    const result = resolveWinrkFixture({
      WINRK_FIXTURE: "spiral",
      WINRK_STACK: "luxel-ssr-native",
    });
    expect("fixture" in result && result.fixture).toBe("counter");
    expect("notice" in result && result.notice).toContain("spiral");
    expect("notice" in result && result.notice).toContain("counter");
  });

  test("fixtureForStackIds maps react-ssr to counter", () => {
    expect(fixtureForStackIds(["react-ssr"])).toBe("counter");
  });

  test("fixtureForStackIds maps react-spiral-ssr to spiral", () => {
    expect(fixtureForStackIds(["react-spiral-ssr"])).toBe("spiral");
  });

  test("rejects stack ids spanning both fixtures", () => {
    expect(() => fixtureForStackIds(["react-ssr", "react-spiral-ssr"])).toThrow(/spans counter/);
  });
});
