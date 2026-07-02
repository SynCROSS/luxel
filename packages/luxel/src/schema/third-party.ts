import type { LuxelDataV2 } from "../resource-store/luxel-data.ts";
import { isLuxelDataV2, LUXEL_DATA_VERSION } from "../resource-store/luxel-data.ts";
import type { ThirdPartySchemaLimits } from "../config/native-schemas.ts";
import {
  assertThirdPartySchemasEnabled,
  type ResolvedNativeSchemasConfig,
} from "../config/native-schemas.ts";
import { isResourceEntry } from "./validate.ts";

export type ThirdPartySchemaDefinition = {
  id: string;
  allowedResourceKeys: ReadonlySet<string>;
};

type RegistryEntry = {
  definition: ThirdPartySchemaDefinition;
  bytes: number;
};

export class ThirdPartySchemaRegistry {
  private readonly entries = new Map<string, RegistryEntry>();
  private cacheBytes = 0;

  constructor(private readonly limits: ThirdPartySchemaLimits) {}

  load(id: string, raw: unknown): ThirdPartySchemaDefinition {
    auditJsonWithinLimits(raw, this.limits);
    if (typeof raw !== "object" || raw === null) {
      throw new Error("third-party schema: definition must be an object");
    }
    const def = raw as { allowedResourceKeys?: unknown };
    if (!Array.isArray(def.allowedResourceKeys)) {
      throw new Error("third-party schema: allowedResourceKeys required");
    }
    if (!def.allowedResourceKeys.every((key) => typeof key === "string")) {
      throw new Error("third-party schema: allowedResourceKeys must be strings");
    }
    const definition: ThirdPartySchemaDefinition = {
      id,
      allowedResourceKeys: new Set(def.allowedResourceKeys),
    };
    const bytes = JSON.stringify(raw).length;
    if (bytes > this.limits.maxSchemaCacheBytes) {
      throw new Error("third-party schema: definition exceeds schema cache byte cap");
    }
    const existing = this.entries.get(id);
    if (!existing) {
      if (this.entries.size >= this.limits.maxCachedSchemas) {
        throw new Error("third-party schema: schema cache entry cap exceeded");
      }
      if (this.cacheBytes + bytes > this.limits.maxSchemaCacheBytes) {
        throw new Error("third-party schema: schema cache byte cap exceeded");
      }
    } else {
      this.cacheBytes -= existing.bytes;
    }
    this.entries.set(id, { definition, bytes });
    this.cacheBytes += bytes;
    return definition;
  }

  get(id: string): ThirdPartySchemaDefinition | undefined {
    return this.entries.get(id)?.definition;
  }
}

export function auditJsonWithinLimits(
  value: unknown,
  limits: ThirdPartySchemaLimits,
  startedAt = performance.now(),
): void {
  if (performance.now() - startedAt > limits.parseTimeoutMs) {
    throw new Error("third-party schema: parse timeout exceeded");
  }
  let keyCount = 0;
  const walk = (node: unknown, depth: number): void => {
    if (performance.now() - startedAt > limits.parseTimeoutMs) {
      throw new Error("third-party schema: parse timeout exceeded");
    }
    if (depth > limits.maxDepth) {
      throw new Error("third-party schema: max depth exceeded");
    }
    if (typeof node === "string") {
      const bytes = new TextEncoder().encode(node).byteLength;
      if (bytes > limits.maxStringBytes) {
        throw new Error("third-party schema: max string bytes exceeded");
      }
      return;
    }
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      keyCount += 1;
      if (keyCount > limits.maxKeys) {
        throw new Error("third-party schema: max key count exceeded");
      }
      const keyBytes = new TextEncoder().encode(key).byteLength;
      if (keyBytes > limits.maxStringBytes) {
        throw new Error("third-party schema: max string bytes exceeded");
      }
      walk(child, depth + 1);
    }
  };
  walk(value, 0);
}

export function parseThirdPartyLuxelDataJson(
  text: string,
  schemaConfig: ResolvedNativeSchemasConfig,
  registry: ThirdPartySchemaRegistry,
  schemaId: string,
): LuxelDataV2 {
  assertThirdPartySchemasEnabled(schemaConfig);
  const limits = schemaConfig.limits;
  const startedAt = performance.now();
  if (text.length > limits.maxTotalBytes) {
    throw new Error("third-party schema: max total bytes exceeded");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("third-party schema: malformed JSON");
  }
  if (performance.now() - startedAt > limits.parseTimeoutMs) {
    throw new Error("third-party schema: parse timeout exceeded");
  }
  auditJsonWithinLimits(parsed, limits, startedAt);
  if (!isLuxelDataV2(parsed)) {
    throw new Error("third-party schema: invalid luxel-data v2 envelope");
  }
  if (parsed.version !== LUXEL_DATA_VERSION) {
    throw new Error(`third-party schema: version mismatch expected=${LUXEL_DATA_VERSION}`);
  }
  const definition = registry.get(schemaId);
  if (!definition) {
    throw new Error(`third-party schema: unknown schema id ${schemaId}`);
  }
  for (const key of Object.keys(parsed.resources)) {
    if (!definition.allowedResourceKeys.has(key)) {
      throw new Error(`third-party schema: untrusted resource key ${key}`);
    }
    if (!isResourceEntry(parsed.resources[key])) {
      throw new Error(`third-party schema: invalid resource entry ${key}`);
    }
  }
  return parsed;
}
