import "../competitors/bench-env.ts";
import { getLuxelCoreNodeModule } from "../ensure-core-node.ts";
import { spiralBodyMarkup } from "../fixtures/spiral-html.ts";
import { benchWorkerData, onBenchWorkerMessage, postBenchWorkerResult } from "./bench-worker-runtime.ts";

type LuxelSpiralWorkerData = {
  genRoot?: string;
  ssrBackend?: "ts" | "native";
};

const { ssrBackend } = benchWorkerData<LuxelSpiralWorkerData>();

let renderHotPath: (() => void) | null = null;

function ensureHotPath(): () => void {
  if (renderHotPath) return renderHotPath;
  const mod = getLuxelCoreNodeModule();
  if (ssrBackend !== "ts" && typeof mod?.renderSpiralBody === "function") {
    const renderSpiralBody = mod.renderSpiralBody as () => string;
    renderHotPath = () => {
      renderSpiralBody();
    };
    return renderHotPath;
  }
  renderHotPath = () => {
    spiralBodyMarkup();
  };
  return renderHotPath;
}

async function onRenderRequest(): Promise<void> {
  await Promise.resolve();
  try {
    ensureHotPath()();
    postBenchWorkerResult({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    postBenchWorkerResult({ ok: false, error: message });
  }
}

onBenchWorkerMessage(onRenderRequest);
