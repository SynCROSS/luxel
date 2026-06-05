import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { compileCounterApp } from "../src/route/compile-app.ts";

describe("stability matrix enforcement", () => {
  test("manifest version stays 2", async () => {
    const repoRoot = join(import.meta.dir, "../../..");
    const app = await compileCounterApp(repoRoot);
    expect(app.manifest.version).toBe(2);
  });

  test("golden manifest contract frozen at version 2", async () => {
    const golden = JSON.parse(
      await readFile(join(import.meta.dir, "fixtures/contracts/manifest.json"), "utf8"),
    );
    expect(golden.version).toBe(2);
  });
});
