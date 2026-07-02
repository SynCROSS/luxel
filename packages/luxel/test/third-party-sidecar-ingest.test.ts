import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { LUXEL_DATA_VERSION, serializeJsonForScriptEmbed, serializeLuxelHydration } from "../src/resource-store/luxel-data.ts";
import { readLuxelDataSidecar } from "../src/runtime/hydrate.ts";
import {
  ingestLuxelDataFetchText,
  ingestLuxelDataSidecarText,
} from "../src/schema/sidecar-ingest.ts";
import { resolveNativeSchemasConfig } from "../src/config/native-schemas.ts";

const pluginSchema = {
  id: "plugin-v1",
  allowedResourceKeys: ["route:plugin:status"],
};

const pluginEnvelope = {
  version: LUXEL_DATA_VERSION,
  resources: {
    "route:plugin:status": {
      value: { ok: true },
      generation: 1,
      tags: ["plugin"],
      cache: {},
      stale: false,
    },
  },
};

function withDom(html: string, run: (document: Document) => void): void {
  const window = new Window();
  const doc = window.document;
  doc.body.innerHTML = html;
  (globalThis as { document?: Document }).document = doc;
  try {
    run(doc);
  } finally {
    delete (globalThis as { document?: Document }).document;
  }
}

describe("third-party sidecar ingest", () => {
  test("hydrate path parses luxel-data via embedded thirdPartySchema", () => {
    const hydration = serializeLuxelHydration({
      routeId: "route:plugin",
      bindings: [],
      boundaries: [],
      thirdPartySchema: pluginSchema,
    });
    const data = serializeJsonForScriptEmbed(pluginEnvelope);
    const html = `<script type="application/json" id="luxel-hydration">${hydration}</script><script type="application/json" id="luxel-data">${data}</script>`;

    withDom(html, () => {
      const envelope = readLuxelDataSidecar({
        bindings: [],
        thirdPartySchema: pluginSchema,
      });
      expect(envelope.resources["route:plugin:status"]?.value).toEqual({ ok: true });
    });
  });

  test("trusted bindings still win when thirdPartySchema absent", () => {
    const envelope = ingestLuxelDataSidecarText(JSON.stringify({
      version: LUXEL_DATA_VERSION,
      resources: {
        "route:index:count": {
          value: { count: 2 },
          generation: 1,
          tags: [],
          cache: {},
          stale: false,
        },
      },
    }), {
      bindings: [{ templateId: "count", resourceKey: "route:index:count", field: "count" }],
    });
    expect(envelope.resources["route:index:count"]?.value).toEqual({ count: 2 });
  });

  test("server fetch ingress requires native.schemas.thirdParty", async () => {
    await expect(
      ingestLuxelDataFetchText(JSON.stringify(pluginEnvelope), pluginSchema, { schemas: { thirdParty: false } }),
    ).rejects.toThrow(/disabled/i);
  });

  test("server fetch ingress accepts plugin payload when enabled", async () => {
    const envelope = await ingestLuxelDataFetchText(
      JSON.stringify(pluginEnvelope),
      pluginSchema,
      { schemas: { thirdParty: true } },
    );
    expect(envelope.resources["route:plugin:status"]?.value).toEqual({ ok: true });
    expect(resolveNativeSchemasConfig({ schemas: { thirdParty: true } }).thirdPartyEnabled).toBe(true);
  });
});
