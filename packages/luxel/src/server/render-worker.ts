import type { CompiledApp } from "../route/compile-app.ts";
export interface RenderWorker {
  render(path: string): Promise<{ html: string; data: Record<string, unknown> }>;
  renderStream(path: string): Promise<{ stream: ReadableStream<Uint8Array>; data: Record<string, unknown> }>;
  renderIndex(): Promise<{ html: string; data: Record<string, unknown> }>;
}

export function createRenderWorker(app: CompiledApp): RenderWorker {
  return {
    async render(path) {
      const route = app.getRoute(path);
      if (!route) throw new Error(`unknown route: ${path}`);
      const data = await route.load();
      return { html: route.renderDocument(data), data };
    },
    async renderStream(path) {
      const route = app.getRoute(path);
      if (!route) throw new Error(`unknown route: ${path}`);
      const data = await route.load();
      return { stream: route.renderStream(data), data };
    },
    async renderIndex() {
      return this.render("/");
    },
  };
}
