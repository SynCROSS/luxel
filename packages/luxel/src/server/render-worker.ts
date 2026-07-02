import type { AppRuntime, AppRoute } from "./app-runtime.ts";
import { createLoadContext } from "../resource-store/load-context.ts";
import { ResourceStore } from "../resource-store/store.ts";
import type { LuxelDataV2 } from "../resource-store/luxel-data.ts";
import { LUXEL_DATA_VERSION } from "../resource-store/luxel-data.ts";
import { streamHtmlDocument } from "../compiler/stream-document.ts";
import { createRenderdClient, type RenderdClient } from "../renderd/client.ts";

export interface RenderWorker {
  render(path: string): Promise<{ html: string; data: LuxelDataV2 }>;
  renderStream(path: string): Promise<{ stream: ReadableStream<Uint8Array>; data: LuxelDataV2 }>;
  renderIndex(): Promise<{ html: string; data: LuxelDataV2 }>;
  revalidateTag(tag: string): void;
  getStore(): ResourceStore;
  setSession(session: import("../resource-store/load-context.ts").LoadSession | null): void;
}

export function createRenderWorker(app: AppRuntime): RenderWorker {
  const store = new ResourceStore();
  let activeSession: import("../resource-store/load-context.ts").LoadSession | null = null;
  let renderdClient: RenderdClient | null = null;

  async function getRenderdClient(): Promise<RenderdClient> {
    if (!renderdClient) {
      renderdClient = await createRenderdClient();
    }
    return renderdClient;
  }

  async function renderSpiralViaRenderd(route: AppRoute, data?: LuxelDataV2): Promise<string> {
    if (!route.spiralRenderd) {
      throw new Error("renderSpiralViaRenderd requires spiralRenderd metadata");
    }
    const client = await getRenderdClient();
    if (data && Object.keys(data.resources).length > 0) {
      await client.streamLuxelData(data);
    }
    return client.renderSpiralDocument(route.spiralRenderd.routePath, route.spiralRenderd.headStyle);
  }

  function routeShipsData(path: string): boolean {
    const manifestRoute = app.manifest.routes.find((route) => route.path === path);
    return manifestRoute?.shipSidecars?.data === true;
  }

  async function runRoute(route: AppRoute): Promise<{ html: string; data: LuxelDataV2 }> {
    if (route.precomputedHtml && route.precomputedData) {
      return { html: route.precomputedHtml, data: route.precomputedData };
    }

    const ctx = createLoadContext(store, activeSession);
    if (route.prefetch) await route.prefetch(ctx);
    await route.load(ctx);
    const data: LuxelDataV2 = routeShipsData(route.path)
      ? { version: LUXEL_DATA_VERSION, resources: store.snapshot() }
      : { version: LUXEL_DATA_VERSION, resources: {} };
    const html = route.spiralRenderd
      ? await renderSpiralViaRenderd(route, routeShipsData(route.path) ? data : undefined)
      : route.renderFromStore(store);
    return { html, data };
  }

  return {
    async render(path) {
      const route = app.getRoute(path);
      if (!route) throw new Error(`unknown route: ${path}`);
      return runRoute(route);
    },
    async renderStream(path) {
      const route = app.getRoute(path);
      if (!route) throw new Error(`unknown route: ${path}`);
      if (route.precomputedHtml && route.precomputedData) {
        return {
          stream: streamHtmlDocument(route.precomputedHtml),
          data: route.precomputedData,
        };
      }
      const ctx = createLoadContext(store, activeSession);
      if (route.prefetch) await route.prefetch(ctx);
      await route.load(ctx);
      const data: LuxelDataV2 = routeShipsData(path)
        ? { version: LUXEL_DATA_VERSION, resources: store.snapshot() }
        : { version: LUXEL_DATA_VERSION, resources: {} };
      const stream = route.spiralRenderd
        ? streamHtmlDocument(await renderSpiralViaRenderd(route, routeShipsData(path) ? data : undefined))
        : route.renderStreamFromStore(store);
      return { stream, data };
    },
    async renderIndex() {
      return this.render("/");
    },
    revalidateTag(tag) {
      store.revalidateTag(tag);
    },
    getStore() {
      return store;
    },
    setSession(session) {
      activeSession = session;
    },
  };
}
