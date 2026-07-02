import { createRenderdClient } from "../../src/renderd/client.ts";
import { spiralTileCount } from "../../src/bench/fixtures/spiral-html.ts";

const SPIRAL_HEAD_STYLE = `#wrapper { position: relative; width: 960px; height: 720px; }
.tile { position: absolute; width: 10px; height: 10px; background: #333; }`;

const client = await createRenderdClient({ childRuntime: "node" });
try {
  const html = await client.renderSpiralDocument("/", SPIRAL_HEAD_STYLE);
  if (!html.includes('id="wrapper"')) {
    throw new Error("renderd spiral missing wrapper under deno host");
  }
  if (html.match(/class="tile"/g)?.length !== spiralTileCount()) {
    throw new Error("renderd spiral tile count mismatch under deno host");
  }
  console.log("renderd-deno-child:ok");
} finally {
  await client.close();
}
