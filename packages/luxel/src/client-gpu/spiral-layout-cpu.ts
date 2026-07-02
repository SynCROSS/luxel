export const SPIRAL_LAYOUT_WIDTH = 960;
export const SPIRAL_LAYOUT_HEIGHT = 720;
export const SPIRAL_LAYOUT_CELL = 10;

/** Platformatic spiral coords — CPU source of truth for client GPU parity. */
export function computeSpiralTileCoordsCpu(
  width = SPIRAL_LAYOUT_WIDTH,
  height = SPIRAL_LAYOUT_HEIGHT,
  cellSize = SPIRAL_LAYOUT_CELL,
): Float64Array {
  const limit = Math.min(width, height) / 2;
  const centerX = width / 2;
  const centerY = height / 2;
  const pairs: number[] = [];
  let angle = 0;
  let radius = 0;
  while (radius < limit) {
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    if (x >= 0 && x <= width - cellSize && y >= 0 && y <= height - cellSize) {
      pairs.push(x, y);
    }
    angle += 0.2;
    radius += cellSize * 0.015;
  }
  return new Float64Array(pairs);
}

export function spiralTileCountFromCoords(coords: Float64Array): number {
  return coords.length / 2;
}

/** Mirrors WGSL f32 spiral kernel — WebGPU parity reference, not bench double CPU. */
export function computeSpiralTileCoordsCpuF32(
  width = SPIRAL_LAYOUT_WIDTH,
  height = SPIRAL_LAYOUT_HEIGHT,
  cellSize = SPIRAL_LAYOUT_CELL,
): Float64Array {
  const f32 = Math.fround;
  const limit = f32(Math.min(width, height) / 2);
  const centerX = f32(width / 2);
  const centerY = f32(height / 2);
  const step = f32(cellSize * 0.015);
  const maxX = f32(width - cellSize);
  const maxY = f32(height - cellSize);
  const pairs: number[] = [];
  let angle = f32(0);
  let radius = f32(0);
  while (radius < limit) {
    const x = f32(centerX + f32(Math.cos(angle) * radius));
    const y = f32(centerY + f32(Math.sin(angle) * radius));
    if (x >= 0 && x <= maxX && y >= 0 && y <= maxY) {
      pairs.push(x, y);
    }
    angle = f32(angle + 0.2);
    radius = f32(radius + step);
  }
  return new Float64Array(pairs);
}
