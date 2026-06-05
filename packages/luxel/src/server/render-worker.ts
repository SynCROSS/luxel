import type { AppRuntime, AppRoute } from "./app-runtime.ts";
import { createLoadContext } from "../resource-store/load-context.ts";
import { ResourceStore } from "../resource-store/store.ts";
import type { LuxelDataV2 } from "../resource-store/luxel-data.ts";
import { LUXEL_DATA_VERSION } from "../resource-store/luxel-data.ts";
import { streamHtmlDocument } from "../compiler/stream-document.ts";

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

  async function runRoute(route: AppRoute): Promise<{ html: string; data: LuxelDataV2 }> {
    if (route.precomputedHtml && route.precomputedData) {
      return { html: route.precomputedHtml, data: route.precomputedData };
    }

    const ctx = createLoadContext(store, activeSession);
    if (route.prefetch) await route.prefetch(ctx);
    await route.load(ctx);
    const data: LuxelDataV2 = { version: LUXEL_DATA_VERSION, resources: store.snapshot() };
    const html = route.renderFromStore(store);
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
      const data: LuxelDataV2 = { version: LUXEL_DATA_VERSION, resources: store.snapshot() };
      return { stream: route.renderStreamFromStore(store), data };
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
