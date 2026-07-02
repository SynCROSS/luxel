import { describe, expect, test } from "bun:test";
import { filterStacks } from "./stack-filter.ts";
import type { StackRow } from "./registry.ts";

const rows: StackRow[] = [
  { id: "a", framework: "a", mode: "ssr", start: async () => null },
  { id: "b", framework: "b", mode: "ssr", start: async () => null },
  { id: "c", framework: "c", mode: "ssr", start: async () => null },
];

describe("filterStacks", () => {
  test("returns all when env unset", () => {
    expect(filterStacks(rows, {})).toEqual(rows);
  });

  test("WINRK_STACK picks subset in registry order", () => {
    expect(filterStacks(rows, { WINRK_STACK: "c,a" }).map((r) => r.id)).toEqual(["a", "c"]);
  });

  test("WINRK_STACK_UNTIL returns prefix inclusive", () => {
    expect(filterStacks(rows, { WINRK_STACK_UNTIL: "b" }).map((r) => r.id)).toEqual(["a", "b"]);
  });

  test("rejects both filters", () => {
    expect(() => filterStacks(rows, { WINRK_STACK: "a", WINRK_STACK_UNTIL: "b" })).toThrow(
      /not both/,
    );
  });
});
