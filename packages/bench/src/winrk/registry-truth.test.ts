import { describe, expect, test } from "bun:test";
import { allWinrkStacks, stacksForFixture } from "./registry.ts";
import { STACK_OPTIMIZATIONS } from "./optimizations.ts";
import { stackLabel } from "../../dashboard/src/stack-labels.ts";

describe("winrk registry truth", () => {
  test("every registry stack has optimizations metadata and dashboard label", () => {
    for (const row of allWinrkStacks()) {
      expect(STACK_OPTIMIZATIONS[row.id], row.id).toBeDefined();
      expect(STACK_OPTIMIZATIONS[row.id]!.length, row.id).toBeGreaterThan(0);
      expect(stackLabel(row.id), row.id).not.toBe(row.id);
    }
  });

  test("no orphan stack IDs in STACK_OPTIMIZATIONS without registry row", () => {
    const registered = new Set(allWinrkStacks().map((row) => row.id));
    const orphans = Object.keys(STACK_OPTIMIZATIONS).filter((id) => !registered.has(id));
    expect(orphans).toEqual([]);
  });

  test("fixture stack counts match documented matrix", () => {
    expect(stacksForFixture("counter").length).toBe(35);
    expect(stacksForFixture("spiral").length).toBe(18);
  });
});
