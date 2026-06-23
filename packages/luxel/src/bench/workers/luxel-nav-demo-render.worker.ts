import "../competitors/bench-env.ts";
import { hydrateLuxelBenchApp } from "../hydrate-compiled-app.ts";
import { benchWorkerData, onBenchWorkerMessage, postBenchWorkerResult } from "./bench-worker-runtime.ts";

type LuxelNavDemoWorkerData = {
  genRoot: string;
};

const { genRoot } = benchWorkerData<LuxelNavDemoWorkerData>();

let renderRoute: (() => Promise<string>) | null = null;

async function ensureRenderer(): Promise<() => Promise<string>> {
  if (renderRoute) return renderRoute;
  const { createRenderWorker } = await import("../../server/render-worker.ts");
  const app = await hydrateLuxelBenchApp(genRoot);
  const worker = createRenderWorker(app);
  renderRoute = async () => (await worker.render("/")).html;
  return renderRoute;
}

onBenchWorkerMessage(async () => {
  try {
    const render = await ensureRenderer();
    const html = await render();
    postBenchWorkerResult({ ok: true, html });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    postBenchWorkerResult({ ok: false, error: message });
  }
});
