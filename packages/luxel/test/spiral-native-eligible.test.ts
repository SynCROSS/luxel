import { describe, expect, test } from "bun:test";
import { compileTemplateIr } from "../src/compiler/template-ir.ts";
import { nativeSsrRouteKind } from "../src/compiler/spiral-native.ts";

describe("spiral native eligibility", () => {
  test("positioned spiral tiles loop is native spiral", () => {
    const { renderIr } = compileTemplateIr(`<template>
  <div id="wrapper">
    {#each tiles as t}
    <div class="tile" style="left:{t.x}px;top:{t.y}px"></div>
    {/each}
  </div>
</template>
<script>
export function load(ctx) {
  ctx.store.set("route:index:tiles", [{ x: 0, y: 0 }]);
}
</script>`);
    expect(nativeSsrRouteKind(renderIr)).toBe("spiral");
  });

  test("generic tiles list is not native spiral", () => {
    const { renderIr } = compileTemplateIr(`<template>
  <ul>
    {#each tiles as t}
    <li>{t.label}</li>
    {/each}
  </ul>
</template>
<script>
export function load(ctx) {
  ctx.store.set("custom:tiles:v1", [{ label: "zeta" }]);
}
</script>`);
    expect(nativeSsrRouteKind(renderIr)).toBeNull();
  });
});
