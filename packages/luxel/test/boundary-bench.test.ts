import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runBoundaryBench, type BoundaryBenchLine } from "../src/bench/boundary.ts";

const repoRoot = join(import.meta.dir, "../../..");

function parseJsonLines(text: string): BoundaryBenchLine[] {
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as BoundaryBenchLine);
}

describe("luxel bench --boundary", () => {
  test("boundary bench emits runtime-scoped JSONL metrics", async () => {
    const lines: BoundaryBenchLine[] = [];
    for await (const line of runBoundaryBench()) {
      lines.push(line);
    }
    expect(lines.length).toBeGreaterThanOrEqual(4);
    for (const row of lines) {
      expect(row.fixture).toBe("boundary");
      expect(row.runtime).toBeString();
      expect(row.metric).toBeString();
      expect(typeof row.value).toBe("number");
      expect(row.value).toBeGreaterThan(0);
    }
    expect(lines.some((r) => r.metric === "json_roundtrip_p50_us")).toBe(true);
    expect(lines.some((r) => r.metric === "json_roundtrip_p95_us")).toBe(true);
    expect(lines.some((r) => r.metric === "json_serialized_bytes")).toBe(true);
  });

  test("CLI bench --boundary prints JSON lines", async () => {
    const proc = Bun.spawn(["bun", "packages/luxel/src/cli.ts", "bench", "--boundary"], {
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(code).toBe(0);
    expect(stderr).toBe("");
    const lines = parseJsonLines(stdout);
    expect(lines.every((r) => r.fixture === "boundary")).toBe(true);
  });
});
