import { describe, expect, test, beforeAll } from "bun:test";
import { buildApp } from "../src/build/build-app.ts";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";

const repoRoot = join(import.meta.dir, "../../..");
const runnerSource = join(import.meta.dir, "fixtures/node-serve-entry.ts");
const runnerBundle = join(import.meta.dir, "fixtures/node-serve-runner.mjs");

beforeAll(async () => {
  const result = await Bun.build({
    entrypoints: [runnerSource],
    target: "node",
    format: "esm",
  });
  if (!result.success) {
    throw new Error(result.logs.map((l) => l.message).join("\n"));
  }
  await writeFile(runnerBundle, await result.outputs[0]!.text(), "utf8");
});

describe("nav-demo Node deploy", () => {
  test("serves luxel-data resource snapshot on Node", async () => {
    const outDir = await buildApp(repoRoot, "examples/nav-demo");
    const proc = spawn(process.execPath, [runnerBundle], {
      env: { ...process.env, LUXEL_DIST_DIR: outDir, LUXEL_COMPRESS: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const url = await new Promise<string>((resolve, reject) => {
      let stdout = "";
      proc.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
        const line = stdout.trim().split("\n").find((l) => l.startsWith("{"));
        if (!line) return;
        try {
          resolve((JSON.parse(line) as { url: string }).url);
        } catch {
          /* wait */
        }
      });
      proc.stderr?.on("data", (c) => reject(new Error(c.toString())));
      proc.on("error", reject);
    });

    try {
      const res = await fetch(url);
      const html = await res.text();
      expect(html).toContain('id="luxel-data"');
      expect(html).toContain('"headline":"A"');
    } finally {
      proc.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 500));
      if (!proc.killed) proc.kill("SIGKILL");
    }
  }, 90_000);
});
