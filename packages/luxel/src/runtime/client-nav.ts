import { ResourceStore } from "../resource-store/store.ts";
import {
  isLuxelDataV2,
  projectFromSnapshot,
  type LuxelHydrationPayload,
} from "../resource-store/luxel-data.ts";
import { hydrateRoute, readLuxelDataSidecar, type BoundaryModule } from "./hydrate.ts";
import { readJsonSidecar } from "./sidecar.ts";

export function setupClientNav(modules: Record<string, BoundaryModule>): void {
  const store = new ResourceStore();
  seedStoreFromCurrentDocument(store);

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[data-luxel-nav]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("http") || href.startsWith("#")) return;
    event.preventDefault();
    void navigate(href, modules, store);
  });

  window.addEventListener("popstate", () => {
    window.location.reload();
  });

  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.register("/luxel-sw.js", { scope: "/" });
  }

  (globalThis as { __LUXEL_CLIENT_NAV_READY?: boolean }).__LUXEL_CLIENT_NAV_READY = true;
}

function seedStoreFromCurrentDocument(store: ResourceStore): void {
  const hydration = readJsonSidecar<LuxelHydrationPayload>("luxel-hydration");
  const raw = readLuxelDataSidecar(hydration);
  if (isLuxelDataV2(raw)) store.mergeSnapshot(raw.resources);
}

async function navigate(
  path: string,
  modules: Record<string, BoundaryModule>,
  store: ResourceStore,
): Promise<void> {
  const res = await fetch(path, { headers: { accept: "text/html" } });
  if (!res.ok) {
    window.location.assign(path);
    return;
  }
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const incomingMain = doc.querySelector("main[data-luxel-route]");
  const currentMain = document.querySelector("main[data-luxel-route]");
  if (!incomingMain || !currentMain) {
    window.location.assign(path);
    return;
  }
  currentMain.replaceWith(document.importNode(incomingMain, true));

  const hydration = readJsonSidecar<LuxelHydrationPayload>("luxel-hydration", doc);
  const rawData = readLuxelDataSidecar(hydration, doc);

  if (isLuxelDataV2(rawData)) store.mergeSnapshot(rawData.resources);
  const data = isLuxelDataV2(rawData)
    ? projectFromSnapshot(store.snapshot(), hydration.bindings ?? [])
    : (rawData as Record<string, unknown>);

  history.pushState({}, "", path);
  if (hydration.boundaries.length > 0) {
    hydrateRoute({
      routeId: hydration.routeId,
      data,
      boundaries: hydration.boundaries,
      modules,
    });
  }
}
