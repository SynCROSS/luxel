/** Luxel SFC for tier-2 spiral — per-request load + {#each} (fairness.md). */
export function buildSpiralLuxelSfc(): string {
  return `<template>
  <div id="wrapper">
    {#each tiles as t}
    <div class="tile" style="left:{t.x}px;top:{t.y}px"></div>
    {/each}
  </div>
</template>

<script>
import { computeSpiralTiles } from "../../../../bench/fixtures/spiral-html.ts";

const SPIRAL_TILES = computeSpiralTiles();

/** Bench: non-static load so compile skips precompute — render worker runs every request. */
export function load(ctx) {
  void ctx.session;
  ctx.store.set("route:index:tiles", SPIRAL_TILES, { tags: ["spiral"] });
}
</script>

<style scoped>
#wrapper {
  position: relative;
  width: 960px;
  height: 720px;
}
.tile {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #333;
}
</style>
`;
}
