import { beforeAll, describe, expect, test } from "bun:test";
import { ensureCoreNodeBuilt } from "./helpers/ensure-core-node.ts";
import { createRenderdClient } from "../src/renderd/client.ts";
import { renderSpiralBenchDocument } from "../src/renderd/renderd-entry.ts";
import { spiralTileCount } from "../src/bench/fixtures/spiral-html.ts";

const SPIRAL_HEAD_STYLE = `#wrapper {
  position: relative;
  width: 960px;
  height: 720px;
}
.tile {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #333;
}`;

describe("luxel-renderd spiral IPC", () => {
  beforeAll(() => ensureCoreNodeBuilt(), 300_000);

  test("renderd child renders platformatic spiral document", () => {
    const html = renderSpiralBenchDocument("/", SPIRAL_HEAD_STYLE);
    expect(html).toContain('id="wrapper"');
    expect(html.match(/class="tile"/g)?.length).toBe(spiralTileCount());
  });

  test("renderd client matches inline native spiral document", async () => {
    const client = await createRenderdClient();
    try {
      const fromRenderd = await client.renderSpiralDocument("/", SPIRAL_HEAD_STYLE);
      const inline = renderSpiralBenchDocument("/", SPIRAL_HEAD_STYLE);
      expect(fromRenderd).toBe(inline);
    } finally {
      await client.close();
    }
  }, 180_000);
});
