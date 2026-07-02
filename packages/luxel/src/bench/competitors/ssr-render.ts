import { ensureBenchProductionEnv } from "./bench-env.ts";
import type { ComponentType } from "react";
import { counterDocumentFromBody } from "../fixtures/counter-contract.ts";
import { spiralDocumentFromBody } from "../fixtures/spiral-contract.ts";
import { competitorSource } from "./sources-path.ts";
import { loadReactTsxForSsr } from "./compile-react-tsx.ts";
import { loadSvelteSfcForSsr } from "./compile-svelte-sfc.ts";
import { loadVueSfcForSsr } from "./compile-vue-sfc.ts";
import { loadSolidTsForSsr } from "./compile-solid-ts.ts";

type ReactDomServer = typeof import("react-dom/server");
type ReactRuntime = typeof import("react");
type VueSsr = typeof import("vue/server-renderer");
type VueVaporSsr = typeof import("vue-vapor/server-renderer");
type SolidWeb = typeof import("solid-js/web");

let reactDomServer: ReactDomServer | null = null;
let reactRuntime: ReactRuntime | null = null;
let reactCounterApp: ComponentType | null = null;
let reactSpiralApp: ComponentType | null = null;
let vueSsr: VueSsr | null = null;
let vueVaporSsr: VueVaporSsr | null = null;
let solidWeb: SolidWeb | null = null;
let solidCounterApp: (() => unknown) | null = null;
let solidSpiralApp: (() => unknown) | null = null;

async function getReactRuntime(): Promise<ReactRuntime> {
  ensureBenchProductionEnv();
  reactRuntime ??= await import("react");
  return reactRuntime;
}

async function getReactDomServer(): Promise<ReactDomServer> {
  ensureBenchProductionEnv();
  reactDomServer ??= await import("react-dom/server");
  return reactDomServer;
}

async function getReactCounterApp(): Promise<ComponentType> {
  reactCounterApp ??= await loadReactTsxForSsr(competitorSource("counter", "react.tsx"), "counter-react");
  return reactCounterApp;
}

async function getReactSpiralApp(): Promise<ComponentType> {
  reactSpiralApp ??= await loadReactTsxForSsr(competitorSource("spiral", "react.tsx"), "spiral-react");
  return reactSpiralApp;
}

async function getVueSsr(): Promise<VueSsr> {
  vueSsr ??= await import("vue/server-renderer");
  return vueSsr;
}

async function getVueVaporSsr(): Promise<VueVaporSsr> {
  vueVaporSsr ??= await import("vue-vapor/server-renderer");
  return vueVaporSsr;
}

async function getSolidWeb(): Promise<SolidWeb> {
  solidWeb ??= await import("solid-js/web");
  return solidWeb;
}

async function getSolidCounterApp(): Promise<() => unknown> {
  solidCounterApp ??= await loadSolidTsForSsr(competitorSource("counter", "solid.ts"), "counter-solid");
  return solidCounterApp;
}

async function getSolidSpiralApp(): Promise<() => unknown> {
  solidSpiralApp ??= await loadSolidTsForSsr(competitorSource("spiral", "solid.ts"), "spiral-solid");
  return solidSpiralApp;
}

export async function renderReactCounterBody(): Promise<string> {
  const { createElement } = await getReactRuntime();
  const { renderToString } = await getReactDomServer();
  const CounterApp = await getReactCounterApp();
  return renderToString(createElement(CounterApp));
}

export async function renderReactSpiralBody(): Promise<string> {
  const { createElement } = await getReactRuntime();
  const { renderToString } = await getReactDomServer();
  const SpiralApp = await getReactSpiralApp();
  return renderToString(createElement(SpiralApp));
}

export async function renderVueVdomCounterBody(): Promise<string> {
  const { createSSRApp } = await import("vue");
  const { renderToString } = await getVueSsr();
  const component = await loadVueSfcForSsr(competitorSource("counter", "vue-vdom.vue"), "counter-vue-vdom");
  const app = createSSRApp(component);
  return renderToString(app);
}

export async function renderVueVaporCounterBody(): Promise<string> {
  const { createSSRApp } = await import("vue-vapor");
  const { renderToString } = await getVueVaporSsr();
  const component = await loadVueSfcForSsr(competitorSource("counter", "vue-vapor.vue"), "counter-vue-vapor", true);
  const app = createSSRApp(component);
  return renderToString(app);
}

export async function renderVueVdomSpiralBody(): Promise<string> {
  const { createSSRApp } = await import("vue");
  const { renderToString } = await getVueSsr();
  const component = await loadVueSfcForSsr(competitorSource("spiral", "vue-vdom.vue"), "spiral-vue-vdom");
  const app = createSSRApp(component);
  return renderToString(app);
}

export async function renderVueVaporSpiralBody(): Promise<string> {
  const { createSSRApp } = await import("vue-vapor");
  const { renderToString } = await getVueVaporSsr();
  const component = await loadVueSfcForSsr(competitorSource("spiral", "vue-vapor.vue"), "spiral-vue-vapor", true);
  const app = createSSRApp(component);
  return renderToString(app);
}

export async function renderSolidCounterBody(): Promise<string> {
  const { renderToString } = await getSolidWeb();
  const CounterApp = await getSolidCounterApp();
  return renderToString(CounterApp) as string;
}

export async function renderSolidSpiralBody(): Promise<string> {
  const { renderToString } = await getSolidWeb();
  const SpiralApp = await getSolidSpiralApp();
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
