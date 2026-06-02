import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { compileCounterApp } from "../src/route/compile-app.ts";

const repoRoot = join(import.meta.dir, "../../..");

describe("SSR hardening", () => {
  test("escapes HTML in load data interpolated into the document", async () => {
    const app = await compileCounterApp(repoRoot);
    const route = app.getRoute("/");
    if (!route) throw new Error("missing /");
    const html = route.renderDocument({ message: '<img src=x onerror="alert(1)">' });
    expect(html).toContain("&lt;img");
    expect(html).not.toContain('<img src=x onerror="alert(1)">');
  });
});
