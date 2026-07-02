import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { requireNodeExecutable } from "../src/util/find-node.ts";

describe("findNodeExecutable", () => {
  test("resolves an existing node binary on this machine", () => {
    const node = requireNodeExecutable();
    expect(node.length).toBeGreaterThan(0);
    expect(existsSync(node)).toBe(true);
  });
});
