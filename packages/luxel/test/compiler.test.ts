import { describe, expect, test } from "bun:test";
import { compileSemanticIr } from "../src/compiler/semantic-ir.ts";
import { lowerToRenderIr } from "../src/compiler/render-ir.ts";
import { compileTemplateIr } from "../src/compiler/template-ir.ts";
import { LuxelCompileError } from "../src/compiler/diagnostics.ts";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { compileRoute } from "../src/compiler/compile-route.ts";

const fixture = join(import.meta.dir, "../../../examples/counter/src/routes/index.luxel");
const aboutFixture = join(import.meta.dir, "../../../examples/counter/src/routes/about.luxel");
const repoRoot = join(import.meta.dir, "../../..");
const genRoot = join(repoRoot, "packages/luxel/src/.generated/test-routes");

describe("Semantic IR", () => {
  test("counter fixture parses", async () => {
    const source = await readFile(fixture, "utf8");
    const ir = compileSemanticIr(source);
    expect(ir.hasHydrateLoad).toBe(true);
    expect(ir.templateExprs.length).toBeGreaterThan(0);
  });

  test("about fixture parses without hydrate boundary", async () => {
    const source = await readFile(aboutFixture, "utf8");
    const ir = compileSemanticIr(source);
    expect(ir.hasHydrateLoad).toBe(false);
    const renderIr = lowerToRenderIr(ir, source);
    expect(renderIr.boundaryIds).toEqual([]);
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

describe("compileTemplateIr", () => {
  test("single parse produces semantic and render IR", async () => {
    const source = await readFile(fixture, "utf8");
    const { semantic, renderIr, sfc } = compileTemplateIr(source);
    expect(sfc.template.length).toBeGreaterThan(0);
    expect(semantic.hasHydrateLoad).toBe(true);
    expect(renderIr.boundaryIds.length).toBeGreaterThan(0);
  });
});

describe("compileRoute", () => {
  test("about route compiles without client attach module", async () => {
    const route = await compileRoute(aboutFixture, {
      routeId: "route:about",
      path: "/about",
      source: "examples/counter/src/routes/about.luxel",
      componentId: "sfc:about",
      slug: "about",
      genRoot,
    });
    expect(route.hasClientBundle).toBe(false);
    expect(route.attachModuleSrc).toBeNull();
  });
});
