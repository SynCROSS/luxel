import type { RenderIr } from "../compiler/render-ir.ts";
import type { NativeSsrRouteKind } from "../compiler/spiral-native.ts";
import type { TemplateBinding } from "../resource-store/luxel-data.ts";
import type { ResourceStore } from "../resource-store/store.ts";
import { getLuxelCoreNodeModule } from "../bench/ensure-core-node.ts";
import { createSpiralNativeDocumentRenderer } from "./native-route-document.ts";

type RenderBodyFromIrFn = (
  renderIrJson: string,
  snapshotJson: string,
  bindingsJson: string,
) => string;
type RenderCounterBodyFn = (message: string) => string;
type RenderSpiralBodyFn = () => string;
type RenderSpiralDocumentFn = () => string;
type RenderSpiralBodyFromTilesFn = (tiles: Array<{ x: number; y: number }>) => string;

let renderBodyFromIrFn: RenderBodyFromIrFn | null = null;

function requireRenderBodyFromIr(): RenderBodyFromIrFn {
  if (!renderBodyFromIrFn) {
    const mod = getLuxelCoreNodeModule();
    const fn = mod?.renderBodyFromIr;
    if (typeof fn !== "function") {
      throw new Error("luxel-core renderBodyFromIr unavailable — run bench:ensure-core-node");
    }
    renderBodyFromIrFn = fn as RenderBodyFromIrFn;
  }
  return renderBodyFromIrFn;
}

function requireRenderCounterBody(): RenderCounterBodyFn {
  const mod = getLuxelCoreNodeModule();
  const fn = mod?.renderCounterBody;
  if (typeof fn !== "function") {
    throw new Error("luxel-core renderCounterBody unavailable — run bench:ensure-core-node");
  }
  return fn as RenderCounterBodyFn;
}

function counterMessageFromStore(store: ResourceStore, bindings: readonly TemplateBinding[]): string {
  const messageBinding = bindings.find((binding) => binding.field === "message");
  const key = messageBinding?.resourceKey ?? "route:index:message";
  const value = store.get(key) as { message?: string } | undefined;
  const message = value?.message;
  if (typeof message !== "string") {
    throw new Error(`missing counter message at ${key}`);
  }
  return message;
}

export function renderCounterNativeBody(
  store: ResourceStore,
  bindings: readonly TemplateBinding[],
): string {
  return requireRenderCounterBody()(counterMessageFromStore(store, bindings));
}

function spiralTilesFromStore(store: ResourceStore, bindings: readonly TemplateBinding[]): Array<{ x: number; y: number }> {
  const tileBinding = bindings.find((binding) => binding.field === "tiles" || binding.templateId === "tiles");
  const key = tileBinding?.resourceKey ?? "route:index:tiles";
  const tiles = store.get(key);
  if (!Array.isArray(tiles)) {
    throw new Error(`missing spiral tiles at ${key}`);
  }
  return tiles as Array<{ x: number; y: number }>;
}

function requireRenderSpiralDocument(): RenderSpiralDocumentFn {
  const mod = getLuxelCoreNodeModule();
  const fn = mod?.renderSpiralDocument;
  if (typeof fn !== "function") {
    throw new Error("luxel-core renderSpiralDocument unavailable — run bench:ensure-core-node");
  }
  return fn as RenderSpiralDocumentFn;
}

function requireRenderSpiralBody(): RenderSpiralBodyFn {
  const mod = getLuxelCoreNodeModule();
  const fn = mod?.renderSpiralBody;
  if (typeof fn !== "function") {
    throw new Error("luxel-core renderSpiralBody unavailable — run bench:ensure-core-node");
  }
  return fn as RenderSpiralBodyFn;
}

function requireRenderSpiralBodyFromTiles(): RenderSpiralBodyFromTilesFn {
  const mod = getLuxelCoreNodeModule();
  const fn = mod?.renderSpiralBodyFromTiles;
  if (typeof fn !== "function") {
    throw new Error("luxel-core renderSpiralBodyFromTiles unavailable — run bench:ensure-core-node");
  }
  return fn as RenderSpiralBodyFromTilesFn;
}

export function renderSpiralNativeDocument(
  store: ResourceStore,
  bindings: readonly TemplateBinding[],
  routePath: string,
  headStyle: string,
): string {
  const mod = getLuxelCoreNodeModule();
  if (typeof mod?.renderSpiralDocument === "function") {
    return requireRenderSpiralDocument()();
  }
  const body = renderSpiralNativeBody(store, bindings);
  return createSpiralNativeDocumentRenderer(routePath, headStyle)(body);
}

export function renderSpiralNativeBody(
  store: ResourceStore,
  bindings: readonly TemplateBinding[],
): string {
  const mod = getLuxelCoreNodeModule();
  if (typeof mod?.renderSpiralBody === "function") {
    return requireRenderSpiralBody()();
  }
  return requireRenderSpiralBodyFromTiles()(spiralTilesFromStore(store, bindings));
}

export function renderNativeBodyFromStore(
  store: ResourceStore,
  nativeKind: NativeSsrRouteKind,
  _renderIr: RenderIr,
  bindings: readonly TemplateBinding[],
): string {
  if (nativeKind === "counter") {
    return renderCounterNativeBody(store, bindings);
  }
  if (nativeKind === "spiral") {
    return renderSpiralNativeBody(store, bindings);
  }
  throw new Error(
    "native hot paths require route-specific kernels (counter or spiral); generic renderBodyFromIr is not allowed",
  );
}

export function renderNativeDocumentFromStore(
  store: ResourceStore,
  nativeKind: NativeSsrRouteKind,
  renderIr: RenderIr,
  bindings: readonly TemplateBinding[],
  renderDoc: (body: string, store: ResourceStore) => string,
  routePath: string,
): string {
  const body = renderNativeBodyFromStore(store, nativeKind, renderIr, bindings);
  if (nativeKind === "spiral") {
    const body = renderSpiralNativeBody(store, bindings);
    return createSpiralNativeDocumentRenderer(routePath, renderIr.headStyle)(body);
  }
  return renderDoc(body, store);
}

/** Lab / legacy only — not used on counter or spiral native hot paths. */
export function renderBodyFromStore(
  store: ResourceStore,
  renderIr: RenderIr,
  bindings: readonly TemplateBinding[],
): string {
  return requireRenderBodyFromIr()(
    JSON.stringify(renderIr),
    JSON.stringify(store.snapshot()),
    JSON.stringify(bindings),
  );
}

/** @deprecated use renderBodyFromStore */
export function renderCounterBodyFromStore(
  store: ResourceStore,
  renderIr: RenderIr,
  bindings: readonly TemplateBinding[],
): string {
  return renderBodyFromStore(store, renderIr, bindings);
}

export function assertDeprecatedRouteNapiGone(): void {
  const mod = getLuxelCoreNodeModule();
  if (!mod) return;
  const cases: Array<{ name: string; invoke: () => void }> = [
    {
      name: "renderSpiralRouteFromStore",
      invoke: () => (mod.renderSpiralRouteFromStore as (json: string) => string)("{}"),
    },
    {
      name: "renderSpiralRouteFromTiles",
      invoke: () => (mod.renderSpiralRouteFromTiles as (tiles: unknown[]) => string)([]),
    },
    {
      name: "renderCounterBodyFromStore",
      invoke: () => (mod.renderCounterBodyFromStore as (json: string) => string)("{}"),
    },
  ];
  for (const { name, invoke } of cases) {
    if (typeof mod[name] !== "function") continue;
    try {
      invoke();
      throw new Error(`expected ${name} to throw`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("deprecated") && !msg.includes("renderBodyFromIr")) {
        throw new Error(`${name} error missing deprecation hint: ${msg}`);
      }
    }
  }
}
