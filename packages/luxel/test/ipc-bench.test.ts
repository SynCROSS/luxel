import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { runIpcBench, type IpcBenchLine, writeIpcBenchArtifact } from "../src/bench/ipc/bench.ts";
import { IPC_PROTOCOLS, IPC_PAYLOAD_METRICS } from "../src/bench/ipc/types.ts";

const repoRoot = join(import.meta.dir, "../../..");

function parseJsonLines(text: string): IpcBenchLine[] {
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as IpcBenchLine);
}

describe("luxel bench --ipc", () => {
  test("ipc bench emits runtime-scoped JSONL for all protocols", async () => {
    const lines: IpcBenchLine[] = [];
    for await (const line of runIpcBench()) {
      lines.push(line);
    }
    expect(lines.length).toBeGreaterThan(0);
    for (const protocol of IPC_PROTOCOLS) {
      const protocolRows = lines.filter((row) => row.protocol === protocol);
      expect(protocolRows.length).toBeGreaterThan(0);
      expect(protocolRows.every((row) => row.fixture === "ipc")).toBe(true);
      expect(protocolRows.every((row) => row.runtime === "bun")).toBe(true);
      expect(protocolRows.some((row) => row.metric === "null_roundtrip_p50_us")).toBe(true);
      for (const metric of IPC_PAYLOAD_METRICS) {
        expect(protocolRows.some((row) => row.metric === metric)).toBe(true);
      }
      expect(protocolRows.some((row) => row.metric === "stream_chunks_p50_us")).toBe(true);
      expect(protocolRows.some((row) => row.metric === "concurrent_16_p50_us")).toBe(true);
      expect(protocolRows.some((row) => row.metric === "cancel_aborted_count")).toBe(true);
      expect(protocolRows.some((row) => row.metric === "backpressure_dropped_count")).toBe(true);
    }
  });

  test("writeIpcBenchArtifact publishes comparison and selection record", async () => {
    const lines: IpcBenchLine[] = [];
    for await (const line of runIpcBench()) {
      lines.push(line);
    }
    const outDir = join(repoRoot, "packages/luxel/test/.tmp-ipc-artifact");
    const paths = await writeIpcBenchArtifact(repoRoot, lines, { outDir });
    const jsonl = await readFile(paths.jsonl, "utf8");
    const selection = await readFile(paths.selection, "utf8");
    expect(parseJsonLines(jsonl).length).toBe(lines.length);
    expect(selection).toContain("Interim protocol selection");
    expect(selection).toMatch(/custom|flatbuffers|capnp/);
    expect(paths.notes).toBeDefined();
    const notes = await readFile(paths.notes!, "utf8");
    expect(notes).toContain("Cancellation");
    expect(notes).toContain("Backpressure");
  });

  test("CLI bench --ipc prints JSON lines", async () => {
    const proc = Bun.spawn(["bun", "packages/luxel/src/cli.ts", "bench", "--ipc"], {
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
    expect(lines.every((r) => r.fixture === "ipc")).toBe(true);
    expect(new Set(lines.map((r) => r.protocol)).size).toBe(IPC_PROTOCOLS.length);
  });
});
