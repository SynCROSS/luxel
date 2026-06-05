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

export function serializeLuxelData(snapshot: ResourceSnapshot): string {
  const payload: LuxelDataV2 = { version: LUXEL_DATA_VERSION, resources: snapshot };
  return JSON.stringify(payload);
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
