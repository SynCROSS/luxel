import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { compileRoute } from "../src/compiler/compile-route.ts";

const repoRoot = join(import.meta.dir, "../../..");
const genRoot = join(repoRoot, "packages/luxel/src/.generated/each-list-keyed-client");

describe("keyed {#each} attach codegen", () => {
  test("emits reconcileKeyedList when each block has a key expression", async () => {
    const routesDir = join(genRoot, "routes");
    await mkdir(routesDir, { recursive: true });
    const sfc = `<template>
  <section hydrate:load>
    <table><tbody>
      {#each rows as row (row.id)}
      <tr><td>{row.label}</td></tr>
      {/each}
    </tbody></table>
  </section>
</template>
<script>
const rows = signal([]);
</script>
`;
    await writeFile(join(routesDir, "index.luxel"), sfc, "utf8");
    const route = await compileRoute(join(routesDir, "index.luxel"), {
      routeId: "route:keyed",
      path: "/",
      source: "test/each-list-keyed/index.luxel",
      componentId: "sfc:keyed",
      slug: "keyed-client",
      genRoot,
    });
    expect(route.attachModuleSrc).toContain("reconcileKeyedList");
    expect(route.attachModuleSrc).toContain("item.id");
  });
});
