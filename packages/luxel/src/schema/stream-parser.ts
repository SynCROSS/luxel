import type { LuxelDataV2 } from "../resource-store/luxel-data.ts";
import { percentile } from "./stats.ts";
import type {
  LuxelDataV2StreamResult,
  StreamParseMetrics,
  TrustedJsonStreamParser,
  TrustedLuxelDataV2Schema,
  TrustedSchemaLimits,
} from "./types.ts";
import { DEFAULT_SCHEMA_QUEUE_DEPTH } from "./types.ts";
import { validateTrustedLuxelDataV2 } from "./validate.ts";

export type TrustedLuxelDataV2ParserOptions = {
  limits?: TrustedSchemaLimits;
  signal?: AbortSignal;
  onPartial?: (bytes: Uint8Array) => void;
};

export function createTrustedLuxelDataV2Parser(
  schema: TrustedLuxelDataV2Schema,
  options?: TrustedLuxelDataV2ParserOptions,
): TrustedJsonStreamParser<LuxelDataV2> {
  const limits = options?.limits;
  const maxBytes = limits?.maxBytes ?? 8 * 1024 * 1024;
  const queueDepth = limits?.queueDepth ?? DEFAULT_SCHEMA_QUEUE_DEPTH;

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let cancelled = false;
  let acceptedChunks = 0;
  let droppedChunks = 0;
  const startedAt = performance.now();
  let firstChunkAt: number | null = null;
  let lastChunkAt: number | null = null;
  const chunkGaps: number[] = [];

  const onAbort = () => {
    cancel();
  };
  options?.signal?.addEventListener("abort", onAbort, { once: true });

  function metrics(): StreamParseMetrics {
    return {
      ttfbMs: firstChunkAt ?? 0,
      chunkGapP99Ms: percentile(chunkGaps, 99),
      acceptedChunks,
      droppedChunks,
    };
  }

  function cancel(): void {
    cancelled = true;
    chunks.length = 0;
    totalBytes = 0;
    options?.signal?.removeEventListener("abort", onAbort);
  }

  function compactChunks(): void {
    if (chunks.length <= 1) return;
    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    chunks.length = 0;
    chunks.push(merged);
  }

  return {
    push(chunk: Uint8Array) {
      if (cancelled) {
        droppedChunks += 1;
        return { accepted: 0, dropped: 1 };
      }
      if (chunks.length >= queueDepth) {
        compactChunks();
      }
      if (totalBytes + chunk.length > maxBytes) {
        droppedChunks += 1;
        return { accepted: 0, dropped: 1 };
      }

      const now = performance.now();
      if (firstChunkAt === null) {
        firstChunkAt = now - startedAt;
      } else if (lastChunkAt !== null) {
        chunkGaps.push(now - lastChunkAt);
      }
      lastChunkAt = now;

      chunks.push(chunk);
      totalBytes += chunk.length;
      acceptedChunks += 1;
      options?.onPartial?.(chunk);

      return { accepted: 1, dropped: 0 };
    },
    finish() {
      if (cancelled) {
        throw new Error("trusted schema stream cancelled");
      }
      compactChunks();
      const merged = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      const text = new TextDecoder().decode(merged);
      const parsed: unknown = JSON.parse(text);
      return validateTrustedLuxelDataV2(parsed, schema);
    },
    cancel,
    metrics,
  };
}

export async function parseLuxelDataV2Stream(
  source: ReadableStream<Uint8Array>,
  schema: TrustedLuxelDataV2Schema,
  options?: TrustedLuxelDataV2ParserOptions,
): Promise<LuxelDataV2StreamResult> {
  const parser = createTrustedLuxelDataV2Parser(schema, options);
  const reader = source.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) parser.push(value);
    }
    const envelope = parser.finish();
    return {
      envelope,
      metrics: parser.metrics(),
    };
  } finally {
    reader.releaseLock();
  }
}
