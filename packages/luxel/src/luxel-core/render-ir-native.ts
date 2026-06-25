import type { RenderIr } from "../compiler/render-ir.ts";
import type { TemplateBinding } from "../resource-store/luxel-data.ts";
import type { ResourceStore } from "../resource-store/store.ts";

export function renderBodyFromStore(
  store: ResourceStore,
  renderIr: RenderIr,
  bindings: readonly TemplateBinding[],
): string {
  const { renderBodyFromIr } = require("@luxel/core-node") as {
    renderBodyFromIr: (renderIrJson: string, snapshotJson: string, bindingsJson: string) => string;
  };
  return renderBodyFromIr(
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
  const mod = require("@luxel/core-node") as Record<string, unknown>;
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
