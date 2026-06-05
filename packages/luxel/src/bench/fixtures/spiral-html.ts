/** Platformatic SSR showdown-style spiral (~2.4k tiles). Shared by future tier-2 benches. */
export function spiralTileCount(width = 960, height = 720, cellSize = 5): number {
  let count = 0;
  let angle = 0;
  let radius = 0;
  const step = cellSize;
  while (radius < Math.min(width, height) / 2) {
    const centerX = width / 2;
    const centerY = height / 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    if (x >= 0 && x <= width - cellSize && y >= 0 && y <= height - cellSize) count++;
    angle += 0.2;
    radius += step * 0.015;
  }
  return count;
}

export function renderSpiralDocument(): string {
  const width = 960;
  const height = 720;
  const cellSize = 5;
  const tiles: string[] = [];
  let angle = 0;
  let radius = 0;
  const step = cellSize;
  while (radius < Math.min(width, height) / 2) {
    const centerX = width / 2;
    const centerY = height / 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    if (x >= 0 && x <= width - cellSize && y >= 0 && y <= height - cellSize) {
      tiles.push(
        `<div class="tile" style="left:${x.toFixed(2)}px;top:${y.toFixed(2)}px"></div>`,
      );
    }
    angle += 0.2;
    radius += step * 0.015;
  }
  return `<!doctype html><html><head><style>
#wrapper{position:relative;width:${width}px;height:${height}px}
.tile{position:absolute;width:10px;height:10px;background:#333}
</style></head><body><div id="wrapper">${tiles.join("")}</div></body></html>`;
}
