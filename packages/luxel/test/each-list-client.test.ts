import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Window } from "happy-dom";
import { compileRoute } from "../src/compiler/compile-route.ts";
import { ResourceStore } from "../src/resource-store/store.ts";

const repoRoot = join(import.meta.dir, "../../..");
const genRoot = join(repoRoot, "packages/luxel/src/.generated/each-list-client");

const listClientSfc = `<template>
  <section hydrate:load>
    <button type="button" id="run" on:click={run}>Run</button>
    <button type="button" id="clear" on:click={clearRows}>Clear</button>
    <table class="table table-hover table-striped test-data">
      <tbody>
        {#each rows as row}
        <tr class="{row.trClass}">
          <td class="col-md-1">{row.id}</td>
          <td class="col-md-4">{row.label}</td>
        </tr>
        {/each}
      </tbody>
    </table>
  </section>
</template>

<script>
const rows = signal([]);

function buildData(count) {
  const data = [];
  for (let i = 0; i < count; i++) {
    data.push({ id: i + 1, label: "label " + i, trClass: "" });
  }
  return data;
}

function run() {
  rows.value = buildData(3);
}

function clearRows() {
  rows.value = [];
}
</script>
`;

function withDom(run: (document: Document) => void): void {
  const window = new Window();
  const doc = window.document;
  (globalThis as { document?: Document }).document = doc;
  try {
    run(doc);
  } finally {
    delete (globalThis as { document?: Document }).document;
  }
}

describe("client {#each} attach", () => {
  test("signal list updates tbody rows after hydrate attach", async () => {
    const routesDir = join(genRoot, "routes");
    await mkdir(routesDir, { recursive: true });
    const sfcPath = join(routesDir, "index.luxel");
    await writeFile(sfcPath, listClientSfc, "utf8");

    const route = await compileRoute(sfcPath, {
      routeId: "route:krausest",
      path: "/",
      source: "test/each-list-client/index.luxel",
      componentId: "sfc:krausest",
      slug: "krausest-client",
      genRoot,
    });

    await route.writeCacheFiles();

    expect(route.attachModuleSrc).toContain("reconcileNonKeyedList");
    expect(route.attachModuleSrc).toContain('"data-luxel-each", "rows"');

    const html = route.renderFromStore(new ResourceStore());
    expect(html).toContain('data-luxel-each="rows"');

    const clientMod = await import(
      join(genRoot, "client/routes/krausest-client.ts").replace(/\\/g, "/")
    );

    withDom((document) => {
      const bodyMatch = html.match(/<main[\s\S]*?<\/main>/i);
      document.body.innerHTML = bodyMatch?.[0] ?? html;
      const host = document.getElementsByTagName("section")[0] ?? null;
      expect(host).not.toBeNull();
      clientMod.setupBoundary({ data: {} }).attach(host!);

      const tbody = document.getElementsByTagName("tbody")[0] ?? null;
      expect(tbody?.getAttribute("data-luxel-each")).toBe("rows");
      expect(tbody?.children.length).toBe(0);

      document.getElementById("run")?.click();
      expect(tbody?.children.length).toBe(3);
      expect(tbody?.children[0]?.textContent).toContain("label 0");

      document.getElementById("clear")?.click();
      expect(tbody?.children.length).toBe(0);
    });
  });
});
