import { describe, expect, test } from "bun:test";
import { generateTrisomorphicSw } from "../src/runtime/trisomorphic-sw.ts";

describe("trisomorphic SW", () => {
  test("ships install, activate, and fetch handlers for / and /detail", () => {
    const sw = generateTrisomorphicSw({ "/": "stale", "/detail": "none" });
    expect(sw).toContain('addEventListener("install"');
    expect(sw).toContain('addEventListener("fetch"');
    expect(sw).toContain('"/detail"');
    expect(sw).not.toContain("eval(");
  });
});
