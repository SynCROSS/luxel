import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { resolveAppDir } from "../src/config/resolve-app.ts";

const repoRoot = join(import.meta.dir, "../../..");

describe("resolveAppDir", () => {
  test("defaults to counter from repo root", () => {
    expect(resolveAppDir(repoRoot, repoRoot)).toBe("examples/counter");
  });

  test("resolves nav-demo when cwd is the app directory", () => {
    expect(resolveAppDir(join(repoRoot, "examples/nav-demo"), repoRoot)).toBe(
      "examples/nav-demo",
    );
  });

  test("resolves standalone app root when luxel.config.ts is in cwd", () => {
    expect(resolveAppDir(join(repoRoot, "examples/counter"), join(repoRoot, "examples/counter"))).toBe(
      ".",
    );
  });
});
