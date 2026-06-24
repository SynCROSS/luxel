import type { ResourceSnapshot } from "./types.ts";

export const LUXEL_DATA_VERSION = 2 as const;

export type LuxelDataV2 = {
  version: typeof LUXEL_DATA_VERSION;
  resources: ResourceSnapshot;
};

export type TemplateBinding = {
  templateId: string;
  resourceKey: string;
  field: string;
};

export function isLuxelDataV2(value: unknown): value is LuxelDataV2 {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as LuxelDataV2).version === LUXEL_DATA_VERSION &&
    typeof (value as LuxelDataV2).resources === "object"
  );
}

/** Escape JSON embedded in `<script type="application/json">` raw text. */
export function serializeJsonForScriptEmbed(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (ch) => {
    switch (ch) {
      case "<":
        return "\\u003C";
      case ">":
        return "\\u003E";
      case "&":
        return "\\u0026";
      case "\u2028":
        return "\\u2028";
      case "\u2029":
        return "\\u2029";
      default:
        return ch;
    }
  });
}

export function serializeLuxelData(snapshot: ResourceSnapshot): string {
  const payload: LuxelDataV2 = { version: LUXEL_DATA_VERSION, resources: snapshot };
  return serializeJsonForScriptEmbed(payload);
}

export type LuxelHydrationPayload = {
  routeId: string;
  bindings: readonly TemplateBinding[];
  boundaries: readonly {
    id: string;
    directive: string;
    clientModule: string;
  }[];
};

export function serializeLuxelHydration(payload: LuxelHydrationPayload): string {
  return serializeJsonForScriptEmbed(payload);
}

export function projectFromSnapshot(
  snapshot: ResourceSnapshot,
  bindings: readonly TemplateBinding[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const binding of bindings) {
    const entry = snapshot[binding.resourceKey];
    if (!entry) continue;
    const value = entry.value;
    if (typeof value === "object" && value !== null && binding.field in (value as object)) {
      out[binding.templateId] = (value as Record<string, unknown>)[binding.field];
    } else {
      out[binding.templateId] = value;
    }
  }
  return out;
}
