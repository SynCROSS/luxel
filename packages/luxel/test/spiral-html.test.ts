import { describe, expect, test } from "bun:test";
import { renderSpiralDocument, spiralTileCount } from "../src/bench/fixtures/spiral-html.ts";

describe("spiral SSR fixture HTML", () => {
  test("tile count is large CPU-bound workload", () => {
    const count = spiralTileCount();
    expect(count).toBeGreaterThan(4000);
    expect(count).toBeLessThan(5200);
  });

  test("renderSpiralDocument includes wrapper and tiles", () => {
    const html = renderSpiralDocument();
    expect(html).toContain('id="wrapper"');
    expect(html).toContain('class="tile"');
  });
});
