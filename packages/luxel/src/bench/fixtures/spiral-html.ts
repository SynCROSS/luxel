export type SpiralTile = { x: number; y: number };

const SPIRAL_WIDTH = 960;
const SPIRAL_HEIGHT = 720;
/** SynCROSS / Platformatic step size — https://github.com/SynCROSS/ssr-performance-showdown */
const SPIRAL_CELL = 10;

/** Platformatic SSR showdown spiral positions (~2.4k tiles). */
export function computeSpiralTiles(
  width = SPIRAL_WIDTH,
  height = SPIRAL_HEIGHT,
  cellSize = SPIRAL_CELL,
): SpiralTile[] {
  const tiles: SpiralTile[] = [];
  let angle = 0;
  let radius = 0;
  const step = cellSize;
  const centerX = width / 2;
  const centerY = height / 2;
  while (radius < Math.min(width, height) / 2) {
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    if (x >= 0 && x <= width - cellSize && y >= 0 && y <= height - cellSize) {
      tiles.push({ x, y });
    }
    angle += 0.2;
    radius += step * 0.015;
  }
  return tiles;
}

export function spiralTileCount(
  width = SPIRAL_WIDTH,
  height = SPIRAL_HEIGHT,
  cellSize = SPIRAL_CELL,
): number {
  return computeSpiralTiles(width, height, cellSize).length;
}

export function spiralBodyMarkup(
  width = SPIRAL_WIDTH,
  height = SPIRAL_HEIGHT,
  cellSize = SPIRAL_CELL,
): string {
  const tiles = computeSpiralTiles(width, height, cellSize);
  const inner = tiles
    .map((t) => `<div class="tile" style="left:${t.x.toFixed(2)}px;top:${t.y.toFixed(2)}px"></div>`)
    .join("");
  return `<div id="wrapper">${inner}</div>`;
}

export function renderSpiralDocument(): string {
  return `<!doctype html><html><head><style>
#wrapper{position:relative;width:${SPIRAL_WIDTH}px;height:${SPIRAL_HEIGHT}px}
.tile{position:absolute;width:10px;height:10px;background:#333}
</style></head><body>${spiralBodyMarkup()}</body></html>`;
}
