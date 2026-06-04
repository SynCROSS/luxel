import { describe, expect, test } from "bun:test";
import { buildApp } from "../src/build/build-app.ts";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = join(import.meta.dir, "../../..");
const denoOnPath = spawnSync("deno", ["--version"], { encoding: "utf8" }).status === 0;

describe.skipIf(!denoOnPath)("Deno serveLuxel", () => {
  test("serves built counter via deno run", async () => {
    const outDir = await buildApp(repoRoot, "examples/counter");
    const script = `
import { serveLuxel } from ${JSON.stringify(join(import.meta.dir, "../src/deno/serve.ts"))};
const server = await serveLuxel({
  distDir: ${JSON.stringify(outDir)},
  compress: { enabled: false },
  useProductionCompress: false,
});
console.log(JSON.stringify({ url: server.url }));
await new Promise(() => {});
`;
    const proc = Bun.spawn(["deno", "run", "--allow-net", "--allow-read", "-"], {
      cwd: join(import.meta.dir, ".."),
      stdin: new TextEncoder().encode(script),
      stdout: "pipe",
      stderr: "pipe",
    });

    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    let stdout = "";
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      stdout += decoder.decode(value);
      const line = stdout.trim().split("\n").find((l) => l.startsWith("{"));
      if (line) {
        const { url } = JSON.parse(line) as { url: string };
        const res = await fetch(url);
        expect(await res.text()).toContain("Hello Luxel");
        proc.kill();
        return;
      }
    }
    proc.kill();
    throw new Error("deno server did not start");
  }, 60_000);
});
