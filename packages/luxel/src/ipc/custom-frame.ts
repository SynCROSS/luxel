export const IPC_OP_PING = 0;
export const IPC_OP_REQUEST = 1;
export const IPC_OP_RESPONSE = 2;
export const IPC_OP_CHUNK = 3;
export const IPC_OP_CANCEL = 4;

export function encodeCustomFrame(op: number, payload: Uint8Array): Uint8Array {
  const frame = new Uint8Array(4 + 1 + 4 + payload.length);
  const view = new DataView(frame.buffer);
  const bodyLength = 1 + 4 + payload.length;
  view.setUint32(0, bodyLength, true);
  view.setUint8(4, op);
  view.setUint32(5, payload.length, true);
  frame.set(payload, 9);
  return frame;
}

export function decodeCustomFrame(frame: Uint8Array): { op: number; payload: Uint8Array } {
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const bodyLength = view.getUint32(0, true);
  if (bodyLength < 5) throw new Error("custom ipc frame too small");
  const op = view.getUint8(4);
  const payloadLength = view.getUint32(5, true);
  const end = 9 + payloadLength;
  if (end !== 4 + bodyLength) throw new Error("custom ipc frame length mismatch");
  return { op, payload: frame.slice(9, end) };
}
