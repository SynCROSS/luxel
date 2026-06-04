import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { devApp } from "../src/dev/serve.ts";

const repoRoot = join(import.meta.dir, "../../..");

describe("devApp", () => {
  test("serves nav-demo index route", async () => {
    const server = await devApp(repoRoot, "examples/nav-demo", 0);
    try {
      const res = await fetch(server.url);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain(">A<");
    } finally {
      server.close();
    }
  });
});
