import * as flatbuffers from "flatbuffers";
import type { IpcProtocolAdapter } from "../types.ts";
import { timeRoundtripUs } from "../stats.ts";

function encodeMessage(op: number, payload: Uint8Array): Uint8Array {
  const merged = new Uint8Array(1 + payload.length);
  merged[0] = op;
  merged.set(payload, 1);
  const builder = new flatbuffers.Builder(merged.length + 64);
  const dataOffset = builder.createByteVector(merged);
  builder.finish(dataOffset);
  return builder.asUint8Array();
}

function decodeMessage(bytes: Uint8Array): { op: number; payload: Uint8Array } {
  const bb = new flatbuffers.ByteBuffer(bytes);
  const vectorLoc = bb.readInt32(0);
  const len = bb.readInt32(vectorLoc);
  const start = vectorLoc + 4;
  const op = bb.readInt8(start);
  return { op, payload: bytes.slice(start + 1, start + len) };
}

function echoRoundtrip(op: number, payload: Uint8Array): Uint8Array {
  const request = decodeMessage(encodeMessage(op, payload));
  const response = decodeMessage(encodeMessage(2, request.payload));
  return response.payload;
}

function echoStream(chunks: readonly Uint8Array[]): Uint8Array {
  const parts = chunks.map((chunk) => decodeMessage(encodeMessage(3, chunk)).payload);
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }
  return merged;
}

export function createFlatbuffersIpcAdapter(): IpcProtocolAdapter {
  return {
    id: "flatbuffers",
    roundtripNull(iterations) {
      return timeRoundtripUs(() => {
        echoRoundtrip(0, new Uint8Array(0));
      }, iterations);
    },
    roundtripPayload(payload, iterations) {
      return timeRoundtripUs(() => {
        const out = echoRoundtrip(1, payload);
        if (out.length !== payload.length) throw new Error("flatbuffers ipc payload mismatch");
      }, iterations);
    },
    roundtripStream(chunks, iterations) {
      return timeRoundtripUs(() => {
        const merged = echoStream(chunks);
        const expected = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        if (merged.length !== expected) throw new Error("flatbuffers ipc stream mismatch");
      }, iterations);
    },
    roundtripConcurrent(payload, concurrency, iterations) {
      return timeRoundtripUs(() => {
        const results = Array.from({ length: concurrency }, () => echoRoundtrip(1, payload));
        if (results.some((result) => result.length !== payload.length)) {
          throw new Error("flatbuffers ipc concurrent mismatch");
        }
      }, iterations);
    },
    measureCancellation(inFlight) {
      let completed = 0;
      let aborted = 0;
      for (let i = 0; i < inFlight; i++) {
        const cancel = i % 2 === 0;
        const decoded = decodeMessage(encodeMessage(cancel ? 4 : 1, new Uint8Array(16)));
        if (decoded.op === 4) aborted += 1;
        else completed += 1;
      }
      return { completed, aborted };
    },
    measureBackpressure(queueDepth, burst) {
      const queue: Uint8Array[] = [];
      let accepted = 0;
      let dropped = 0;
      for (let i = 0; i < burst; i++) {
        const frame = encodeMessage(1, new Uint8Array(64));
        if (queue.length >= queueDepth) {
          dropped += 1;
          continue;
        }
        queue.push(frame);
        accepted += 1;
      }
      while (queue.length > 0) decodeMessage(queue.shift()!);
      return { accepted, dropped };
    },
  };
}
