import { describe, expect, test } from "bun:test";
import { buildApp } from "../src/build/build-app.ts";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { findDenoExecutable } from "../src/util/find-deno.ts";

const repoRoot = join(import.meta.dir, "../../..");

function resolveDeno(): string | null {
  const found = findDenoExecutable();
  if (found) return found;
  const onPath = spawnSync("deno", ["--version"], { encoding: "utf8" });
  return onPath.status === 0 ? "deno" : null;
}

const denoExe = resolveDeno();

describe.skipIf(!denoExe)("Deno serveLuxel", () => {
  test("serves built counter via dist/server/start-deno.mjs", async () => {
    const outDir = await buildApp(repoRoot, "examples/counter");
    const startScript = join(outDir, "server", "start-deno.mjs");
    const proc = Bun.spawn(
      [denoExe!, "run", "--allow-net", "--allow-read", "--allow-env", startScript],
      {
        cwd: join(outDir, "server"),
        env: { ...process.env, LUXEL_COMPRESS: "0", PORT: "0" },
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    let stdout = "";
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      stdout += decoder.decode(value);
      const line = stdout.split("\n").find((l) => l.includes("http://"));
      if (line) {
        const match = line.match(/http:\/\/[^\s]+/);
        if (match) {
          const res = await fetch(match[0]);
          expect(await res.text()).toContain("Hello Luxel");
          proc.kill();
          return;
        }
      }
    }
    proc.kill();
    throw new Error("deno server did not start");
  }, 60_000);
});
