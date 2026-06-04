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

function spawnNodeServer(distDir: string, compress: boolean): Promise<{ url: string; proc: ReturnType<typeof spawn> }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [runnerBundle], {
      env: {
        ...process.env,
        LUXEL_DIST_DIR: distDir,
        LUXEL_COMPRESS: compress ? "1" : "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    proc.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
      const line = stdout.trim().split("\n").find((l) => l.startsWith("{"));
      if (!line) return;
      try {
        const { url } = JSON.parse(line) as { url: string };
        resolve({ url, proc });
      } catch {
        /* wait for full JSON line */
      }
    });

    proc.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      if (text.includes("Error")) reject(new Error(text));
    });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code !== null && code !== 0 && !stdout.includes("{")) {
        reject(new Error(`node serve exited with ${code}`));
      }
    });
  });
}

async function stopNode(proc: ReturnType<typeof spawn>): Promise<void> {
  if (!proc.killed) proc.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    proc.on("exit", () => resolve());
    setTimeout(() => {
      if (!proc.killed) proc.kill("SIGKILL");
      resolve();
    }, 3000);
  });
}

describe("Node serveLuxel", () => {
  test("serves built counter without Bun on server", async () => {
    const outDir = await buildApp(repoRoot, "examples/counter");
    const { url, proc } = await spawnNodeServer(outDir, false);
    try {
      const res = await fetch(url);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("Hello Luxel");
    } finally {
      await stopNode(proc);
    }
  }, 60_000);

  test("gzip-compresses when enabled on Node deploy path", async () => {
    const outDir = await buildApp(repoRoot, "examples/counter");
    const { url, proc } = await spawnNodeServer(outDir, true);
    try {
      const res = await fetch(url, { headers: { "accept-encoding": "gzip" } });
      expect(res.headers.get("content-encoding")).toBe("gzip");
      expect(await res.text()).toContain("Hello Luxel");
    } finally {
      await stopNode(proc);
    }
  }, 60_000);
});
