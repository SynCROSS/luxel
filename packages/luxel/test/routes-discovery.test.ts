import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { discoverRouteFiles } from "../src/routing/discover-routes.ts";

const repoRoot = join(import.meta.dir, "../../..");

describe("file route discovery", () => {
  test("discovers index and about routes in counter app", async () => {
    const routesDir = join(repoRoot, "examples/counter/src/routes");
    const routes = await discoverRouteFiles(routesDir);
    expect(routes.map((r) => r.slug).sort()).toEqual(["about", "index"]);
    expect(routes.find((r) => r.slug === "index")?.path).toBe("/");
    expect(routes.find((r) => r.slug === "about")?.path).toBe("/about");
  });
});
