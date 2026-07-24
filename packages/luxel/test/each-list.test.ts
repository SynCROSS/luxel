import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { compileRoute } from "../src/compiler/compile-route.ts";
import { LuxelCompileError } from "../src/compiler/diagnostics.ts";
import { compileTemplateIr } from "../src/compiler/template-ir.ts";
import { codegenAttachModule } from "../src/compiler/codegen-attach.ts";
import { createLoadContext } from "../src/resource-store/load-context.ts";
import { ResourceStore } from "../src/resource-store/store.ts";

const repoRoot = join(import.meta.dir, "../../..");
const genRoot = join(repoRoot, "packages/luxel/src/.generated/each-list");
const customKeyGenRoot = join(repoRoot, "packages/luxel/src/.generated/each-list-custom-key");

const listSfc = `<template>
  <ul>
    {#each items as item}
    <li>{item.label}</li>
    {/each}
  </ul>
</template>

<script>
export async function load(ctx) {
  ctx.store.set("route:list:items", [
    { label: "alpha" },
    { label: "beta" },
  ]);
}
</script>
`;

describe("{#each} list SSR", () => {
  test("load + render outputs list items from store", async () => {
    const routesDir = join(genRoot, "routes");
    await mkdir(routesDir, { recursive: true });
    const sfcPath = join(routesDir, "index.luxel");
    await writeFile(sfcPath, listSfc, "utf8");

    const route = await compileRoute(sfcPath, {
      routeId: "route:list",
      path: "/",
      source: "test/each-list/index.luxel",
      componentId: "sfc:list",
      slug: "list",
      genRoot,
    });

    const store = new ResourceStore();
    const ctx = createLoadContext(store);
    await route.load(ctx);

    const html = route.renderFromStore(store);
    expect(html).toContain("<li>alpha</li>");
    expect(html).toContain("<li>beta</li>");
  });

  test("missing {/each} is a compile error", () => {
    const source = `<template>
  <ul>
    {#each items as item}
    <li>{item.label}</li>
  </ul>
</template>
<script>
export async function load(ctx) {}
</script>
`;
    expect(() => compileTemplateIr(source)).toThrow(LuxelCompileError);
    expect(() => compileTemplateIr(source)).toThrow(/missing \{\/each\}/i);
  });

  test("default list binding key is routeId:listId", async () => {
    const routesDir = join(genRoot, "routes");
    await mkdir(routesDir, { recursive: true });
    const sfcPath = join(routesDir, "index.luxel");
    await writeFile(sfcPath, listSfc, "utf8");

    const route = await compileRoute(sfcPath, {
      routeId: "route:list",
      path: "/",
      source: "test/each-list/index.luxel",
      componentId: "sfc:list",
      slug: "list",
      genRoot,
    });

    expect(route.bindings).toContainEqual({
      templateId: "items",
      resourceKey: "route:list:items",
      field: "items",
    });
  });

  test("custom store.set key overrides default list binding", async () => {
    const routesDir = join(customKeyGenRoot, "routes");
    await mkdir(routesDir, { recursive: true });
    const sfcPath = join(routesDir, "index.luxel");
    const customSfc = `<template>
  <ul>
    {#each tiles as t}
    <li>{t.label}</li>
    {/each}
  </ul>
</template>
<script>
export async function load(ctx) {
  ctx.store.set("custom:tiles:v1", [{ label: "zeta" }]);
}
</script>
`;
    await writeFile(sfcPath, customSfc, "utf8");

    const route = await compileRoute(sfcPath, {
      routeId: "route:custom",
      path: "/",
      source: "test/each-list/custom-key/index.luxel",
      componentId: "sfc:custom",
      slug: "custom",
      genRoot: customKeyGenRoot,
    });

    expect(route.bindings).toContainEqual({
      templateId: "tiles",
      resourceKey: "custom:tiles:v1",
      field: "tiles",
    });

    const store = new ResourceStore();
    await route.load(createLoadContext(store));
    expect(route.renderFromStore(store)).toContain("<li>zeta</li>");
  });

  test("list route emits compiled for loop in server render module", async () => {
    const routesDir = join(genRoot, "routes");
    await mkdir(routesDir, { recursive: true });
    const sfcPath = join(routesDir, "index.luxel");
    await writeFile(sfcPath, listSfc, "utf8");

    const route = await compileRoute(sfcPath, {
      routeId: "route:list",
      path: "/",
      source: "test/each-list/index.luxel",
      componentId: "sfc:list",
      slug: "list",
      genRoot,
    });

    expect(route.serverModuleSrc).toMatch(/for\s*\(/);
    expect(route.serverModuleSrc).not.toContain('"kind":"forLoop"');
  });

  test("client attach uses cloneNode row template + delegated clicks", () => {
    const source = `<template>
  <div hydrate:load>
    <tbody>
      {#each rows as row}
      <tr class="{row.trClass}">
        <td class="col-md-1">{row.id}</td>
        <td class="col-md-4"><a on:click={selectRow}>{row.label}</a></td>
      </tr>
      {/each}
    </tbody>
  </div>
</template>
<script>
const rows = signal([]);
function selectRow() {}
</script>
`;
    const { renderIr } = compileTemplateIr(source);
    const attach = codegenAttachModule(renderIr);
    expect(attach).toContain("cloneNode(true)");
    expect(attach).toContain("bindDelegatedClicks");
    expect(attach).toContain("data-luxel-click");
    expect(attach).toContain('.className = "col-md-1"');
    expect(attach).toContain("WeakMap");
    expect(attach).toContain("_row_cache");
    expect(attach).toContain("vals[");
    expect(attach).toContain("nodeValue");
    expect(attach).toMatch(/function create_\w+_row[\s\S]*?_row_cache\.set\(row/);
    expect(attach).not.toMatch(/bindClick\(row_/);
  });
});
