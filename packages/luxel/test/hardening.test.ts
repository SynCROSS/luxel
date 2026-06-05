import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { compileCounterApp } from "../src/route/compile-app.ts";
import { createLoadContext } from "../src/resource-store/load-context.ts";
import { ResourceStore } from "../src/resource-store/store.ts";

const repoRoot = join(import.meta.dir, "../../..");

describe("SSR hardening", () => {
  test("escapes HTML in load data interpolated into the document", async () => {
    const app = await compileCounterApp(repoRoot);
    const route = app.getRoute("/");
    if (!route) throw new Error("missing /");
    const store = new ResourceStore();
    const ctx = createLoadContext(store);
    await route.load(ctx);
    store.set("route:index:message", { message: '<img src=x onerror="alert(1)">' }, { tags: ["home"] });
    const html = route.renderFromStore(store);
    expect(html).toContain("&lt;img");
    expect(html).not.toContain('<img src=x onerror="alert(1)">');
  });
});
