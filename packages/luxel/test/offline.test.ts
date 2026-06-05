import { describe, expect, test } from "bun:test";
import { compileNavDemoApp } from "../src/route/compile-app.ts";
import { compileCounterApp } from "../src/route/compile-app.ts";
import { join } from "node:path";

describe("offline manifest", () => {
  test("infers static for SSG, stale for ISR default, none for SSR", async () => {
    const repoRoot = join(import.meta.dir, "../../..");
    const counter = await compileCounterApp(repoRoot);
    const about = counter.routes.find((r) => r.path === "/about")!;
    expect(about.offline).toBe("static");

    const nav = await compileNavDemoApp(repoRoot);
    const detail = nav.routes.find((r) => r.path === "/detail")!;
    const account = nav.routes.find((r) => r.path === "/account")!;
    expect(detail.offline).toBe("none");
    expect(account.offline).toBe("none");
  });

  test("author override offline export on ISR route", async () => {
    const repoRoot = join(import.meta.dir, "../../..");
    const app = await compileNavDemoApp(repoRoot);
    const index = app.routes.find((r) => r.path === "/")!;
    expect(index.mode).toBe("isr");
    expect(index.offline).toBe("none");
  });
});
