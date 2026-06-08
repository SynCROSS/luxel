/** @jsxImportSource solid-js */
import { computeSpiralTiles } from "../../../luxel/src/bench/fixtures/spiral-html.ts";

export default function Spiral() {
  const tiles = computeSpiralTiles();
  return (
    <div id="wrapper">
      {tiles.map((t) => (
        <div
          class="tile"
          style={{ left: `${t.x.toFixed(2)}px`, top: `${t.y.toFixed(2)}px` }}
        />
      ))}
    </div>
  );
}
