import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { findDenoExecutable } from "../src/util/find-deno.ts";
import { runNativeHost } from "../src/host/native-host.ts";

const repoRoot = join(import.meta.dir, "../../..");
const denoEntry = join(repoRoot, "packages/luxel/bin/luxel-deno.ts");
const deno = findDenoExecutable();

const denoPerms = [
  "run",
  "--allow-read",
  "--allow-env",
  "--allow-write",
  "--allow-net",
  "--allow-run",
  "--allow-sys",
];

describe.serial.skipIf(!deno)("v1.1 native toolchain host (deno)", () => {
  test("native-host build succeeds with esbuild backend", async () => {
    expect(await runNativeHost("deno", ["build"], repoRoot)).toBe(0);
  }, 120_000);

  test("native-host bench succeeds with esbuild backend", async () => {
    expect(
      await runNativeHost("deno", ["bench"], repoRoot, {
        pkgSrc: join(repoRoot, "packages/luxel/src"),
      }),
    ).toBe(0);
  }, 180_000);

  test("luxel-deno.ts bench emits metrics without Bun bridge", () => {
    const result = spawnSync(deno!, [...denoPerms, denoEntry, "bench"], {
      cwd: join(repoRoot, "examples/counter"),
      encoding: "utf8",
      timeout: 180_000,
      env: { ...process.env, LUXEL_BENCH_SKIP_INP: "1" },
    });
    const out = `${result.stderr}${result.stdout}`;
    expect(result.status).toBe(0);
    expect(out).toContain('"fixture":"counter"');
    expect(out).not.toContain("luxel-host");
  }, 180_000);

  test("luxel-deno.ts dev serves counter without Bun bridge", async () => {
    const counterDir = join(repoRoot, "examples/counter");
    const child = spawn(deno!, [...denoPerms, denoEntry, "dev"], {
      cwd: counterDir,
      env: { ...process.env, PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const ready = await new Promise<string>((resolve, reject) => {
      let buf = "";
      const timer = setTimeout(() => reject(new Error("dev server timeout")), 60_000);
      const onData = (chunk: Buffer) => {
        buf += chunk.toString();
        const match = buf.match(/luxel dev (http:\/\/[^\s]+)/);
        if (match) {
          clearTimeout(timer);
          resolve(match[1]!);
        }
      };
      child.stdout?.on("data", onData);
      child.stderr?.on("data", onData);
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
  }, 120_000);

  test("luxel-deno.ts serve deno serves built counter", async () => {
    const counterDir = join(repoRoot, "examples/counter");
    const build = spawnSync(deno!, [...denoPerms, denoEntry, "build"], {
      cwd: counterDir,
      encoding: "utf8",
      timeout: 120_000,
    });
    expect(build.status).toBe(0);

    const child = spawn(deno!, [...denoPerms, denoEntry, "serve", "deno"], {
      cwd: counterDir,
      env: { ...process.env, PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const ready = await new Promise<string>((resolve, reject) => {
      let buf = "";
      const timer = setTimeout(() => reject(new Error("serve timeout")), 60_000);
      const onData = (chunk: Buffer) => {
        buf += chunk.toString();
        const match = buf.match(/luxel \(deno\): (http:\/\/[^\s]+)/);
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
  }, 180_000);
});
