import "../competitors/bench-env.ts";
import { hydrateLuxelBenchApp } from "../hydrate-compiled-app.ts";
import { benchWorkerData, onBenchWorkerMessage, postBenchWorkerResult } from "./bench-worker-runtime.ts";

type LuxelSpiralWorkerData = {
  genRoot: string;
};

const { genRoot } = benchWorkerData<LuxelSpiralWorkerData>();

let renderRoute: (() => Promise<string>) | null = null;

async function ensureRenderer(): Promise<() => Promise<string>> {
  if (renderRoute) return renderRoute;
  const { createRenderWorker } = await import("../../server/render-worker.ts");
  const app = await hydrateLuxelBenchApp(genRoot);
  const worker = createRenderWorker(app);
  renderRoute = async () => (await worker.render("/")).html;
  return renderRoute;
}

async function onRenderRequest(): Promise<void> {
  await Promise.resolve();
  try {
    const render = await ensureRenderer();
    await render();
    postBenchWorkerResult({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    postBenchWorkerResult({ ok: false, error: message });
  }
}

onBenchWorkerMessage(onRenderRequest);
