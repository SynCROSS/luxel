import { describe, expect, test } from "bun:test";
import {
  buildLargeLuxelDataFixture,
  createTrustedLuxelDataV2Parser,
  parseLuxelDataV2Stream,
  runTrustedSchemaStreamBench,
  trustedLuxelDataV2SchemaFromBindings,
} from "../src/schema/index.ts";
import type { LuxelDataV2 } from "../src/resource-store/luxel-data.ts";
import { projectFromSnapshot } from "../src/resource-store/luxel-data.ts";

function chunkUtf8(text: string, size: number): Uint8Array[] {
  const bytes = new TextEncoder().encode(text);
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += size) {
    chunks.push(bytes.slice(offset, offset + size));
  }
  return chunks;
}

function streamFromChunks(chunks: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

const sampleEnvelope: LuxelDataV2 = {
  version: 2,
  resources: {
    "route:index:count": {
      value: { count: 0 },
      generation: 1,
      tags: ["counter"],
      cache: {},
      stale: false,
    },
  },
};

describe("trusted schema luxel-data v2 stream", () => {
  test("parseLuxelDataV2Stream parses chunked JSON once into typed envelope", async () => {
    const schema = trustedLuxelDataV2SchemaFromBindings(
      [{ templateId: "count", resourceKey: "route:index:count", field: "count" }],
    );
    const chunks = chunkUtf8(JSON.stringify(sampleEnvelope), 32);
    const { envelope, metrics } = await parseLuxelDataV2Stream(streamFromChunks(chunks), schema);

    expect(envelope).toEqual(sampleEnvelope);
    expect(metrics.acceptedChunks).toBe(chunks.length);
    expect(metrics.droppedChunks).toBe(0);
    expect(metrics.ttfbMs).toBeGreaterThanOrEqual(0);
  });

  test("bounded queue compacts fragment window before accepting more chunks", () => {
    const schema = trustedLuxelDataV2SchemaFromBindings([], ["route:index:count"]);
    const parser = createTrustedLuxelDataV2Parser(schema, { limits: { queueDepth: 2 } });
    const chunk = new TextEncoder().encode("{}");

    expect(parser.push(chunk).dropped).toBe(0);
    expect(parser.push(chunk).dropped).toBe(0);
    expect(parser.push(chunk).dropped).toBe(0);
    expect(parser.metrics().droppedChunks).toBe(0);
  });

  test("drops chunks when maxBytes exceeded", () => {
    const schema = trustedLuxelDataV2SchemaFromBindings([], ["route:index:count"]);
    const parser = createTrustedLuxelDataV2Parser(schema, { limits: { maxBytes: 4 } });
    const big = new TextEncoder().encode("12345");
    expect(parser.push(big).dropped).toBe(1);
    expect(parser.metrics().droppedChunks).toBe(1);
  });

  test("cancel aborts in-flight parser before finish", () => {
    const schema = trustedLuxelDataV2SchemaFromBindings([], ["route:index:count"]);
    const parser = createTrustedLuxelDataV2Parser(schema);
    parser.push(new TextEncoder().encode('{"version":2,"resources":{}}'));
    parser.cancel();
    expect(() => parser.finish()).toThrow(/cancelled/i);
    expect(parser.push(new Uint8Array(1)).dropped).toBe(1);
  });

  test("rejects untrusted resource keys from compile-time schema", () => {
    const schema = trustedLuxelDataV2SchemaFromBindings([], ["route:index:count"]);
    const parser = createTrustedLuxelDataV2Parser(schema);
    const bad = JSON.stringify({
      version: 2,
      resources: {
        "route:evil:payload": {
          value: {},
          generation: 1,
          tags: [],
          cache: {},
          stale: false,
        },
      },
    });
    parser.push(new TextEncoder().encode(bad));
    expect(() => parser.finish()).toThrow(/untrusted resource key/i);
  });

  test("onPartial surfaces incremental bytes before single parse finish", () => {
    const schema = trustedLuxelDataV2SchemaFromBindings([], ["route:index:count"]);
    const seen: number[] = [];
    const parser = createTrustedLuxelDataV2Parser(schema, {
      onPartial: (bytes) => seen.push(bytes.byteLength),
    });
    const chunks = chunkUtf8(JSON.stringify(sampleEnvelope), 16);
    for (const chunk of chunks) parser.push(chunk);
    expect(seen.length).toBe(chunks.length);
    expect(parser.finish()).toEqual(sampleEnvelope);
  });

  test("typed envelope projects to template data without re-serializing JSON", async () => {
    const bindings = [{ templateId: "count", resourceKey: "route:index:count", field: "count" }];
    const schema = trustedLuxelDataV2SchemaFromBindings(bindings);
    const chunks = chunkUtf8(JSON.stringify(sampleEnvelope), 32);
    const { envelope } = await parseLuxelDataV2Stream(streamFromChunks(chunks), schema);
    expect(projectFromSnapshot(envelope.resources, bindings)).toEqual({ count: 0 });
  });

  test("large fixture streams through trusted schema with bench metrics", () => {
    const lines = [...runTrustedSchemaStreamBench(256, 64)];
    expect(lines.some((line) => line.metric === "ttfb_ms")).toBe(true);
    expect(lines.some((line) => line.metric === "chunk_gap_p99_ms")).toBe(true);
    const payload = buildLargeLuxelDataFixture(256);
    expect(Object.keys(payload.resources)).toHaveLength(256);
  });
});
