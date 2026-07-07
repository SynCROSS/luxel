import type { AppRuntime, AppRoute } from "./app-runtime.ts";
import { createLoadContext } from "../resource-store/load-context.ts";
import { ResourceStore } from "../resource-store/store.ts";
import type { LuxelDataV2 } from "../resource-store/luxel-data.ts";
import { LUXEL_DATA_VERSION } from "../resource-store/luxel-data.ts";
import { streamHtmlDocument } from "../compiler/stream-document.ts";
import { createRenderdClient, type RenderdClient } from "../renderd/client.ts";

export interface RenderWorker {
  render(path: string): Promise<{ html: string; data: LuxelDataV2 }>;
  renderBytes(path: string): Promise<{ body: Uint8Array; data: LuxelDataV2 }>;
  renderStream(path: string): Promise<{ stream: ReadableStream<Uint8Array>; data: LuxelDataV2 }>;
  renderIndex(): Promise<{ html: string; data: LuxelDataV2 }>;
  revalidateTag(tag: string): void;
  getStore(): ResourceStore;
  setSession(session: import("../resource-store/load-context.ts").LoadSession | null): void;
}

type RenderResult = { html: string; data: LuxelDataV2; body?: Uint8Array };
type RenderCacheInput = { key: string; generation: number; value: unknown };
type RouteRenderCache = {
  inputs: RenderCacheInput[];
  html: string;
  data: LuxelDataV2;
  body?: Uint8Array;
};

function sameRenderInputs(left: readonly RenderCacheInput[], right: readonly RenderCacheInput[]): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    const a = left[i]!;
    const b = right[i]!;
    if (a.key !== b.key || a.generation !== b.generation || !Object.is(a.value, b.value)) {
      return false;
    }
  }
  return true;
}

export function createRenderWorker(app: AppRuntime): RenderWorker {
  const store = new ResourceStore();
  const encoder = new TextEncoder();
  let activeSession: import("../resource-store/load-context.ts").LoadSession | null = null;
  let renderdClient: RenderdClient | null = null;
  const renderCache = new Map<string, RouteRenderCache>();

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

  function captureRenderCacheInputs(route: AppRoute): RenderCacheInput[] | null {
    if (activeSession) return null;
    const inputs: RenderCacheInput[] = [];
    for (const binding of route.bindings) {
      const entry = store.getEntry(binding.resourceKey);
      if (!entry) return null;
      inputs.push({
        key: binding.resourceKey,
        generation: entry.generation,
        value: entry.value,
      });
    }
    return inputs;
  }

  async function runRoute(route: AppRoute, useRenderCache = false): Promise<RenderResult> {
    if (route.precomputedHtml && route.precomputedData) {
      return { html: route.precomputedHtml, data: route.precomputedData };
    }

    const ctx = createLoadContext(store, activeSession);
    if (route.prefetch) await route.prefetch(ctx);
    await route.load(ctx);
    const cacheInputs = useRenderCache ? captureRenderCacheInputs(route) : null;
    if (cacheInputs) {
      const cached = renderCache.get(route.path);
      if (cached && sameRenderInputs(cached.inputs, cacheInputs)) {
        return { html: cached.html, data: cached.data, body: cached.body };
      }
    }
    const data: LuxelDataV2 = routeShipsData(route.path)
      ? { version: LUXEL_DATA_VERSION, resources: store.snapshot() }
      : { version: LUXEL_DATA_VERSION, resources: {} };
    const html = route.spiralRenderd
      ? await renderSpiralViaRenderd(route, routeShipsData(route.path) ? data : undefined)
      : route.renderFromStore(store);
    const body = encoder.encode(html);
    if (cacheInputs) {
      renderCache.set(route.path, { inputs: cacheInputs, html, data, body });
    }
    return { html, data, body };
  }

  return {
    async render(path) {
      const route = app.getRoute(path);
      if (!route) throw new Error(`unknown route: ${path}`);
      const { html, data } = await runRoute(route);
      return { html, data };
    },
    async renderBytes(path) {
      const route = app.getRoute(path);
      if (!route) throw new Error(`unknown route: ${path}`);
      const rendered = await runRoute(route, true);
      let body = rendered.body;
      if (!body) {
        body = encoder.encode(rendered.html);
        const cached = renderCache.get(route.path);
        if (cached && cached.html === rendered.html) {
          cached.body = body;
        }
      }
      return { body, data: rendered.data };
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
