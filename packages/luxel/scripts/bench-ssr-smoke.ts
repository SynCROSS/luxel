import {
  renderReactCounterDocument,
  renderVueVdomCounterDocument,
  renderVueVaporCounterDocument,
  renderSvelteCounterDocument,
  renderSolidCounterDocument,
  renderReactSpiralDocument,
  renderVueVdomSpiralDocument,
  renderVueVaporSpiralDocument,
  renderSvelteSpiralDocument,
  renderSolidSpiralDocument,
} from "../src/bench/competitors/ssr-render.ts";

const cases: [string, () => Promise<string | null>][] = [
  ["react-counter", renderReactCounterDocument],
  ["vue-counter", renderVueVdomCounterDocument],
  ["vue-vapor-counter", renderVueVaporCounterDocument],
  ["svelte-counter", renderSvelteCounterDocument],
  ["solid-counter", renderSolidCounterDocument],
  ["react-spiral", renderReactSpiralDocument],
  ["vue-spiral", renderVueVdomSpiralDocument],
  ["vue-vapor-spiral", renderVueVaporSpiralDocument],
  ["svelte-spiral", renderSvelteSpiralDocument],
  ["solid-spiral", renderSolidSpiralDocument],
];

for (const [name, render] of cases) {
  const html = await render();
  if (!html) {
    console.log(name, "SKIP");
    continue;
  }
  const tiles = html.match(/class="tile"/g)?.length ?? 0;
  const counterOk = html.includes('data-luxel-text="count"') && html.includes(">0<");
  console.log(name, tiles ? `tiles=${tiles}` : counterOk ? "counter-ok" : "FAIL");
}
