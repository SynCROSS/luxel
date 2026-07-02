import type { NativeModeConfig } from "./native-mode.ts";

export type ThirdPartySchemaLimits = {
  maxDepth: number;
  maxKeys: number;
  maxStringBytes: number;
  maxTotalBytes: number;
  parseTimeoutMs: number;
  maxCachedSchemas: number;
  maxSchemaCacheBytes: number;
};

export type NativeSchemasConfig = {
  thirdParty?: boolean;
  limits?: Partial<ThirdPartySchemaLimits>;
};

export const DEFAULT_THIRD_PARTY_SCHEMA_LIMITS: ThirdPartySchemaLimits = {
  maxDepth: 32,
  maxKeys: 10_000,
  maxStringBytes: 64 * 1024,
  maxTotalBytes: 8 * 1024 * 1024,
  parseTimeoutMs: 5_000,
  maxCachedSchemas: 16,
  maxSchemaCacheBytes: 256 * 1024,
};

export type ResolvedNativeSchemasConfig = {
  thirdPartyEnabled: boolean;
  limits: ThirdPartySchemaLimits;
};

export function resolveNativeSchemasConfig(
  native?: Pick<NativeModeConfig, "schemas">,
): ResolvedNativeSchemasConfig {
  const schemas = native?.schemas;
  return {
    thirdPartyEnabled: schemas?.thirdParty === true,
    limits: { ...DEFAULT_THIRD_PARTY_SCHEMA_LIMITS, ...schemas?.limits },
  };
}

export function assertThirdPartySchemasEnabled(config: ResolvedNativeSchemasConfig): void {
  if (!config.thirdPartyEnabled) {
    throw new Error("third-party schemas disabled — set native.schemas.thirdParty: true");
  }
}
