import { isRenderdRuntimeAvailable } from "../config/native-runtime.ts";
import type { LuxelDataV2 } from "../resource-store/luxel-data.ts";
import { createStreamingStringCache, streamCachedJsonStringChunks } from "../schema/string-cache.ts";
import {
  decodeRenderdClientFrame,
  encodeLuxelDataBeginPayload,
  encodeRenderdRequestFrame,
  encodeRenderdSpiralDocumentRequest,
  RENDERD_OP_LUXEL_DATA_BEGIN,
  RENDERD_OP_LUXEL_DATA_CHUNK,
  RENDERD_OP_LUXEL_DATA_FINISH,
  RENDERD_OP_SHUTDOWN,
  RENDERD_OP_SPIRAL_DOCUMENT,
  type RenderdBinaryResponse,
  type RenderdLuxelDataResult,
} from "./binary-protocol.ts";
import { spawnRenderdChild, type RenderdChildRuntime } from "./spawn.ts";

export type RenderdClient = {
  renderSpiralDocument: (routePath: string, headStyle: string) => Promise<string>;
  streamLuxelData: (envelope: LuxelDataV2, chunkSize?: number) => Promise<number>;
  close: () => Promise<void>;
};

export type CreateRenderdClientOptions = {
  childRuntime?: RenderdChildRuntime;
};

type RenderdClientResponse = RenderdBinaryResponse | RenderdLuxelDataResult;

function isLuxelDataResult(response: RenderdClientResponse): response is RenderdLuxelDataResult {
  return "resourceCount" in response;
}

function attachFrameReader(
  stdout: ReadableStream<Uint8Array>,
  onFrame: (response: RenderdClientResponse) => void,
): void {
  const reader = stdout.getReader();
  let buffer = new Uint8Array(0);
  void (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const merged = new Uint8Array(buffer.length + value.length);
      merged.set(buffer);
      merged.set(value, buffer.length);
      buffer = merged;
      while (buffer.length >= 4) {
        const bodyLength = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint32(
          0,
          true,
        );
        const frameLength = 4 + bodyLength;
        if (buffer.length < frameLength) break;
        const frame = buffer.slice(0, frameLength);
        buffer = buffer.slice(frameLength);
        onFrame(decodeRenderdClientFrame(frame));
      }
    }
  })();
}

function routeIdFromEnvelope(envelope: LuxelDataV2): string {
  const firstKey = Object.keys(envelope.resources)[0];
  if (!firstKey) return "route:unknown";
  const parts = firstKey.split(":");
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : firstKey;
}

export async function createRenderdClient(options?: CreateRenderdClientOptions): Promise<RenderdClient> {
  if (!isRenderdRuntimeAvailable()) {
    throw new Error(
      "luxel-renderd requires @luxel/core-node artifact and node/bun child spawn",
    );
  }
  const proc = spawnRenderdChild(options);

  let pending: ((response: RenderdClientResponse) => void) | null = null;
  let closed = false;

  attachFrameReader(proc.stdout, (response) => {
    if (!pending) return;
    const resolve = pending;
    pending = null;
    resolve(response);
  });

  function writeFrame(op: number, payload: Uint8Array): void {
    proc.writeStdin(encodeRenderdRequestFrame(op, payload));
  }

  function request(op: number, payload: Uint8Array): Promise<RenderdClientResponse> {
    if (closed) return Promise.reject(new Error("renderd client closed"));
    return new Promise((resolve) => {
      pending = resolve;
      proc.writeStdin(encodeRenderdRequestFrame(op, payload));
    });
  }

  return {
    async renderSpiralDocument(routePath, headStyle) {
      const response = await request(
        RENDERD_OP_SPIRAL_DOCUMENT,
        encodeRenderdSpiralDocumentRequest(routePath, headStyle),
      );
      if (isLuxelDataResult(response)) {
        throw new Error("unexpected luxel-data response for spiral document");
      }
      if (!response.ok) throw new Error(response.error);
      return response.html;
    },
    async streamLuxelData(envelope, chunkSize = 128) {
      const allowedKeys = Object.keys(envelope.resources);
      writeFrame(RENDERD_OP_LUXEL_DATA_BEGIN, encodeLuxelDataBeginPayload(allowedKeys));
      const cache = createStreamingStringCache();
      const { chunks } = streamCachedJsonStringChunks(
        JSON.stringify(envelope),
        cache,
        routeIdFromEnvelope(envelope),
        chunkSize,
      );
      for (const chunk of chunks) {
        writeFrame(RENDERD_OP_LUXEL_DATA_CHUNK, chunk);
      }
      const response = await request(RENDERD_OP_LUXEL_DATA_FINISH, new Uint8Array(0));
      if (!isLuxelDataResult(response)) {
        throw new Error("expected luxel-data result frame");
      }
      if (!response.ok) throw new Error(response.error);
      return response.resourceCount;
    },
    async close() {
      if (closed) return;
      try {
        const response = await request(RENDERD_OP_SHUTDOWN, new Uint8Array(0));
        if (!isLuxelDataResult(response) && !response.ok) {
          throw new Error(response.error);
        }
      } finally {
        closed = true;
        proc.endStdin();
        await proc.waitExit();
      }
    },
  };
}
