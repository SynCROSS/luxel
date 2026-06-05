import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { esbuildBackend } from "../src/host/backends/esbuild-backend.ts";

describe("esbuild bundle backend", () => {
  test("bundles TS entry to in-memory ESM", async () => {
    const root = await mkdtemp(join(tmpdir(), "luxel-esbuild-"));
    try {
      const entry = join(root, "entry.ts");
      await writeFile(entry, `export const answer = 42;\n`, "utf8");

      const { outputs } = await esbuildBackend.bundle([entry], {
        root,
        platform: "browser",
        write: false,
      });

      expect(outputs).toHaveLength(1);
      expect(outputs[0]!.text).toContain("42");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("writes bundled output to outfile on disk", async () => {
    const root = await mkdtemp(join(tmpdir(), "luxel-esbuild-"));
    try {
      const entry = join(root, "entry.ts");
      const outfile = join(root, "out.mjs");
      await writeFile(entry, `export function hi() { return "luxel"; }\n`, "utf8");

      await esbuildBackend.bundle([entry], {
        root,
        platform: "node",
        outfile,
      });

      const js = await readFile(outfile, "utf8");
      expect(js).toContain("luxel");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
