import type { ResourceStore } from "../resource-store/store.ts";

export function renderSpiralRouteDocumentFromStore(store: ResourceStore): string {
  const { renderSpiralRouteFromStore } = require("@luxel/core-node") as {
    renderSpiralRouteFromStore: (snapshotJson: string) => string;
  };
  return renderSpiralRouteFromStore(JSON.stringify(store.snapshot()));
}
