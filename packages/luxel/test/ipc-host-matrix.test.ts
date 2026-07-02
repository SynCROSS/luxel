import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { findDenoExecutable } from "../src/util/find-deno.ts";
import { requireNodeExecutable } from "../src/util/find-node.ts";
import { IPC_PROTOCOLS } from "../src/bench/ipc/types.ts";

const repoRoot = join(import.meta.dir, "../../..");
const nodeEntry = join(repoRoot, "packages/luxel/bin/luxel-node.mjs");
const denoEntry = join(repoRoot, "packages/luxel/bin/luxel-deno.ts");
const nodeBin = requireNodeExecutable();
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

function parseIpcLines(out: string): Array<{ runtime: string; protocol: string }> {
  return out
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { fixture: string; runtime: string; protocol: string })
    .filter((row) => row.fixture === "ipc");
}

describe("luxel bench --ipc host matrix", () => {
  test("luxel-node bench --ipc tags runtime node", () => {
    const result = spawnSync(nodeBin, [nodeEntry, "bench", "--ipc"], {
      cwd: join(repoRoot, "examples/counter"),
      encoding: "utf8",
      timeout: 180_000,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    const out = `${result.stderr}${result.stdout}`;
    expect(result.status).toBe(0);
    const lines = parseIpcLines(out);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((row) => row.runtime === "node")).toBe(true);
    expect(new Set(lines.map((row) => row.protocol)).size).toBe(IPC_PROTOCOLS.length);
  }, 180_000);

  test.skipIf(!deno)("luxel-deno bench --ipc tags runtime deno", () => {
    const result = spawnSync(deno!, [...denoPerms, denoEntry, "bench", "--ipc"], {
      cwd: join(repoRoot, "examples/counter"),
      encoding: "utf8",
      timeout: 180_000,
    });
    const out = `${result.stderr}${result.stdout}`;
    expect(result.status).toBe(0);
    const lines = parseIpcLines(out);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((row) => row.runtime === "deno")).toBe(true);
  }, 180_000);
});
