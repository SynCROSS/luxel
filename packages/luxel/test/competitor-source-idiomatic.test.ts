import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { competitorSource } from "../src/bench/competitors/sources-path.ts";

async function readSource(...segments: string[]): Promise<string> {
  return readFile(competitorSource(...segments), "utf8");
}

describe("competitor source idiomatic peak (fairness.md)", () => {
  test("counter react uses useState", async () => {
    const src = await readSource("counter", "react.tsx");
    expect(src).toMatch(/useState\s*\(\s*0\s*\)/);
    expect(src).not.toMatch(/data-luxel-text="count">\s*0\s*</);
  });

  test("counter solid uses createSignal", async () => {
    const src = await readSource("counter", "solid.ts");
    expect(src).toMatch(/createSignal\s*\(\s*0\s*\)/);
    expect(src).toMatch(/\$\{count\(\)\}/);
  });

  test("counter svelte uses $state binding", async () => {
    const src = await readSource("counter", "svelte.svelte");
    expect(src).toMatch(/\$state\s*\(\s*0\s*\)/);
    expect(src).toMatch(/\{count\}/);
    expect(src).not.toMatch(/data-luxel-text="count">\s*0\s*</);
  });

  test("counter vue uses ref", async () => {
    for (const file of ["vue-vdom.vue", "vue-vapor.vue"]) {
      const src = await readSource("counter", file);
      expect(src).toMatch(/ref\s*\(\s*0\s*\)/);
      expect(src).toMatch(/\{\{\s*count\s*\}\}/);
    }
  });

  test("spiral sources avoid client reactivity on tiles", async () => {
    const spiralFiles = [
      ["spiral", "react.tsx"],
      ["spiral", "solid.ts"],
      ["spiral", "svelte.svelte"],
      ["spiral", "vue-vdom.vue"],
      ["spiral", "vue-vapor.vue"],
    ] as const;
    for (const segments of spiralFiles) {
      const src = await readSource(...segments);
      expect(src).not.toMatch(/useState|createSignal|\$state|ref\s*\(/);
      expect(src).toMatch(/toFixed\s*\(\s*2\s*\)/);
    }
  });
});
