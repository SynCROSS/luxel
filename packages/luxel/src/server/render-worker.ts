import type { CompiledApp } from "../route/compile-app.ts";
import type { CompiledRoute } from "../compiler/compile-route.ts";
import { createLoadContext } from "../resource-store/load-context.ts";
import { ResourceStore } from "../resource-store/store.ts";

export interface RenderWorker {
  render(path: string): Promise<{ html: string; data: Record<string, unknown> }>;
  renderStream(path: string): Promise<{ stream: ReadableStream<Uint8Array>; data: Record<string, unknown> }>;
  renderIndex(): Promise<{ html: string; data: Record<string, unknown> }>;
  /** Server-only: invalidate resources by tag (phase 1). */
  revalidateTag(tag: string): void;
  getStore(): ResourceStore;
}

export function createRenderWorker(app: CompiledApp): RenderWorker {
  const store = new ResourceStore();

  async function runRouteLoad(route: CompiledRoute): Promise<Record<string, unknown>> {
    const ctx = createLoadContext(store);
    return route.load(ctx);
  }

  return {
    async render(path) {
      const route = app.getRoute(path);
      if (!route) throw new Error(`unknown route: ${path}`);
      const data = await runRouteLoad(route);
      return { html: route.renderDocument(data), data };
    },
    async renderStream(path) {
      const route = app.getRoute(path);
      if (!route) throw new Error(`unknown route: ${path}`);
      const data = await runRouteLoad(route);
      return { stream: route.renderStream(data), data };
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
  };
}
