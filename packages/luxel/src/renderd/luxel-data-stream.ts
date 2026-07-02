import type { LuxelDataV2 } from "../resource-store/luxel-data.ts";
import { createTrustedLuxelDataV2Parser } from "../schema/stream-parser.ts";
import type { TrustedJsonStreamParser } from "../schema/types.ts";
import { trustedLuxelDataV2SchemaFromBindings } from "../schema/validate.ts";

let activeParser: TrustedJsonStreamParser<LuxelDataV2> | null = null;

export function resetLuxelDataStreamSession(): void {
  activeParser = null;
}

export function beginLuxelDataStream(allowedKeys: readonly string[]): void {
  const schema = trustedLuxelDataV2SchemaFromBindings([], allowedKeys);
  activeParser = createTrustedLuxelDataV2Parser(schema, { limits: { queueDepth: 8 } });
}

export function pushLuxelDataStreamChunk(chunk: Uint8Array): { accepted: number; dropped: number } {
  if (!activeParser) {
    throw new Error("luxel-data stream not started");
  }
  return activeParser.push(chunk);
}

export function finishLuxelDataStream(): LuxelDataV2 {
  if (!activeParser) {
    throw new Error("luxel-data stream not started");
  }
  try {
    return activeParser.finish();
  } finally {
    activeParser = null;
  }
}

export function cancelLuxelDataStream(): void {
  activeParser?.cancel();
  activeParser = null;
}
