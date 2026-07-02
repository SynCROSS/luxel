import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { findDenoExecutable } from "../src/util/find-deno.ts";
import { requireNodeExecutable } from "../src/util/find-node.ts";

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

function parseBoundaryLines(out: string): Array<{ runtime: string; metric: string }> {
  return out
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { fixture: string; runtime: string; metric: string })
    .filter((row) => row.fixture === "boundary");
}

describe("luxel bench --boundary host matrix", () => {
  test("luxel-node bench --boundary tags runtime node", () => {
    const result = spawnSync(nodeBin, [nodeEntry, "bench", "--boundary"], {
      cwd: join(repoRoot, "examples/counter"),
      encoding: "utf8",
      timeout: 120_000,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    const out = `${result.stderr}${result.stdout}`;
    expect(result.status).toBe(0);
    const lines = parseBoundaryLines(out);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((row) => row.runtime === "node")).toBe(true);
    expect(lines.some((row) => row.metric === "json_roundtrip_p50_us")).toBe(true);
  }, 120_000);

  test.skipIf(!deno)("luxel-deno bench --boundary tags runtime deno", () => {
    const result = spawnSync(deno!, [...denoPerms, denoEntry, "bench", "--boundary"], {
      cwd: join(repoRoot, "examples/counter"),
      encoding: "utf8",
      timeout: 120_000,
    });
    const out = `${result.stderr}${result.stdout}`;
    expect(result.status).toBe(0);
    const lines = parseBoundaryLines(out);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((row) => row.runtime === "deno")).toBe(true);
  }, 120_000);
});
