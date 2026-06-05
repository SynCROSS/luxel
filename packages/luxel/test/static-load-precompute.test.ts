import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { compileCounterApp } from "../src/route/compile-app.ts";
import { inferStaticLoad } from "../src/compiler/infer-static-load.ts";

const repoRoot = join(import.meta.dir, "../../..");

describe("static load precompute", () => {
  test("counter load is static", () => {
    expect(
      inferStaticLoad(`
export async function load(ctx) {
  ctx.store.set("route:index:message", { message: "Hello Luxel" }, { tags: ["home"] });
}
`),
    ).toBe(true);
  });

  test("nav-demo load is not static", () => {
    expect(
      inferStaticLoad(`
export async function load(ctx) {
  if (ctx.store.isStale("key")) ctx.store.set("key", { headline: "A" }, { tags: ["nav"] });
}
`),
    ).toBe(false);
  });

  test("counter index route precomputes HTML at compile time", async () => {
    const app = await compileCounterApp(repoRoot);
    const index = app.getRoute("/");
    expect(index?.precomputedHtml).toBeString();
    expect(index?.precomputedData?.version).toBe(2);
    expect(index?.precomputedHtml).toContain("Hello Luxel");
  });
});
