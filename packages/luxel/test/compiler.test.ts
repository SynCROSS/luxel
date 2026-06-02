import { describe, expect, test } from "bun:test";
import { compileSemanticIr } from "../src/compiler/semantic-ir.ts";
import { LuxelCompileError } from "../src/compiler/diagnostics.ts";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const fixture = join(import.meta.dir, "../../../examples/counter/src/routes/index.luxel");

describe("Semantic IR", () => {
  test("counter fixture parses", async () => {
    const source = await readFile(fixture, "utf8");
    const ir = compileSemanticIr(source);
    expect(ir.hasHydrateLoad).toBe(true);
    expect(ir.templateExprs.length).toBeGreaterThan(0);
  });

  test("rejects impure template expression", () => {
    const source = `<template><p>{count + 1}</p></template><script></script>`;
    expect(() => compileSemanticIr(source)).toThrow(LuxelCompileError);
  });

  test("rejects unsafe:html", () => {
    const source = `<template unsafe:html><p>x</p></template><script></script>`;
    expect(() => compileSemanticIr(source)).toThrow(LuxelCompileError);
  });
});
