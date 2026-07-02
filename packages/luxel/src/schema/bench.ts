import type { LuxelDataV2 } from "../resource-store/luxel-data.ts";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { trustedLuxelDataV2SchemaFromBindings } from "./validate.ts";
import { createTrustedLuxelDataV2Parser } from "./stream-parser.ts";
import { createStreamingStringCache, streamCachedJsonStringChunks } from "./string-cache.ts";

export type SchemaStreamBenchLine = {
  fixture: "schema-stream";
  metric:
    | "ttfb_ms"
    | "chunk_gap_p99_ms"
    | "accepted_chunks"
    | "dropped_chunks"
    | "cache_hit_ratio_bytes"
    | "cache_hit_bytes"
    | "cache_miss_bytes";
  value: number;
};

function chunkJsonPayload(payload: LuxelDataV2, chunkSize: number): Uint8Array[] {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(bytes.slice(offset, offset + chunkSize));
  }
  return chunks;
}

export function buildLargeLuxelDataFixture(resourceCount: number): LuxelDataV2 {
  const resources: LuxelDataV2["resources"] = {};
  for (let i = 0; i < resourceCount; i++) {
    const key = `route:spiral:tile:${i}`;
    resources[key] = {
      value: { x: i, y: i * 2 },
      generation: 1,
      tags: ["spiral"],
      cache: {},
      stale: false,
    };
  }
  return { version: 2, resources };
}

export function* runTrustedSchemaStreamBench(
  resourceCount = 512,
  chunkSize = 128,
): Generator<SchemaStreamBenchLine> {
  const payload = buildLargeLuxelDataFixture(resourceCount);
  const keys = Object.keys(payload.resources);
  const schema = trustedLuxelDataV2SchemaFromBindings([], keys);
  const parser = createTrustedLuxelDataV2Parser(schema, { limits: { queueDepth: 8 } });
  const partialBytes: number[] = [];

  for (const chunk of chunkJsonPayload(payload, chunkSize)) {
    parser.push(chunk);
    partialBytes.push(chunk.byteLength);
  }

  const envelope = parser.finish();
  const metrics: StreamParseMetrics = parser.metrics();
  if (Object.keys(envelope.resources).length !== resourceCount) {
    throw new Error("schema stream bench envelope mismatch");
  }

  yield { fixture: "schema-stream", metric: "ttfb_ms", value: metrics.ttfbMs };
  yield { fixture: "schema-stream", metric: "chunk_gap_p99_ms", value: metrics.chunkGapP99Ms };
  yield { fixture: "schema-stream", metric: "accepted_chunks", value: metrics.acceptedChunks };
  yield { fixture: "schema-stream", metric: "dropped_chunks", value: metrics.droppedChunks };
}

export function* runSchemaStreamStringCacheBench(
  resourceCount = 128,
  chunkSize = 64,
): Generator<SchemaStreamBenchLine> {
  const payload = buildLargeLuxelDataFixture(resourceCount);
  const json = JSON.stringify(payload);
  const cache = createStreamingStringCache();
  streamCachedJsonStringChunks(json, cache, "route:spiral", chunkSize);
  const second = streamCachedJsonStringChunks(json, cache, "route:spiral", chunkSize);
  const metrics = second.metrics;
  yield { fixture: "schema-stream", metric: "cache_hit_ratio_bytes", value: metrics.hitRatioBytes };
  yield { fixture: "schema-stream", metric: "cache_hit_bytes", value: metrics.hitBytes };
  yield { fixture: "schema-stream", metric: "cache_miss_bytes", value: metrics.missBytes };
}

export type SchemaStreamBenchArtifactPaths = {
  jsonl: string;
  notes: string;
};

export async function writeSchemaStreamBenchArtifact(
  repoRoot: string,
  lines: SchemaStreamBenchLine[],
  options?: { outDir?: string },
): Promise<SchemaStreamBenchArtifactPaths> {
  const outDir = options?.outDir ?? join(repoRoot, "docs/benchmarks/runs");
  await mkdir(outDir, { recursive: true });
  const jsonlPath = join(outDir, "schema-stream-latest.jsonl");
  const notesPath = join(outDir, "schema-stream-notes.md");
  const jsonl = `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`;
  const notes = [
    "# Luxel-native trusted schema stream benchmark notes",
    "",
    "## Fixture",
    "",
    "Large `LuxelDataV2` JSON (512 spiral tile resources by default) chunked at 128 bytes.",
    "",
    "## Metrics",
    "",
    "- `ttfb_ms` — time from parser creation to first accepted chunk",
    "- `chunk_gap_p99_ms` — p99 inter-chunk arrival gap while pushing fixture chunks",
    "- `accepted_chunks` / `dropped_chunks` — queue window + `maxBytes` backpressure",
    "- `cache_hit_ratio_bytes` — byte hit ratio from streaming string cache on repeated luxel-data JSON",
    "",
    "## Trust boundary",
    "",
    "Single `JSON.parse` on `finish()`; `validateTrustedLuxelDataV2` projects compile-time schema keys into typed `LuxelDataV2` envelopes.",
    "",
  ].join("\n");
  await writeFile(jsonlPath, jsonl, "utf8");
  await writeFile(notesPath, notes, "utf8");
  return { jsonl: jsonlPath, notes: notesPath };
}
