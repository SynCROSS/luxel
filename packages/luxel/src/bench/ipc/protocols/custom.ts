import type { IpcProtocolAdapter } from "../types.ts";
import { benchIterations, timeRoundtripUs } from "../stats.ts";
import {
  encodeCustomFrame,
  decodeCustomFrame,
  IPC_OP_PING,
  IPC_OP_REQUEST,
  IPC_OP_RESPONSE,
  IPC_OP_CHUNK,
  IPC_OP_CANCEL,
} from "../../../ipc/custom-frame.ts";

function echoRoundtrip(op: number, payload: Uint8Array): Uint8Array {
  const request = decodeCustomFrame(encodeCustomFrame(op, payload));
  const response = decodeCustomFrame(encodeCustomFrame(IPC_OP_RESPONSE, request.payload));
  return response.payload;
}

function echoStream(chunks: readonly Uint8Array[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const chunk of chunks) {
    const frame = decodeCustomFrame(encodeCustomFrame(IPC_OP_CHUNK, chunk));
    parts.push(frame.payload);
  }
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }
  return merged;
}

export function createCustomIpcAdapter(): IpcProtocolAdapter {
  return {
    id: "custom",
    roundtripNull(iterations) {
      return timeRoundtripUs(() => {
        echoRoundtrip(IPC_OP_PING, new Uint8Array(0));
      }, iterations);
    },
    roundtripPayload(payload, iterations) {
      return timeRoundtripUs(() => {
        const out = echoRoundtrip(IPC_OP_REQUEST, payload);
        if (out.length !== payload.length) throw new Error("custom ipc payload length mismatch");
      }, iterations);
    },
    roundtripStream(chunks, iterations) {
      return timeRoundtripUs(() => {
        const merged = echoStream(chunks);
        const expected = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        if (merged.length !== expected) throw new Error("custom ipc stream length mismatch");
      }, iterations);
    },
    roundtripConcurrent(payload, concurrency, iterations) {
      return timeRoundtripUs(() => {
        const results = Array.from({ length: concurrency }, () =>
          echoRoundtrip(IPC_OP_REQUEST, payload),
        );
        if (results.some((result) => result.length !== payload.length)) {
          throw new Error("custom ipc concurrent payload mismatch");
        }
      }, iterations);
    },
    measureCancellation(inFlight) {
      let completed = 0;
      let aborted = 0;
      for (let i = 0; i < inFlight; i++) {
        const cancel = i % 2 === 0;
        const frame = encodeCustomFrame(cancel ? IPC_OP_CANCEL : IPC_OP_REQUEST, new Uint8Array(16));
        const decoded = decodeCustomFrame(frame);
        if (decoded.op === IPC_OP_CANCEL) aborted += 1;
        else completed += 1;
      }
      return { completed, aborted };
    },
    measureBackpressure(queueDepth, burst) {
      const queue: Uint8Array[] = [];
      let accepted = 0;
      let dropped = 0;
      for (let i = 0; i < burst; i++) {
        const frame = encodeCustomFrame(IPC_OP_REQUEST, new Uint8Array(64));
        if (queue.length >= queueDepth) {
          dropped += 1;
          continue;
        }
        queue.push(frame);
        accepted += 1;
      }
      while (queue.length > 0) {
        decodeCustomFrame(queue.shift()!);
      }
      return { accepted, dropped };
    },
  };
}
