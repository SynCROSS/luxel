import { describe, expect, test } from "bun:test";
import * as esbuild from "esbuild";
import { mkdir } from "node:fs/promises";
import { stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { runNativeHost } from "../src/host/native-host.ts";

const repoRoot = join(import.meta.dir, "../../..");
const nodeEntry = join(repoRoot, "packages/luxel/bin/luxel-node.mjs");
/** Native host tests must invoke Node, not the Bun test runner binary. */
const nodeBin = "node";

describe.serial("v1.1 native toolchain host (node)", () => {
  test("native-host build succeeds with esbuild backend", async () => {
    const code = await runNativeHost("node", ["build"], repoRoot);
    expect(code).toBe(0);
  });

  test(
    "native-host bench emits counter metrics",
    async () => {
    const buildHost = spawnSync(nodeBin, [join(repoRoot, "packages/luxel/scripts/build-node-host.mjs")], {
      cwd: join(repoRoot, "packages/luxel"),
      encoding: "utf8",
      timeout: 120_000,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    expect(buildHost.status).toBe(0);

    const result = spawnSync(nodeBin, [nodeEntry, "bench"], {
      cwd: join(repoRoot, "examples/counter"),
      encoding: "utf8",
      timeout: 180_000,
      env: {
        ...process.env,
        NODE_NO_WARNINGS: "1",
        LUXEL_BENCH_SKIP_INP: "1",
        LUXEL_BENCH_SKIP_SPIRAL: "1",
      },
    });
    const out = `${result.stderr}${result.stdout}`;
    expect(result.status).toBe(0);
    expect(out).toContain('"fixture":"counter"');
    expect(out).toContain('"type":"bench_gate"');
    expect(out).not.toContain("luxel-host");
    },
    180_000,
  );

  test("luxel-node.mjs build emits counter dist without Bun bridge", () => {
    const result = spawnSync(nodeBin, [nodeEntry, "build"], {
      cwd: join(repoRoot, "examples/counter"),
      encoding: "utf8",
      timeout: 120_000,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    const out = `${result.stderr}${result.stdout}`;
    expect(result.status).toBe(0);
    expect(out).toContain("built");
    expect(out).toContain("[esbuild]");
    expect(out).not.toContain("luxel-host");
  });

  test("luxel-node.mjs dev serves counter without Bun bridge", async () => {
    const counterDir = join(repoRoot, "examples/counter");
    const child = spawn(nodeBin, [nodeEntry, "dev"], {
      cwd: counterDir,
      env: { ...process.env, PORT: "0", NODE_NO_WARNINGS: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const ready = await new Promise<string>((resolve, reject) => {
      let buf = "";
      const timer = setTimeout(() => reject(new Error("dev server timeout")), 60_000);
      child.stdout?.on("data", (chunk: Buffer) => {
        buf += chunk.toString();
        const match = buf.match(/luxel dev (http:\/\/[^\s]+)/);
        if (match) {
          clearTimeout(timer);
          resolve(match[1]!);
        }
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        buf += chunk.toString();
      });
      child.on("error", reject);
      child.on("exit", (code) => {
        if (code !== null && code !== 0) reject(new Error(`dev exited ${code}: ${buf}`));
      });
    });
    try {
      const res = await fetch(ready);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("Hello Luxel");
    } finally {
      child.kill();
    }
  });

  test("luxel-node.mjs serve node serves built counter", async () => {
    const counterDir = join(repoRoot, "examples/counter");
    const build = spawnSync(nodeBin, [nodeEntry, "build"], {
      cwd: counterDir,
      encoding: "utf8",
      timeout: 120_000,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    expect(build.status).toBe(0);

    const child = spawn(nodeBin, [nodeEntry, "serve", "node"], {
      cwd: counterDir,
      env: { ...process.env, PORT: "0", NODE_NO_WARNINGS: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const ready = await new Promise<string>((resolve, reject) => {
      let buf = "";
      const timer = setTimeout(() => reject(new Error("serve timeout")), 60_000);
      const onData = (chunk: Buffer) => {
        buf += chunk.toString();
        const match = buf.match(/luxel \(node\): (http:\/\/[^\s]+)/);
        if (match) {
          clearTimeout(timer);
          resolve(match[1]!);
        }
      };
      child.stdout?.on("data", onData);
      child.stderr?.on("data", onData);
      child.on("error", reject);
      child.on("exit", (code) => {
        if (code !== null && code !== 0) reject(new Error(`serve exited ${code}: ${buf}`));
      });
    });
    try {
      const res = await fetch(ready);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("Hello Luxel");
    } finally {
      child.kill();
    }
  });

  test("luxel-node.mjs uses prebuilt host bundle when dist/host/run.mjs exists", async () => {
    const buildHost = spawnSync(nodeBin, [join(repoRoot, "packages/luxel/scripts/build-node-host.mjs")], {
      cwd: join(repoRoot, "packages/luxel"),
      encoding: "utf8",
      timeout: 120_000,
    });
    expect(buildHost.status).toBe(0);

    const stamp = join(repoRoot, "packages/luxel/.cache/node-host/stamp.txt");
    try {
      await unlink(stamp);
    } catch {
      // absent ok
    }

    const result = spawnSync(nodeBin, [nodeEntry, "build"], {
      cwd: join(repoRoot, "examples/counter"),
      encoding: "utf8",
      timeout: 120_000,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    expect(result.status).toBe(0);

    await expect(stat(stamp)).rejects.toThrow();
  });

  test("loadLuxelConfig works under Node via esbuild config fallback", async () => {
    const cacheDir = join(repoRoot, "packages/luxel/.cache");
    await mkdir(cacheDir, { recursive: true });
    const probePath = join(cacheDir, "config-load-probe.mjs");
    const entry = join(repoRoot, "packages/luxel/scripts/config-load-probe-entry.ts");
    const built = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: probePath,
      packages: "external",
      logLevel: "silent",
    });
    expect(built.errors).toHaveLength(0);

    const result = spawnSync(
      nodeBin,
      [probePath, join(repoRoot, "examples/counter")],
      { encoding: "utf8", timeout: 30_000, env: { ...process.env, NODE_NO_WARNINGS: "1" } },
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout.trim())).toEqual({
      root: ".",
      routesDir: "src/routes",
      outDir: "dist",
    });
  });
});
