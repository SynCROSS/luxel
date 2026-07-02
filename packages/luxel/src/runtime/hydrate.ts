import { readJsonSidecar } from "./sidecar.ts";
import type { BoundaryModule } from "./hydrate-types.ts";
import { findBoundaryHostElement } from "./boundary-host.ts";
import {
  isLuxelDataV2,
  projectFromSnapshot,
  type LuxelDataV2,
  type LuxelHydrationPayload,
  type TemplateBinding,
} from "../resource-store/luxel-data.ts";
import { ingestLuxelDataSidecarText } from "../schema/sidecar-ingest.ts";

export type { BoundaryModule } from "./hydrate-types.ts";
export type HydrateRouteOptions = {
  routeId: string;
  data: Record<string, unknown>;
  boundaries: Array<{
    id: string;
    directive: string;
    clientModule: string;
  }>;
  modules: Record<string, BoundaryModule>;
};

function readLuxelDataSidecarElement(root: Document | ParentNode = document): string {
  const el =
    "getElementById" in root && typeof root.getElementById === "function"
      ? root.getElementById("luxel-data")
      : root.querySelector('[id="luxel-data"]');
  if (!el) throw new Error("sidecar #luxel-data not found");
  const text = el.textContent?.trim();
  if (!text) throw new Error("sidecar #luxel-data empty");
  return text;
}

export function readLuxelDataSidecar(
  hydration: Pick<LuxelHydrationPayload, "bindings" | "thirdPartySchema">,
  root: Document | ParentNode = document,
): LuxelDataV2 {
  return ingestLuxelDataSidecarText(readLuxelDataSidecarElement(root), {
    bindings: hydration.bindings,
    thirdPartySchema: hydration.thirdPartySchema,
  });
}

/** @deprecated use readLuxelDataSidecar */
export function readTrustedLuxelDataSidecar(
  bindings: readonly TemplateBinding[],
  root: Document | ParentNode = document,
) {
  return readLuxelDataSidecar({ bindings }, root);
}

export function hydrateRoute(options: HydrateRouteOptions): void {
  const mod = options.modules[options.routeId];
  if (!mod) throw new Error(`no module for route ${options.routeId}`);

  const { attach } = mod.setupBoundary({ data: options.data });

  for (const boundary of options.boundaries) {
    const host =
      findBoundaryHostElement(document.body, boundary.id) ??
      findBoundaryHostElement(document.documentElement, boundary.id);
    if (!host) {
      throw new Error(`boundary host not found: ${boundary.id}`);
    }
    attach(host);
  }
}

export function hydrateFromDocument(modules: Record<string, BoundaryModule>): void {
  const hydration = readJsonSidecar<LuxelHydrationPayload>("luxel-hydration");
  const rawData = readLuxelDataSidecar(hydration);
  const bindings = hydration.bindings ?? [];
  const data = isLuxelDataV2(rawData)
    ? projectFromSnapshot(rawData.resources, bindings)
    : (rawData as Record<string, unknown>);

  hydrateRoute({
    routeId: hydration.routeId,
    data,
    boundaries: hydration.boundaries,
    modules,
  });
}
