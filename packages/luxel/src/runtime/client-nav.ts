import { ResourceStore } from "../resource-store/store.ts";
import {
  isLuxelDataV2,
  projectFromSnapshot,
  type TemplateBinding,
} from "../resource-store/luxel-data.ts";
import { hydrateRoute, type BoundaryModule } from "./hydrate.ts";

function readSidecarFromDocument<T>(doc: Document, id: string): T {
  const el = doc.getElementById(id);
  if (!el?.textContent) throw new Error(`missing sidecar: ${id}`);
  return JSON.parse(el.textContent) as T;
}

function seedStoreFromCurrentDocument(store: ResourceStore): void {
  const raw = readSidecarFromDocument<unknown>(document, "luxel-data");
  if (isLuxelDataV2(raw)) store.mergeSnapshot(raw.resources);
}

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

  const rawData = readSidecarFromDocument<unknown>(doc, "luxel-data");
  const hydration = readSidecarFromDocument<{
    routeId: string;
    bindings?: TemplateBinding[];
    boundaries: Parameters<typeof hydrateRoute>[0]["boundaries"];
  }>(doc, "luxel-hydration");

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
