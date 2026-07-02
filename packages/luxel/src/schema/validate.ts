import {
  isLuxelDataV2,
  LUXEL_DATA_VERSION,
  type LuxelDataV2,
  type TemplateBinding,
} from "../resource-store/luxel-data.ts";
import type { ResourceSnapshot } from "../resource-store/types.ts";
import type { TrustedLuxelDataV2Schema } from "./types.ts";

export function isResourceEntry(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as ResourceSnapshot[string];
  return (
    typeof entry.generation === "number" &&
    Array.isArray(entry.tags) &&
    typeof entry.cache === "object" &&
    entry.cache !== null &&
    typeof entry.stale === "boolean" &&
    "value" in entry
  );
}

export function trustedLuxelDataV2SchemaFromBindings(
  bindings: readonly TemplateBinding[],
  extraResourceKeys: readonly string[] = [],
): TrustedLuxelDataV2Schema {
  const allowedResourceKeys = new Set<string>([
    ...bindings.map((binding) => binding.resourceKey),
    ...extraResourceKeys,
  ]);
  return {
    kind: "luxel-data-v2",
    version: LUXEL_DATA_VERSION,
    bindings,
    allowedResourceKeys,
  };
}

export function validateTrustedLuxelDataV2(
  value: unknown,
  schema: TrustedLuxelDataV2Schema,
): LuxelDataV2 {
  if (!isLuxelDataV2(value)) {
    throw new Error("trusted schema: invalid luxel-data v2 envelope");
  }
  if (value.version !== schema.version) {
    throw new Error(`trusted schema: version mismatch expected=${schema.version}`);
  }

  for (const key of Object.keys(value.resources)) {
    if (!schema.allowedResourceKeys.has(key)) {
      throw new Error(`trusted schema: untrusted resource key ${key}`);
    }
    if (!isResourceEntry(value.resources[key])) {
      throw new Error(`trusted schema: invalid resource entry ${key}`);
    }
  }

  for (const binding of schema.bindings) {
    if (!(binding.resourceKey in value.resources)) {
      throw new Error(`trusted schema: missing binding resource ${binding.resourceKey}`);
    }
  }

  return value;
}
