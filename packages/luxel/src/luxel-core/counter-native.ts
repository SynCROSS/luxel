import type { RenderIr } from "../compiler/render-ir.ts";
import type { TemplateBinding } from "../resource-store/luxel-data.ts";
import type { ResourceStore } from "../resource-store/store.ts";

export function renderCounterBodyFromStore(
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
