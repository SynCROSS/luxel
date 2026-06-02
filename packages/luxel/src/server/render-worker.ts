import { load, renderSsrDocument, type CounterLoadData } from "../route/counter.ts";

export interface RenderWorker {
  renderIndex(): Promise<{ html: string; data: CounterLoadData }>;
}

export function createRenderWorker(): RenderWorker {
  return {
    async renderIndex() {
      const data = await load();
      const html = renderSsrDocument(data);
      return { html, data };
    },
  };
}
