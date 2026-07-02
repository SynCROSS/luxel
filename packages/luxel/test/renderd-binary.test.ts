import { beforeAll, describe, expect, test } from "bun:test";
import { ensureCoreNodeBuilt } from "./helpers/ensure-core-node.ts";
import {
  decodeRenderdResponseFrame,
  encodeRenderdRequestFrame,
  encodeRenderdSpiralDocumentRequest,
  encodeRenderdResponseFrame,
  RENDERD_OP_SPIRAL_DOCUMENT,
} from "../src/renderd/binary-protocol.ts";
import { handleRenderdPayload, runRenderdBinaryLoop } from "../src/renderd/renderd-entry.ts";
import { spiralTileCount } from "../src/bench/fixtures/spiral-html.ts";

const SPIRAL_HEAD_STYLE = `#wrapper { position: relative; width: 960px; height: 720px; }
.tile { position: absolute; width: 10px; height: 10px; background: #333; }`;

describe("renderd binary IPC", () => {
  beforeAll(() => ensureCoreNodeBuilt(), 300_000);

  test("spiral document request round-trips through handleRenderdPayload", () => {
    const request = encodeRenderdSpiralDocumentRequest("/", SPIRAL_HEAD_STYLE);
    const handled = handleRenderdPayload(RENDERD_OP_SPIRAL_DOCUMENT, request);
    expect(handled.kind).toBe("html");
    if (handled.kind !== "html") return;
    const frame = encodeRenderdResponseFrame(handled.response);
    const response = decodeRenderdResponseFrame(frame);
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.html).toContain('id="wrapper"');
    expect(response.html.match(/class="tile"/g)?.length).toBe(spiralTileCount());
  });

  test("runRenderdBinaryLoop accepts web ReadableStream stdin (node child path)", async () => {
    const request = encodeRenderdRequestFrame(
      RENDERD_OP_SPIRAL_DOCUMENT,
      encodeRenderdSpiralDocumentRequest("/", SPIRAL_HEAD_STYLE),
    );
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const outputs: Uint8Array[] = [];
    const loop = runRenderdBinaryLoop(readable, {
      write(chunk) {
        outputs.push(chunk);
      },
    });
    const writer = writable.getWriter();
    await writer.write(request);
    await writer.close();
    await loop;
    expect(outputs.length).toBeGreaterThan(0);
    const merged = new Uint8Array(outputs.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of outputs) {
      merged.set(part, offset);
      offset += part.length;
    }
    const response = decodeRenderdResponseFrame(merged);
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.html).toContain('id="wrapper"');
  });
});
