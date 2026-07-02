import { beforeAll, describe, expect, test } from "bun:test";
import { buildLargeLuxelDataFixture } from "../src/schema/bench.ts";
import { LUXEL_DATA_VERSION } from "../src/resource-store/luxel-data.ts";
import {
  decodeLuxelDataResultFrame,
  encodeLuxelDataBeginPayload,
  encodeRenderdRequestFrame,
  RENDERD_OP_LUXEL_DATA_BEGIN,
  RENDERD_OP_LUXEL_DATA_CHUNK,
  RENDERD_OP_LUXEL_DATA_FINISH,
} from "../src/renderd/binary-protocol.ts";
import { handleRenderdPayload, runRenderdBinaryLoop } from "../src/renderd/renderd-entry.ts";
import { createRenderdClient } from "../src/renderd/client.ts";
import { ensureCoreNodeBuilt } from "./helpers/ensure-core-node.ts";

function chunkUtf8(text: string, size: number): Uint8Array[] {
  const bytes = new TextEncoder().encode(text);
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += size) {
    chunks.push(bytes.slice(offset, offset + size));
  }
  return chunks;
}

describe("renderd trusted luxel-data stream", () => {
  beforeAll(() => ensureCoreNodeBuilt(), 300_000);

  test("handleRenderdPayload parses chunked luxel-data once at trust boundary", () => {
    const envelope = buildLargeLuxelDataFixture(32);
    const keys = Object.keys(envelope.resources);
    const begin = handleRenderdPayload(RENDERD_OP_LUXEL_DATA_BEGIN, encodeLuxelDataBeginPayload(keys));
    expect(begin.kind).toBe("silent");
    for (const chunk of chunkUtf8(JSON.stringify(envelope), 64)) {
      const pushed = handleRenderdPayload(RENDERD_OP_LUXEL_DATA_CHUNK, chunk);
      expect(pushed.kind).toBe("silent");
    }
    const finished = handleRenderdPayload(RENDERD_OP_LUXEL_DATA_FINISH, new Uint8Array(0));
    expect(finished.kind).toBe("luxel-data");
    if (finished.kind !== "luxel-data") return;
    expect(finished.result.ok).toBe(true);
    if (!finished.result.ok) return;
    expect(finished.result.resourceCount).toBe(32);
  });

  test("renderd client streams luxel-data envelope through child parser", async () => {
    const envelope = {
      version: LUXEL_DATA_VERSION,
      resources: {
        "route:index:count": {
          value: { count: 3 },
          generation: 1,
          tags: ["counter"],
          cache: {},
          stale: false,
        },
      },
    };
    const client = await createRenderdClient();
    try {
      const count = await client.streamLuxelData(envelope, 16);
      expect(count).toBe(1);
    } finally {
      await client.close();
    }
  }, 180_000);

  test("runRenderdBinaryLoop returns luxel-data result frame on finish", async () => {
    const envelope = buildLargeLuxelDataFixture(8);
    const keys = Object.keys(envelope.resources);
    const frames = [
      encodeRenderdRequestFrame(RENDERD_OP_LUXEL_DATA_BEGIN, encodeLuxelDataBeginPayload(keys)),
      ...chunkUtf8(JSON.stringify(envelope), 48).map((chunk) =>
        encodeRenderdRequestFrame(RENDERD_OP_LUXEL_DATA_CHUNK, chunk),
      ),
      encodeRenderdRequestFrame(RENDERD_OP_LUXEL_DATA_FINISH, new Uint8Array(0)),
    ];
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const outputs: Uint8Array[] = [];
    const loop = runRenderdBinaryLoop(readable, {
      write(chunk) {
        outputs.push(chunk);
      },
    });
    const writer = writable.getWriter();
    for (const frame of frames) await writer.write(frame);
    await writer.close();
    await loop;
    expect(outputs.length).toBe(1);
    const result = decodeLuxelDataResultFrame(outputs[0]!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resourceCount).toBe(8);
  });
});
