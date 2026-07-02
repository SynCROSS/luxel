import { IPC_OP_PING, encodeCustomFrame, decodeCustomFrame } from "../ipc/custom-frame.ts";

export const RENDERD_OP_PING = IPC_OP_PING;
export const RENDERD_OP_SPIRAL_DOCUMENT = 10;
export const RENDERD_OP_SHUTDOWN = 11;
export const RENDERD_OP_RESPONSE_OK = 12;
export const RENDERD_OP_RESPONSE_ERR = 13;
export const RENDERD_OP_LUXEL_DATA_BEGIN = 14;
export const RENDERD_OP_LUXEL_DATA_CHUNK = 15;
export const RENDERD_OP_LUXEL_DATA_FINISH = 16;
export const RENDERD_OP_LUXEL_DATA_RESULT_OK = 17;
export const RENDERD_OP_LUXEL_DATA_RESULT_ERR = 18;

export type RenderdBinaryResponse =
  | { ok: true; html: string }
  | { ok: false; error: string };

export type RenderdLuxelDataResult =
  | { ok: true; resourceCount: number }
  | { ok: false; error: string };

function encodeUtf8Pair(a: string, b: string): Uint8Array {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const out = new Uint8Array(8 + aBytes.length + bBytes.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, aBytes.length, true);
  out.set(aBytes, 4);
  view.setUint32(4 + aBytes.length, bBytes.length, true);
  out.set(bBytes, 8 + aBytes.length);
  return out;
}

function decodeUtf8Pair(payload: Uint8Array): { first: string; second: string } {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const firstLen = view.getUint32(0, true);
  const dec = new TextDecoder();
  const first = dec.decode(payload.slice(4, 4 + firstLen));
  const secondOffset = 4 + firstLen;
  const secondLen = view.getUint32(secondOffset, true);
  const second = dec.decode(payload.slice(secondOffset + 4, secondOffset + 4 + secondLen));
  return { first, second };
}

export function encodeRenderdSpiralDocumentRequest(routePath: string, headStyle: string): Uint8Array {
  return encodeUtf8Pair(routePath, headStyle);
}

export function decodeRenderdSpiralDocumentRequest(payload: Uint8Array): {
  routePath: string;
  headStyle: string;
} {
  const { first, second } = decodeUtf8Pair(payload);
  return { routePath: first, headStyle: second };
}

export function encodeRenderdResponse(response: RenderdBinaryResponse): Uint8Array {
  const enc = new TextEncoder();
  const text = response.ok ? response.html : response.error;
  const bytes = enc.encode(text);
  const out = new Uint8Array(4 + bytes.length);
  new DataView(out.buffer).setUint32(0, bytes.length, true);
  out.set(bytes, 4);
  return out;
}

export function decodeRenderdResponsePayload(payload: Uint8Array): RenderdBinaryResponse {
  const len = new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getUint32(0, true);
  const text = new TextDecoder().decode(payload.slice(4, 4 + len));
  return { ok: true, html: text };
}

export function decodeRenderdErrorPayload(payload: Uint8Array): RenderdBinaryResponse {
  const len = new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getUint32(0, true);
  const text = new TextDecoder().decode(payload.slice(4, 4 + len));
  return { ok: false, error: text };
}

export function encodeRenderdRequestFrame(op: number, payload: Uint8Array): Uint8Array {
  return encodeCustomFrame(op, payload);
}

export function decodeRenderdRequestFrame(frame: Uint8Array): { op: number; payload: Uint8Array } {
  return decodeCustomFrame(frame);
}

export function encodeRenderdResponseFrame(response: RenderdBinaryResponse): Uint8Array {
  const op = response.ok ? RENDERD_OP_RESPONSE_OK : RENDERD_OP_RESPONSE_ERR;
  const payload = encodeRenderdResponse(
    response.ok ? { ok: true, html: response.html } : { ok: false, error: response.error },
  );
  return encodeCustomFrame(op, payload);
}

export function decodeRenderdResponseFrame(frame: Uint8Array): RenderdBinaryResponse {
  const { op, payload } = decodeCustomFrame(frame);
  if (op === RENDERD_OP_RESPONSE_ERR) {
    return decodeRenderdErrorPayload(payload);
  }
  return decodeRenderdResponsePayload(payload);
}

export function encodeLuxelDataBeginPayload(allowedKeys: readonly string[]): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(allowedKeys));
}

export function decodeLuxelDataBeginPayload(payload: Uint8Array): string[] {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(payload));
  if (!Array.isArray(parsed) || !parsed.every((key) => typeof key === "string")) {
    throw new Error("invalid luxel-data begin payload");
  }
  return parsed;
}

export function encodeLuxelDataResultFrame(result: RenderdLuxelDataResult): Uint8Array {
  if (result.ok) {
    const payload = new Uint8Array(4);
    new DataView(payload.buffer).setUint32(0, result.resourceCount, true);
    return encodeCustomFrame(RENDERD_OP_LUXEL_DATA_RESULT_OK, payload);
  }
  const payload = encodeRenderdResponse({ ok: false, error: result.error });
  return encodeCustomFrame(RENDERD_OP_LUXEL_DATA_RESULT_ERR, payload);
}

export function decodeLuxelDataResultFrame(frame: Uint8Array): RenderdLuxelDataResult {
  const { op, payload } = decodeCustomFrame(frame);
  if (op === RENDERD_OP_LUXEL_DATA_RESULT_ERR) {
    const err = decodeRenderdErrorPayload(payload);
    return err.ok ? { ok: false, error: "luxel-data parse failed" } : err;
  }
  if (op !== RENDERD_OP_LUXEL_DATA_RESULT_OK) {
    throw new Error(`unexpected luxel-data result op ${op}`);
  }
  const resourceCount = new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getUint32(
    0,
    true,
  );
  return { ok: true, resourceCount };
}

export function decodeRenderdClientFrame(frame: Uint8Array): RenderdBinaryResponse | RenderdLuxelDataResult {
  const { op } = decodeCustomFrame(frame);
  if (op === RENDERD_OP_LUXEL_DATA_RESULT_OK || op === RENDERD_OP_LUXEL_DATA_RESULT_ERR) {
    return decodeLuxelDataResultFrame(frame);
  }
  return decodeRenderdResponseFrame(frame);
}
