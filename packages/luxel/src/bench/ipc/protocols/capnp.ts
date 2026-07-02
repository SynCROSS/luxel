import type { IpcProtocolAdapter } from "../types.ts";
import { timeRoundtripUs } from "../stats.ts";

function encodeCapnpSegmented(op: number, payload: Uint8Array): Uint8Array {
  const body = new Uint8Array(1 + 4 + payload.length);
  body[0] = op;
  new DataView(body.buffer).setUint32(1, payload.length, true);
  body.set(payload, 5);
  const segmentSizeWords = Math.max(1, Math.ceil(body.length / 8));
  const totalWords = 2 + segmentSizeWords;
  const out = new Uint8Array(totalWords * 8);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0, true);
  view.setUint32(4, 0, true);
  view.setUint32(8, segmentSizeWords, true);
  out.set(body, 12);
  return out;
}

function decodeCapnpSegmented(bytes: Uint8Array): { op: number; payload: Uint8Array } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const segmentSizeWords = view.getUint32(8, true);
  const body = bytes.slice(12, 12 + segmentSizeWords * 8);
  const op = body[0] ?? 0;
  const payloadLength = new DataView(body.buffer, body.byteOffset, body.byteLength).getUint32(1, true);
  return { op, payload: body.slice(5, 5 + payloadLength) };
}

function echoRoundtrip(op: number, payload: Uint8Array): Uint8Array {
  const request = decodeCapnpSegmented(encodeCapnpSegmented(op, payload));
  const response = decodeCapnpSegmented(encodeCapnpSegmented(2, request.payload));
  return response.payload;
}

function echoStream(chunks: readonly Uint8Array[]): Uint8Array {
  const parts = chunks.map((chunk) => decodeCapnpSegmented(encodeCapnpSegmented(3, chunk)).payload);
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }
  return merged;
}

export function createCapnpIpcAdapter(): IpcProtocolAdapter {
  return {
    id: "capnp",
    roundtripNull(iterations) {
      return timeRoundtripUs(() => {
        echoRoundtrip(0, new Uint8Array(0));
      }, iterations);
    },
    roundtripPayload(payload, iterations) {
      return timeRoundtripUs(() => {
        const out = echoRoundtrip(1, payload);
        if (out.length !== payload.length) throw new Error("capnp ipc payload mismatch");
      }, iterations);
    },
    roundtripStream(chunks, iterations) {
      return timeRoundtripUs(() => {
        const merged = echoStream(chunks);
        const expected = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        if (merged.length !== expected) throw new Error("capnp ipc stream mismatch");
      }, iterations);
    },
    roundtripConcurrent(payload, concurrency, iterations) {
      return timeRoundtripUs(() => {
        const results = Array.from({ length: concurrency }, () => echoRoundtrip(1, payload));
        if (results.some((result) => result.length !== payload.length)) {
          throw new Error("capnp ipc concurrent mismatch");
        }
      }, iterations);
    },
    measureCancellation(inFlight) {
      let completed = 0;
      let aborted = 0;
      for (let i = 0; i < inFlight; i++) {
        const cancel = i % 2 === 0;
        const decoded = decodeCapnpSegmented(encodeCapnpSegmented(cancel ? 4 : 1, new Uint8Array(16)));
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
        const frame = encodeCapnpSegmented(1, new Uint8Array(64));
        if (queue.length >= queueDepth) {
          dropped += 1;
          continue;
        }
        queue.push(frame);
        accepted += 1;
      }
      while (queue.length > 0) decodeCapnpSegmented(queue.shift()!);
      return { accepted, dropped };
    },
  };
}
