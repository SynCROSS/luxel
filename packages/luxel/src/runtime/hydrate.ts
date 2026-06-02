import { readJsonSidecar } from "./sidecar.ts";
import type { BoundaryModule } from "./hydrate-types.ts";
import { findBoundaryHostElement } from "./boundary-host.ts";

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
  const data = readJsonSidecar<Record<string, unknown>>("luxel-data");
  const hydration = readJsonSidecar<{
    routeId: string;
    boundaries: HydrateRouteOptions["boundaries"];
  }>("luxel-hydration");

  hydrateRoute({
    routeId: hydration.routeId,
    data,
    boundaries: hydration.boundaries,
    modules,
  });
}
