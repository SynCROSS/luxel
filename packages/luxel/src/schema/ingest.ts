import type { LuxelDataV2, TemplateBinding } from "../resource-store/luxel-data.ts";
import { createTrustedLuxelDataV2Parser, type TrustedLuxelDataV2ParserOptions } from "./stream-parser.ts";
import type { LuxelDataV2StreamResult, StreamParseMetrics, TrustedLuxelDataV2Schema } from "./types.ts";
import { trustedLuxelDataV2SchemaFromBindings } from "./validate.ts";

export function trustedSchemaForRoute(
  bindings: readonly TemplateBinding[],
  extraResourceKeys: readonly string[] = [],
): TrustedLuxelDataV2Schema {
  return trustedLuxelDataV2SchemaFromBindings(bindings, extraResourceKeys);
}

export function ingestLuxelDataV2Chunks(
  chunks: readonly Uint8Array[],
  schema: TrustedLuxelDataV2Schema,
  options?: TrustedLuxelDataV2ParserOptions,
): { envelope: LuxelDataV2; metrics: StreamParseMetrics } {
  const parser = createTrustedLuxelDataV2Parser(schema, options);
  for (const chunk of chunks) {
    parser.push(chunk);
  }
  return { envelope: parser.finish(), metrics: parser.metrics() };
}

export function ingestLuxelDataV2Text(
  text: string,
  schema: TrustedLuxelDataV2Schema,
  options?: TrustedLuxelDataV2ParserOptions & { chunkSize?: number },
): { envelope: LuxelDataV2; metrics: StreamParseMetrics } {
  const chunkSize = options?.chunkSize ?? 4096;
  const bytes = new TextEncoder().encode(text);
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(bytes.slice(offset, offset + chunkSize));
  }
  return ingestLuxelDataV2Chunks(chunks, schema, options);
}

export async function ingestLuxelDataV2Readable(
  source: ReadableStream<Uint8Array>,
  schema: TrustedLuxelDataV2Schema,
  options?: TrustedLuxelDataV2ParserOptions,
): Promise<LuxelDataV2StreamResult> {
  const { parseLuxelDataV2Stream } = await import("./stream-parser.ts");
  return parseLuxelDataV2Stream(source, schema, options);
}
