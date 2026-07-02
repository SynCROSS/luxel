import type { LuxelDataV2, TemplateBinding } from "../resource-store/luxel-data.ts";

export const DEFAULT_SCHEMA_QUEUE_DEPTH = 8;

export type TrustedLuxelDataV2Schema = {
  kind: "luxel-data-v2";
  version: 2;
  bindings: readonly TemplateBinding[];
  allowedResourceKeys: ReadonlySet<string>;
};

export type TrustedSchemaLimits = {
  maxBytes?: number;
  queueDepth?: number;
};

export type StreamParseMetrics = {
  ttfbMs: number;
  chunkGapP99Ms: number;
  acceptedChunks: number;
  droppedChunks: number;
};

export type TrustedJsonStreamParser<T> = {
  push(chunk: Uint8Array): { accepted: number; dropped: number };
  finish(): T;
  cancel(): void;
  metrics(): StreamParseMetrics;
};

export type LuxelDataV2StreamResult = {
  envelope: LuxelDataV2;
  metrics: StreamParseMetrics;
};
