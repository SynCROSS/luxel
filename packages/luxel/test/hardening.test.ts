import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { compileCounterApp } from "../src/route/compile-app.ts";
import { createLoadContext } from "../src/resource-store/load-context.ts";
import { codegenSsrDocumentFromBody } from "../src/compiler/codegen-ssr.ts";
import { serializeLuxelData } from "../src/resource-store/luxel-data.ts";
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

  test("escapes luxel-data JSON for script raw-text context", () => {
    const json = serializeLuxelData({
      "route:index:message": {
        value: { message: "</script><script>alert(1)</script>" },
        tags: [],
      },
    });
    expect(json).not.toContain("</script>");
    expect(JSON.parse(json).resources["route:index:message"]?.value).toEqual({
      message: "</script><script>alert(1)</script>",
    });
  });

  test("escapes luxel-data U+2028 and U+2029 for script raw-text context", () => {
    const payload = "\u2028line\u2029break";
    const json = serializeLuxelData({
      "route:index:message": {
        value: { message: payload },
        tags: [],
      },
    });
    expect(json).not.toContain("\u2028");
    expect(json).not.toContain("\u2029");
    expect(JSON.parse(json).resources["route:index:message"]?.value).toEqual({
      message: payload,
    });
  });

  test("escapes luxel-hydration JSON for script raw-text context", () => {
    const evilId = '</script><script>alert(1)</script>';
    const html = codegenSsrDocumentFromBody(
      "<p>x</p>",
      {},
      {
        routePath: "/",
        routeId: evilId,
        clientModule: "client/routes/index.js",
        shipDataSidecar: false,
        shipHydrationSidecar: true,
        shipClientRuntime: false,
      },
      [{ templateId: evilId, resourceKey: "k", field: "f" }],
      [evilId],
    );
    expect(html).not.toContain("</script><script>");
    const match = html.match(/id="luxel-hydration">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1]!);
    expect(parsed.routeId).toBe(evilId);
    expect(parsed.bindings[0]?.templateId).toBe(evilId);
    expect(parsed.boundaries[0]?.id).toBe(evilId);
  });
});
