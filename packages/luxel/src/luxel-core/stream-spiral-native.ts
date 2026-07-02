import type { TemplateBinding } from "../resource-store/luxel-data.ts";
import type { ResourceStore } from "../resource-store/store.ts";
import { getLuxelCoreNodeModule } from "../bench/ensure-core-node.ts";
import { createSpiralNativeDocumentRenderer, spiralNativeStreamShell } from "./native-route-document.ts";
import { renderSpiralNativeBody } from "./render-ir-native.ts";

const SPIRAL_STREAM_TILES_PER_CHUNK = 128;

type RenderSpiralBodyChunksFn = (tilesPerChunk: number) => string[];

let renderSpiralBodyChunksFn: RenderSpiralBodyChunksFn | null = null;

function requireRenderSpiralBodyChunks(): RenderSpiralBodyChunksFn {
  if (!renderSpiralBodyChunksFn) {
    const mod = getLuxelCoreNodeModule();
    const fn = mod?.renderSpiralBodyChunks;
    if (typeof fn !== "function") {
      throw new Error("luxel-core renderSpiralBodyChunks unavailable — run bench:ensure-core-node");
    }
    renderSpiralBodyChunksFn = fn as RenderSpiralBodyChunksFn;
  }
  return renderSpiralBodyChunksFn;
}

function streamFromBufferedBody(
  renderDoc: (body: string) => string,
  body: string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const html = renderDoc(body);
  const headEnd = html.indexOf("</head>");
  const chunks =
    headEnd >= 0
      ? [html.slice(0, headEnd + "</head>".length), html.slice(headEnd + "</head>".length)]
      : [html];
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

export function streamSpiralNativeDocument(
  store: ResourceStore,
  bindings: readonly TemplateBinding[],
  routePath: string,
  headStyle: string,
): ReadableStream<Uint8Array> {
  const mod = getLuxelCoreNodeModule();
  const renderDoc = createSpiralNativeDocumentRenderer(routePath, headStyle);
  if (typeof mod?.renderSpiralBodyChunks !== "function") {
    return streamFromBufferedBody(renderDoc, renderSpiralNativeBody(store, bindings));
  }

  const bodyChunks = requireRenderSpiralBodyChunks()(SPIRAL_STREAM_TILES_PER_CHUNK);
  const { prefix, suffix } = spiralNativeStreamShell(routePath, headStyle);
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(prefix));
      for (const chunk of bodyChunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.enqueue(encoder.encode(suffix));
      controller.close();
    },
  });
}

export async function countStreamChunks(stream: ReadableStream<Uint8Array>): Promise<number> {
  const reader = stream.getReader();
  let chunks = 0;
  while (true) {
    const { done } = await reader.read();
    if (done) break;
    chunks += 1;
  }
  return chunks;
}
