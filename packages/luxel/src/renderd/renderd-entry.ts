import { Readable } from "node:stream";
import { getLuxelCoreNodeModule } from "../bench/ensure-core-node.ts";
import { createSpiralNativeDocumentRenderer } from "../luxel-core/native-route-document.ts";
import {
  decodeLuxelDataBeginPayload,
  decodeRenderdSpiralDocumentRequest,
  encodeLuxelDataResultFrame,
  encodeRenderdResponse,
  encodeRenderdResponseFrame,
  RENDERD_OP_LUXEL_DATA_BEGIN,
  RENDERD_OP_LUXEL_DATA_CHUNK,
  RENDERD_OP_LUXEL_DATA_FINISH,
  RENDERD_OP_RESPONSE_ERR,
  RENDERD_OP_RESPONSE_OK,
  RENDERD_OP_SHUTDOWN,
  RENDERD_OP_SPIRAL_DOCUMENT,
  type RenderdBinaryResponse,
  type RenderdLuxelDataResult,
} from "./binary-protocol.ts";
import {
  beginLuxelDataStream,
  cancelLuxelDataStream,
  finishLuxelDataStream,
  pushLuxelDataStreamChunk,
  resetLuxelDataStreamSession,
} from "./luxel-data-stream.ts";

export type RenderdHandleResult =
  | { kind: "silent" }
  | { kind: "shutdown" }
  | { kind: "html"; response: RenderdBinaryResponse }
  | { kind: "luxel-data"; result: RenderdLuxelDataResult };

export function renderSpiralBenchDocument(routePath: string, headStyle: string): string {
  const mod = getLuxelCoreNodeModule();
  if (!mod) {
    throw new Error("renderd requires loadable @luxel/core-node");
  }
  if (typeof mod.renderSpiralDocument === "function") {
    return (mod.renderSpiralDocument as () => string)();
  }
  const renderBody = mod.renderSpiralBody;
  if (typeof renderBody !== "function") {
    throw new Error("renderd missing renderSpiralBody");
  }
  const renderDoc = createSpiralNativeDocumentRenderer(routePath, headStyle);
  return renderDoc((renderBody as () => string)());
}

export function handleRenderdPayload(op: number, payload: Uint8Array): RenderdHandleResult {
  if (op === RENDERD_OP_SHUTDOWN) {
    cancelLuxelDataStream();
    return { kind: "shutdown" };
  }
  if (op === RENDERD_OP_LUXEL_DATA_BEGIN) {
    beginLuxelDataStream(decodeLuxelDataBeginPayload(payload));
    return { kind: "silent" };
  }
  if (op === RENDERD_OP_LUXEL_DATA_CHUNK) {
    pushLuxelDataStreamChunk(payload);
    return { kind: "silent" };
  }
  if (op === RENDERD_OP_LUXEL_DATA_FINISH) {
    try {
      const envelope = finishLuxelDataStream();
      return {
        kind: "luxel-data",
        result: { ok: true, resourceCount: Object.keys(envelope.resources).length },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      resetLuxelDataStreamSession();
      return { kind: "luxel-data", result: { ok: false, error: message } };
    }
  }
  if (op === RENDERD_OP_SPIRAL_DOCUMENT) {
    const { routePath, headStyle } = decodeRenderdSpiralDocumentRequest(payload);
    try {
      return { kind: "html", response: { ok: true, html: renderSpiralBenchDocument(routePath, headStyle) } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { kind: "html", response: { ok: false, error: message } };
    }
  }
  return { kind: "html", response: { ok: false, error: `unknown renderd op ${op}` } };
}

function defaultRenderdInput(): ReadableStream<Uint8Array> {
  if (typeof Bun !== "undefined") {
    return Bun.stdin.stream();
  }
  return Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;
}

function defaultRenderdOutput(): { write: (chunk: Uint8Array) => void } {
  return {
    write(chunk) {
      process.stdout.write(chunk);
    },
  };
}

export async function runRenderdBinaryLoop(
  input: ReadableStream<Uint8Array> = defaultRenderdInput(),
  output: { write: (chunk: Uint8Array) => void } = defaultRenderdOutput(),
): Promise<void> {
  const { decodeRenderdRequestFrame } = await import("./binary-protocol.ts");
  const reader = input.getReader();
  let buffer = new Uint8Array(0);
  try {
    while (true) {
      while (buffer.length >= 4) {
        const bodyLength = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint32(
          0,
          true,
        );
        const frameLength = 4 + bodyLength;
        if (buffer.length < frameLength) break;
        const frameBytes = buffer.slice(0, frameLength);
        buffer = buffer.slice(frameLength);
        const { op, payload } = decodeRenderdRequestFrame(frameBytes);
        const handled = handleRenderdPayload(op, payload);
        if (handled.kind === "silent") continue;
        if (handled.kind === "shutdown") {
          output.write(encodeRenderdResponseFrame({ ok: true, html: "" }));
          return;
        }
        if (handled.kind === "luxel-data") {
          output.write(encodeLuxelDataResultFrame(handled.result));
          continue;
        }
        output.write(encodeRenderdResponseFrame(handled.response));
      }
      const { done, value } = await reader.read();
      if (done) return;
      if (!value) continue;
      const merged = new Uint8Array(buffer.length + value.length);
      merged.set(buffer);
      merged.set(value, buffer.length);
      buffer = merged;
    }
  } finally {
    reader.releaseLock();
  }
}

if (import.meta.main) {
  void runRenderdBinaryLoop().finally(() => process.exit(0));
}
