import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runBenchRegistry, type BenchJsonLine } from "../src/bench/registry.ts";

const repoRoot = join(import.meta.dir, "../../..");

function parseJsonLines(text: string): BenchJsonLine[] {
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as BenchJsonLine);
}

describe("luxel bench JSON lines", () => {
  test("registry emits fixture, metric, value for counter", async () => {
    const lines: BenchJsonLine[] = [];
    for await (const line of runBenchRegistry({ skipInp: true })) {
      lines.push(line);
    }
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const row of lines) {
      expect(row.fixture).toBeString();
      expect(row.metric).toBeString();
      if ("status" in row) {
        expect(row.status).toBe("pending");
      } else {
        expect(typeof row.value).toBe("number");
      }
    }
    expect(lines.some((r) => r.fixture === "counter" && r.metric === "ssr_throughput_rps")).toBe(true);
    expect(lines.some((r) => r.fixture === "counter" && r.metric === "client_js_bytes")).toBe(true);
    expect(lines.some((r) => r.fixture === "table" && r.status === "pending")).toBe(true);
  });

  test("CLI bench command prints one JSON object per line", async () => {
    const proc = Bun.spawn(["bun", "packages/luxel/src/cli.ts", "bench"], {
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, LUXEL_BENCH_SKIP_INP: "1" },
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(code).toBe(0);
    expect(stderr).toBe("");
    const lines = parseJsonLines(stdout);
    expect(lines.some((r) => r.fixture === "counter")).toBe(true);
  });

  test("LUXEL_BENCH_OUT writes JSON lines file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "luxel-bench-"));
    const outPath = join(dir, "run.jsonl");
    const proc = Bun.spawn(["bun", "packages/luxel/src/cli.ts", "bench"], {
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, LUXEL_BENCH_OUT: outPath, LUXEL_BENCH_SKIP_INP: "1" },
    });
    const code = await proc.exited;
    expect(code).toBe(0);
    const file = await readFile(outPath, "utf8");
    const lines = parseJsonLines(file);
    expect(lines.some((r) => r.fixture === "docs-site")).toBe(true);
  });
});
