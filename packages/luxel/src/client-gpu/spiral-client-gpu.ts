import {
  computeSpiralLayoutCoords,
  type SpiralLayoutOptions,
  type SpiralLayoutResult,
} from "./spiral-layout.ts";
import { SPIRAL_LAYOUT_CELL } from "./spiral-layout-cpu.ts";

export function applySpiralLayoutCoordsToDom(
  wrapper: HTMLElement,
  coords: Float64Array,
  cellSize = SPIRAL_LAYOUT_CELL,
): number {
  const tileCount = coords.length / 2;

  while (wrapper.children.length > tileCount) {
    wrapper.lastElementChild?.remove();
  }

  for (let i = 0; i < tileCount; i++) {
    let tile = wrapper.children[i] as HTMLElement | undefined;
    if (!tile) {
      tile = document.createElement("div");
      tile.className = "tile";
      wrapper.appendChild(tile);
    }
    const x = coords[i * 2]!;
    const y = coords[i * 2 + 1]!;
    tile.style.position = "absolute";
    tile.style.left = `${x.toFixed(2)}px`;
    tile.style.top = `${y.toFixed(2)}px`;
    tile.style.width = `${cellSize}px`;
    tile.style.height = `${cellSize}px`;
  }

  return tileCount;
}

export type SpiralClientGpuHydrationResult = SpiralLayoutResult & {
  appliedTiles: number;
};

export async function hydrateSpiralClientGpuLayout(
  wrapper: HTMLElement,
  options: SpiralLayoutOptions,
): Promise<SpiralClientGpuHydrationResult> {
  const result = await computeSpiralLayoutCoords(options);
  const appliedTiles = applySpiralLayoutCoordsToDom(wrapper, result.coords);
  wrapper.dataset.luxelGpuBackend = result.metrics.backend;
  return { ...result, appliedTiles };
}
