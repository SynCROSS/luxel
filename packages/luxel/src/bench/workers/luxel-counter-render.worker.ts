import "../competitors/bench-env.ts";
import { hydrateLuxelBenchApp } from "../hydrate-compiled-app.ts";
import {
  benchWorkerData,
  onBenchWorkerMessage,
  postBenchWorkerResult,
} from "./bench-worker-runtime.ts";

type LuxelCounterWorkerData = {
  genRoot: string;
  benchFullRender?: boolean;
  benchMinimalHtml?: boolean;
  precomputedHtml?: string;
};

const {
  genRoot,
  benchFullRender = false,
  benchMinimalHtml = false,
  precomputedHtml,
} = benchWorkerData<LuxelCounterWorkerData>();

let renderRoute: (() => Promise<string>) | null = null;

async function ensureRenderer(): Promise<() => Promise<string>> {
  if (renderRoute) return renderRoute;

  if (!benchFullRender && precomputedHtml) {
    const cached = precomputedHtml;
    renderRoute = async () => cached;
    return renderRoute;
  }

  const { stripLuxelBenchSidecars } = await import("../strip-bench-html.ts");
  const app = await hydrateLuxelBenchApp(genRoot, { benchFullRender, routePaths: ["/"] });

  if (!benchFullRender) {
    const route = app.getRoute("/");
    if (route?.precomputedHtml) {
      const cached = route.precomputedHtml;
      renderRoute = async () => {
        let html = cached;
        if (benchMinimalHtml) html = stripLuxelBenchSidecars(html);
        return html;
      };
      return renderRoute;
    }
  }

  const { createRenderWorker } = await import("../../server/render-worker.ts");
  const worker = createRenderWorker(app);
  renderRoute = async () => {
    let html = (await worker.render("/")).html;
    if (benchMinimalHtml) html = stripLuxelBenchSidecars(html);
    return html;
  };
  return renderRoute;
}

const hotHtml = !benchFullRender && precomputedHtml ? precomputedHtml : null;

async function onRenderRequest(): Promise<void> {
  await Promise.resolve();
  try {
    if (hotHtml !== null) {
      postBenchWorkerResult({ ok: true });
      return;
    }
    const html = await (await ensureRenderer())();
    postBenchWorkerResult({ ok: true, html });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    postBenchWorkerResult({ ok: false, error: message });
  }
}

onBenchWorkerMessage(onRenderRequest);
