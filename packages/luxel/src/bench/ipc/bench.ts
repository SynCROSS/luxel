import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCapnpIpcAdapter } from "./protocols/capnp.ts";
import { createCustomIpcAdapter } from "./protocols/custom.ts";
import { createFlatbuffersIpcAdapter } from "./protocols/flatbuffers.ts";
import { makePayload } from "./payloads.ts";
import { benchIterations, detectBenchRuntime } from "./stats.ts";
import type { IpcBenchLine, IpcProtocol, IpcProtocolAdapter } from "./types.ts";
import { IPC_PAYLOAD_SIZES, IPC_PROTOCOLS } from "./types.ts";

function adapters(): IpcProtocolAdapter[] {
  return [createCustomIpcAdapter(), createFlatbuffersIpcAdapter(), createCapnpIpcAdapter()];
}

function* benchAdapter(runtime: IpcBenchLine["runtime"], adapter: IpcProtocolAdapter): Generator<IpcBenchLine> {
  const streamChunks = [makePayload(256, 1), makePayload(512, 2), makePayload(1024, 3)];

  yield {
    fixture: "ipc",
    runtime,
    protocol: adapter.id,
    metric: "null_roundtrip_p50_us",
    value: adapter.roundtripNull(benchIterations(0)),
  };

  for (const [label, size] of Object.entries(IPC_PAYLOAD_SIZES)) {
    const payload = makePayload(size, size);
    yield {
      fixture: "ipc",
      runtime,
      protocol: adapter.id,
      metric: `payload_${label}_roundtrip_p50_us`,
      value: adapter.roundtripPayload(payload, benchIterations(size)),
    };
  }

  yield {
    fixture: "ipc",
    runtime,
    protocol: adapter.id,
    metric: "stream_chunks_p50_us",
    value: adapter.roundtripStream(streamChunks, benchIterations(1024)),
  };

  yield {
    fixture: "ipc",
    runtime,
    protocol: adapter.id,
    metric: "concurrent_16_p50_us",
    value: adapter.roundtripConcurrent(makePayload(1024, 9), 16, 40),
  };

  const cancel = adapter.measureCancellation(32);
  yield {
    fixture: "ipc",
    runtime,
    protocol: adapter.id,
    metric: "cancel_aborted_count",
    value: cancel.aborted,
  };
  yield {
    fixture: "ipc",
    runtime,
    protocol: adapter.id,
    metric: "cancel_completed_count",
    value: cancel.completed,
  };

  const backpressure = adapter.measureBackpressure(8, 64);
  yield {
    fixture: "ipc",
    runtime,
    protocol: adapter.id,
    metric: "backpressure_dropped_count",
    value: backpressure.dropped,
  };
  yield {
    fixture: "ipc",
    runtime,
    protocol: adapter.id,
    metric: "backpressure_accepted_count",
    value: backpressure.accepted,
  };
}

export async function* runIpcBench(): AsyncGenerator<IpcBenchLine> {
  const runtime = detectBenchRuntime();
  for (const adapter of adapters()) {
    yield* benchAdapter(runtime, adapter);
  }
}

type ProtocolScore = {
  protocol: IpcProtocol;
  score: number;
};

function latencyMetrics(lines: IpcBenchLine[]): string[] {
  return lines
    .map((line) => line.metric)
    .filter((metric) => metric.endsWith("_p50_us"));
}

function scoreProtocol(lines: IpcBenchLine[], protocol: IpcProtocol): number {
  const latency = lines.filter(
    (line) => line.protocol === protocol && line.metric.endsWith("_p50_us"),
  );
  if (latency.length === 0) return Number.POSITIVE_INFINITY;
  const logSum = latency.reduce((sum, row) => sum + Math.log(Math.max(row.value, 1)), 0);
  return Math.exp(logSum / latency.length);
}

export function selectInterimIpcProtocol(lines: IpcBenchLine[]): ProtocolScore {
  const scores = IPC_PROTOCOLS.map((protocol) => ({
    protocol,
    score: scoreProtocol(lines, protocol),
  }));
  return scores.sort((a, b) => a.score - b.score)[0]!;
}

export type IpcBenchArtifactPaths = {
  jsonl: string;
  selection: string;
  notes: string;
};

export async function writeIpcBenchArtifact(
  repoRoot: string,
  lines: IpcBenchLine[],
  options?: { outDir?: string },
): Promise<IpcBenchArtifactPaths> {
  const outDir = options?.outDir ?? join(repoRoot, "docs/benchmarks/runs");
  await mkdir(outDir, { recursive: true });
  const jsonlPath = join(outDir, "ipc-latest.jsonl");
  const selectionPath = join(outDir, "ipc-selection.md");
  const notesPath = join(outDir, "ipc-notes.md");
  const winner = selectInterimIpcProtocol(lines);
  const runtime = lines[0]?.runtime ?? detectBenchRuntime();
  const jsonl = `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`;
  const selection = [
    "# Luxel-native IPC protocol selection (interim)",
    "",
    `Runtime sample: **${runtime}**`,
    "",
    "## Interim protocol selection",
    "",
    `**${winner.protocol}** — lowest geo-mean of measured p50 roundtrip metrics in this run.`,
    "",
    "Production `luxel-renderd` IPC is **not** shipped in this slice. JSON-lines (`renderd/protocol.ts`) remains prototype-only.",
    "",
    "## Follow-up criteria before locking production IPC",
    "",
    "- Re-run `luxel bench --ipc` on Bun, Node, and Deno; merge rows by `runtime`.",
    "- Confirm Cap'n Proto numbers use segment-framed wire bytes representative of real schema RPC.",
    "- Confirm FlatBuffers numbers use table root + byte vector field matching planned renderd envelope.",
    "- Validate cancellation + backpressure under real socket transport (not in-process encode/decode only).",
    "- If custom binary wins on all three runtimes with <10% spread, skip Cap'n Proto/codegen complexity.",
    "",
    "## Compared protocols",
    "",
    ...IPC_PROTOCOLS.map((protocol) => `- \`${protocol}\``),
    "",
    "## Metrics captured",
    "",
    ...latencyMetrics(lines)
      .filter((metric, index, all) => all.indexOf(metric) === index)
      .map((metric) => `- \`${metric}\``),
    "",
    "- `cancel_*_count` — simulated in-flight cancel op handling (see ipc-notes.md)",
    "- `backpressure_*_count` — bounded queue drop simulation (see ipc-notes.md)",
    "",
  ].join("\n");
  const notes = [
    "# Luxel-native IPC benchmark notes",
    "",
    "## Cancellation",
    "",
    "Bench sends alternating request/cancel ops through each codec. `cancel_aborted_count` is how many cancel ops decoded successfully in a burst of 32 messages. Real transport must propagate cancel without completing work.",
    "",
    "## Backpressure",
    "",
    "Bench fills a fixed-depth queue (depth 8) with 64 messages. `backpressure_dropped_count` counts messages rejected when the queue is full. Production renderd should apply the same bound to in-flight bytes/messages.",
    "",
    "## JSON-lines prototype",
    "",
    "`packages/luxel/src/renderd/protocol.ts` newline JSON remains **prototype-only** and is excluded from this harness.",
    "",
  ].join("\n");
  await writeFile(jsonlPath, jsonl, "utf8");
  await writeFile(selectionPath, selection, "utf8");
  await writeFile(notesPath, notes, "utf8");
  return { jsonl: jsonlPath, selection: selectionPath, notes: notesPath };
}
