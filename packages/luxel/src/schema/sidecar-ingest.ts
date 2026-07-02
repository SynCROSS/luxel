import type { LuxelDataV2, TemplateBinding, ThirdPartySchemaRef } from "../resource-store/luxel-data.ts";
import { isLuxelDataV2 } from "../resource-store/luxel-data.ts";
import {
  DEFAULT_THIRD_PARTY_SCHEMA_LIMITS,
  resolveNativeSchemasConfig,
  type ResolvedNativeSchemasConfig,
} from "../config/native-schemas.ts";
import { ingestLuxelDataV2Text, trustedSchemaForRoute } from "./ingest.ts";
import {
  parseThirdPartyLuxelDataJson,
  ThirdPartySchemaRegistry,
} from "./third-party.ts";

export type LuxelDataIngestContext = {
  bindings?: readonly TemplateBinding[];
  thirdPartySchema?: ThirdPartySchemaRef;
};

export function createThirdPartyRegistryFromRef(
  schemaRef: ThirdPartySchemaRef,
  limits = DEFAULT_THIRD_PARTY_SCHEMA_LIMITS,
): ThirdPartySchemaRegistry {
  const registry = new ThirdPartySchemaRegistry(limits);
  registry.load(schemaRef.id, { allowedResourceKeys: [...schemaRef.allowedResourceKeys] });
  return registry;
}

export function ingestThirdPartyLuxelDataFromSidecar(
  text: string,
  schemaRef: ThirdPartySchemaRef,
  limits = DEFAULT_THIRD_PARTY_SCHEMA_LIMITS,
): LuxelDataV2 {
  const schemaConfig: ResolvedNativeSchemasConfig = {
    thirdPartyEnabled: true,
    limits,
  };
  const registry = createThirdPartyRegistryFromRef(schemaRef, limits);
  return parseThirdPartyLuxelDataJson(text, schemaConfig, registry, schemaRef.id);
}

export function ingestLuxelDataSidecarText(
  text: string,
  context: LuxelDataIngestContext,
  schemaConfig?: ResolvedNativeSchemasConfig,
): LuxelDataV2 {
  if (context.thirdPartySchema) {
    if (schemaConfig && !schemaConfig.thirdPartyEnabled) {
      throw new Error("third-party schemas disabled — set native.schemas.thirdParty: true");
    }
    return ingestThirdPartyLuxelDataFromSidecar(
      text,
      context.thirdPartySchema,
      schemaConfig?.limits,
    );
  }
  if (context.bindings && context.bindings.length > 0) {
    return ingestLuxelDataV2Text(text, trustedSchemaForRoute(context.bindings)).envelope;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("luxel-data sidecar: malformed JSON");
  }
  if (!isLuxelDataV2(parsed)) {
    throw new Error("luxel-data sidecar: invalid luxel-data v2 envelope");
  }
  return parsed;
}

export async function ingestLuxelDataFetchText(
  text: string,
  schemaRef: ThirdPartySchemaRef,
  nativeConfig?: Parameters<typeof resolveNativeSchemasConfig>[0],
): Promise<LuxelDataV2> {
  const schemaConfig = resolveNativeSchemasConfig(nativeConfig);
  const registry = createThirdPartyRegistryFromRef(schemaRef, schemaConfig.limits);
  return parseThirdPartyLuxelDataJson(text, schemaConfig, registry, schemaRef.id);
}
