import { ssr, For } from "solid-js/web";

/** Ported from SynCROSS/ssr-performance-showdown solid/client/base.jsx */
export function SpiralApp() {
  const wrapperWidth = 960;
  const wrapperHeight = 720;
  const cellSize = 10;
  const centerX = wrapperWidth / 2;
  const centerY = wrapperHeight / 2;

  let angle = 0;
  let radius = 0;
  const tiles: { x: number; y: number }[] = [];
  const step = cellSize;

  while (radius < Math.min(wrapperWidth, wrapperHeight) / 2) {
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    if (x >= 0 && x <= wrapperWidth - cellSize && y >= 0 && y <= wrapperHeight - cellSize) {
      tiles.push({ x, y });
    }

    angle += 0.2;
    radius += step * 0.015;
  }

  return ssr`<div id="wrapper">${For({
    each: tiles,
    children: ({ x, y }) =>
      ssr`<div class="tile" style="left:${x.toFixed(2)}px;top:${y.toFixed(2)}px"></div>`,
  })}</div>`;
}
