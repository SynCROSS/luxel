import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { spiralTileCount } from "../src/bench/fixtures/spiral-html.ts";
import { computeSpiralTileCoordsCpu, SPIRAL_LAYOUT_CELL } from "../src/client-gpu/spiral-layout-cpu.ts";
import {
  applySpiralLayoutCoordsToDom,
  hydrateSpiralClientGpuLayout,
} from "../src/client-gpu/spiral-client-gpu.ts";
import { resolveNativeGpuClient } from "../src/config/native-gpu.ts";

function withDom(run: (document: Document) => void): void {
  const window = new Window();
  const doc = window.document;
  (globalThis as { document?: Document }).document = doc;
  try {
    run(doc);
  } finally {
    delete (globalThis as { document?: Document }).document;
  }
}

describe("applySpiralLayoutCoordsToDom", () => {
  test("creates positioned tile elements from coord buffer", () => {
    withDom((document) => {
      const wrapper = document.createElement("div");
      wrapper.id = "wrapper";
      document.body.appendChild(wrapper);

      const coords = computeSpiralTileCoordsCpu().slice(0, 6);
      const applied = applySpiralLayoutCoordsToDom(wrapper, coords);

      expect(applied).toBe(3);
      expect(wrapper.childNodes.length).toBe(3);
      const first = wrapper.childNodes[0] as HTMLElement;
      expect(first.style.left).toContain(`${coords[0]!.toFixed(0)}`);
      expect(first.style.top).toContain(`${coords[1]!.toFixed(0)}`);
      expect(first.style.width).toBe(`${SPIRAL_LAYOUT_CELL}px`);
    });
  });
});

describe("hydrateSpiralClientGpuLayout", () => {
  test("gpu.client off paints full spiral via cpu backend", async () => {
    await withDomAsync(async (document) => {
      const wrapper = document.createElement("div");
      wrapper.id = "wrapper";
      document.body.appendChild(wrapper);

      const result = await hydrateSpiralClientGpuLayout(wrapper, {
        gpu: resolveNativeGpuClient({ client: "off" }),
        capabilities: { webgpu: false, webgl: false },
      });

      expect(result.metrics.backend).toBe("cpu");
      expect(result.appliedTiles).toBe(spiralTileCount());
      expect(wrapper.childNodes.length).toBe(spiralTileCount());
      expect(wrapper.dataset.luxelGpuBackend).toBe("cpu");
    });
  });
});

async function withDomAsync(run: (document: Document) => Promise<void>): Promise<void> {
  const window = new Window();
  const doc = window.document;
  (globalThis as { document?: Document }).document = doc;
  try {
    await run(doc);
  } finally {
    delete (globalThis as { document?: Document }).document;
  }
}
