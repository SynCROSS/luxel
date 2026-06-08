import { createElement } from "react";
import { counterDocumentFromBody } from "../fixtures/counter-contract.ts";
import { spiralDocumentFromBody } from "../fixtures/spiral-contract.ts";
import { competitorSource } from "./sources-path.ts";
import { loadSvelteSfcForSsr } from "./compile-svelte-sfc.ts";
import { loadVueSfcForSsr } from "./compile-vue-sfc.ts";

export async function renderReactCounterBody(): Promise<string> {
  const { renderToString } = await import("react-dom/server");
  const { CounterApp } = await import("./sources/counter/react.tsx");
  return renderToString(createElement(CounterApp));
}

export async function renderReactSpiralBody(): Promise<string> {
  const { renderToString } = await import("react-dom/server");
  const { SpiralApp } = await import("./sources/spiral/react.tsx");
  return renderToString(createElement(SpiralApp));
}

export async function renderVueVdomCounterBody(): Promise<string> {
  const { createSSRApp } = await import("vue");
  const { renderToString } = await import("vue/server-renderer");
  const component = await loadVueSfcForSsr(competitorSource("counter", "vue-vdom.vue"), "counter-vue-vdom");
  const app = createSSRApp(component);
  return renderToString(app);
}

export async function renderVueVaporCounterBody(): Promise<string> {
  const { createSSRApp } = await import("vue-vapor");
  const { renderToString } = await import("vue-vapor/server-renderer");
  const component = await loadVueSfcForSsr(competitorSource("counter", "vue-vapor.vue"), "counter-vue-vapor", true);
  const app = createSSRApp(component);
  return renderToString(app);
}

export async function renderVueVdomSpiralBody(): Promise<string> {
  const { createSSRApp } = await import("vue");
  const { renderToString } = await import("vue/server-renderer");
  const component = await loadVueSfcForSsr(competitorSource("spiral", "vue-vdom.vue"), "spiral-vue-vdom");
  const app = createSSRApp(component);
  return renderToString(app);
}

export async function renderVueVaporSpiralBody(): Promise<string> {
  const { createSSRApp } = await import("vue-vapor");
  const { renderToString } = await import("vue-vapor/server-renderer");
  const component = await loadVueSfcForSsr(competitorSource("spiral", "vue-vapor.vue"), "spiral-vue-vapor", true);
  const app = createSSRApp(component);
  return renderToString(app);
}

export async function renderSolidCounterBody(): Promise<string> {
  const { renderToString } = await import("solid-js/web");
  const { CounterApp } = await import("./sources/counter/solid.ts");
  return renderToString(CounterApp) as string;
}

export async function renderSolidSpiralBody(): Promise<string> {
  const { renderToString } = await import("solid-js/web");
  const { SpiralApp } = await import("./sources/spiral/solid.ts");
  return renderToString(SpiralApp) as string;
}

export async function renderSvelteCounterBody(): Promise<string> {
  const render = await loadSvelteSfcForSsr(competitorSource("counter", "svelte.svelte"), "counter");
  return render().body;
}

export async function renderSvelteSpiralBody(): Promise<string> {
  const render = await loadSvelteSfcForSsr(competitorSource("spiral", "svelte.svelte"), "spiral");
  return render().body;
}

export async function renderReactCounterDocument(): Promise<string> {
  return counterDocumentFromBody(await renderReactCounterBody());
}

export async function renderVueVdomCounterDocument(): Promise<string> {
  return counterDocumentFromBody(await renderVueVdomCounterBody());
}

export async function renderVueVaporCounterDocument(): Promise<string | null> {
  try {
    return counterDocumentFromBody(await renderVueVaporCounterBody());
  } catch {
    return null;
  }
}

export async function renderSolidCounterDocument(): Promise<string> {
  return counterDocumentFromBody(await renderSolidCounterBody());
}

export async function renderSvelteCounterDocument(): Promise<string> {
  return counterDocumentFromBody(await renderSvelteCounterBody());
}

export async function renderReactSpiralDocument(): Promise<string> {
  return spiralDocumentFromBody(await renderReactSpiralBody());
}

export async function renderVueVdomSpiralDocument(): Promise<string> {
  return spiralDocumentFromBody(await renderVueVdomSpiralBody());
}

export async function renderVueVaporSpiralDocument(): Promise<string | null> {
  try {
    return spiralDocumentFromBody(await renderVueVaporSpiralBody());
  } catch {
    return null;
  }
}

export async function renderSolidSpiralDocument(): Promise<string> {
  return spiralDocumentFromBody(await renderSolidSpiralBody());
}

export async function renderSvelteSpiralDocument(): Promise<string> {
  return spiralDocumentFromBody(await renderSvelteSpiralBody());
}
