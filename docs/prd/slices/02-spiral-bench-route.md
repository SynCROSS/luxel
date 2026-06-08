## Parent

#51

## What to build

Rewrite the tier-2 spiral bench fixture as a fair loop-at-SSR Luxel route: `load()` writes `computeSpiralTiles()` to the resource store each request; template uses `{#each tiles as t}` … `{/each}` with tile `div` and `left`/`top` style bindings; compiler emits `.toFixed(2)` on numeric coordinates in the loop body.

Remove the generated static ~2.4k-`div` SFC expansion. Spiral must render via render worker every request (no compile-time HTML precompute). Output must match shared tile count from spiral tile math module.

WinRK `luxel-spiral-ssr` RPS should improve materially from ~394 baseline (full ≤1.08 gate verified in slice 5).

## Acceptance criteria

- [ ] `examples/spiral` uses `load` + store + `{#each tiles as t}` — not static tile markup bake
- [ ] Rendered HTML contains `#wrapper` and `spiral_tile_count` matching `spiral-html.ts`
- [ ] Generated loop codegen includes `.toFixed(2)` for left/top style coords
- [ ] `spiral-bench.test` and `spiral-html.test` pass
- [ ] WinRK `luxel-spiral-ssr` RPS significantly above pre-Phase-0 baseline (~394)

## Blocked by

- #52
