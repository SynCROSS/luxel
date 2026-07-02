import {
  serializeJsonForScriptEmbed,
  serializeLuxelHydration,
  type TemplateBinding,
} from "../resource-store/luxel-data.ts";
import type { ResourceStore } from "../resource-store/store.ts";
import type { CodegenSsrOptions } from "../compiler/codegen-ssr.ts";
import { ASSET_CLIENT } from "../compiler/codegen-ssr.ts";

function compactHtmlFragment(html: string): string {
  return html
    .split("\n")
    .map((line) => line.trim())
    .join("");
}

function compactCss(css: string): string {
  return css
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("")
    .replace(/\s*:\s*/g, ":")
    .replace(/\s*;\s*/g, ";")
    .replace(/\s*{\s*/g, "{")
    .replace(/\s*}\s*/g, "}");
}

export function spiralNativeDocumentFromBody(
  body: string,
  routePath: string,
  headStyle: string,
): string {
  return createSpiralNativeDocumentRenderer(routePath, headStyle)(body);
}

export function spiralNativeStreamShell(
  routePath: string,
  headStyle: string,
): { prefix: string; suffix: string } {
  const styleBlock = headStyle ? `<style>${compactCss(headStyle)}</style>` : "";
  return {
    prefix: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Luxel</title>${styleBlock}</head><body><main data-luxel-route="${routePath}">`,
    suffix: `</main></body></html>`,
  };
}

export function createSpiralNativeDocumentRenderer(
  routePath: string,
  headStyle: string,
): (body: string) => string {
  const styleBlock = headStyle ? `<style>${compactCss(headStyle)}</style>` : "";
  const prefix = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Luxel</title>${styleBlock}</head><body><main data-luxel-route="${routePath}">`;
  const suffix = `</main></body></html>`;
  return (body) => `${prefix}${compactHtmlFragment(body)}${suffix}`;
}

export type NativeCounterDocumentRenderer = (body: string, store: ResourceStore) => string;

export function createNativeCounterDocumentRenderer(
  codegenOpts: CodegenSsrOptions,
  bindings: readonly TemplateBinding[],
  boundaryIds: readonly string[],
  headStyle: string,
): NativeCounterDocumentRenderer {
  const messageBinding = bindings.find((binding) => binding.field === "message");
  const messageKey = messageBinding?.resourceKey ?? "route:index:message";
  const styleBlock = headStyle ? `<style>${compactCss(headStyle)}</style>` : "";
  const hydrationBlock = codegenOpts.shipHydrationSidecar
    ? `<script type="application/json" id="luxel-hydration">${serializeLuxelHydration({
        routeId: codegenOpts.routeId,
        bindings,
        boundaries: boundaryIds.map((id) => ({
          id,
          directive: "load",
          clientModule: codegenOpts.clientModule,
        })),
        thirdPartySchema: codegenOpts.thirdPartySchema,
      })}</script>`
    : "";
  const clientBlock = codegenOpts.shipClientRuntime
    ? `<script type="module" src="/assets/${ASSET_CLIENT}"></script>`
    : "";
  const prefix = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Luxel</title>${styleBlock}</head><body><main data-luxel-route="${codegenOpts.routePath}">`;
  const tail = `${hydrationBlock}${clientBlock}</body></html>`;

  return (body, store) => {
    const entry = store.getEntry(messageKey);
    const messageValue = store.get(messageKey) as { message?: string } | undefined;
    const message = messageValue?.message;
    if (typeof message !== "string") {
      throw new Error(`missing counter message at ${messageKey}`);
    }
    let dataBlock = "";
    if (codegenOpts.shipDataSidecar && entry) {
      const payload = {
        version: 2 as const,
        resources: {
          [messageKey]: {
            value: entry.value,
            generation: entry.generation,
            tags: [...entry.tags],
            cache: { ...entry.cache },
            stale: entry.stale,
          },
        },
      };
      dataBlock = `<script type="application/json" id="luxel-data">${serializeJsonForScriptEmbed(payload)}</script>`;
    }
    return `${prefix}${compactHtmlFragment(body)}</main>${dataBlock}${tail}`;
  };
}
