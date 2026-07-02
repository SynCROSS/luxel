import { describe, expect, test } from "bun:test";
import {
  DEFAULT_THIRD_PARTY_SCHEMA_LIMITS,
  resolveNativeSchemasConfig,
} from "../src/config/native-schemas.ts";
import {
  ThirdPartySchemaRegistry,
  auditJsonWithinLimits,
  parseThirdPartyLuxelDataJson,
} from "../src/schema/third-party.ts";
import { LUXEL_DATA_VERSION } from "../src/resource-store/luxel-data.ts";

const enabledConfig = resolveNativeSchemasConfig({ schemas: { thirdParty: true } });
const disabledConfig = resolveNativeSchemasConfig({ schemas: { thirdParty: false } });

function samplePayload(extraKey?: string) {
  const resources: Record<string, unknown> = {
    "route:plugin:status": {
      value: { ok: true },
      generation: 1,
      tags: ["plugin"],
      cache: {},
      stale: false,
    },
  };
  if (extraKey) {
    resources[extraKey] = {
      value: {},
      generation: 1,
      tags: [],
      cache: {},
      stale: false,
    };
  }
  return { version: LUXEL_DATA_VERSION, resources };
}

describe("third-party schema opt-in", () => {
  test("third-party schemas disabled by default", () => {
    expect(resolveNativeSchemasConfig().thirdPartyEnabled).toBe(false);
    expect(resolveNativeSchemasConfig({}).thirdPartyEnabled).toBe(false);
  });

  test("native.schemas.thirdParty true enables runtime schema loading", () => {
    const registry = new ThirdPartySchemaRegistry(DEFAULT_THIRD_PARTY_SCHEMA_LIMITS);
    registry.load("plugin-v1", { allowedResourceKeys: ["route:plugin:status"] });
    const envelope = parseThirdPartyLuxelDataJson(
      JSON.stringify(samplePayload()),
      enabledConfig,
      registry,
      "plugin-v1",
    );
    expect(envelope.resources["route:plugin:status"]?.value).toEqual({ ok: true });
  });

  test("rejects third-party ingest when config disabled", () => {
    const registry = new ThirdPartySchemaRegistry(DEFAULT_THIRD_PARTY_SCHEMA_LIMITS);
    registry.load("plugin-v1", { allowedResourceKeys: ["route:plugin:status"] });
    expect(() =>
      parseThirdPartyLuxelDataJson(
        JSON.stringify(samplePayload()),
        disabledConfig,
        registry,
        "plugin-v1",
      ),
    ).toThrow(/disabled/i);
  });

  test("rejects resource keys outside runtime schema", () => {
    const registry = new ThirdPartySchemaRegistry(DEFAULT_THIRD_PARTY_SCHEMA_LIMITS);
    registry.load("plugin-v1", { allowedResourceKeys: ["route:plugin:status"] });
    expect(() =>
      parseThirdPartyLuxelDataJson(
        JSON.stringify(samplePayload("route:evil:payload")),
        enabledConfig,
        registry,
        "plugin-v1",
      ),
    ).toThrow(/untrusted resource key/i);
  });

  test("malformed JSON fails deterministically", () => {
    const registry = new ThirdPartySchemaRegistry(DEFAULT_THIRD_PARTY_SCHEMA_LIMITS);
    registry.load("plugin-v1", { allowedResourceKeys: ["route:plugin:status"] });
    expect(() => parseThirdPartyLuxelDataJson("{", enabledConfig, registry, "plugin-v1")).toThrow(
      /malformed JSON/i,
    );
  });

  test("oversize payload fails before parse completes", () => {
    const registry = new ThirdPartySchemaRegistry(DEFAULT_THIRD_PARTY_SCHEMA_LIMITS);
    registry.load("plugin-v1", { allowedResourceKeys: ["route:plugin:status"] });
    const limits = { ...DEFAULT_THIRD_PARTY_SCHEMA_LIMITS, maxTotalBytes: 16 };
    const config = resolveNativeSchemasConfig({ schemas: { thirdParty: true, limits } });
    expect(() =>
      parseThirdPartyLuxelDataJson(JSON.stringify(samplePayload()), config, registry, "plugin-v1"),
    ).toThrow(/max total bytes exceeded/i);
  });

  test("depth limit exceeded fails deterministically", () => {
    const deep: Record<string, unknown> = {};
    let cursor: Record<string, unknown> = deep;
    for (let i = 0; i < 40; i++) {
      const next: Record<string, unknown> = {};
      cursor.nested = next;
      cursor = next;
    }
    const limits = { ...DEFAULT_THIRD_PARTY_SCHEMA_LIMITS, maxDepth: 4 };
    expect(() => auditJsonWithinLimits(deep, limits)).toThrow(/max depth exceeded/i);
  });

  test("schema cache bounds reject excess definitions", () => {
    const limits = { ...DEFAULT_THIRD_PARTY_SCHEMA_LIMITS, maxCachedSchemas: 1 };
    const registry = new ThirdPartySchemaRegistry(limits);
    registry.load("a", { allowedResourceKeys: ["route:a:x"] });
    expect(() => registry.load("b", { allowedResourceKeys: ["route:b:x"] })).toThrow(/entry cap/i);
  });
});
