import type { ComponentType } from "react";
import { importPrecompiledReactTsx } from "../competitors/compile-react-tsx.ts";
import { competitorSource } from "../competitors/sources-path.ts";
import { spiralDocumentFromBody } from "../fixtures/spiral-contract.ts";
import { onBenchWorkerMessage, postBenchWorkerResult } from "./bench-worker-runtime.ts";

let spiralApp: ComponentType | null = null;
let renderToStringFn: ((element: unknown) => string) | null = null;

async function getRenderToString(): Promise<(element: unknown) => string> {
  if (renderToStringFn) return renderToStringFn;
  const prevNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  const mod = await import(`react-dom/server?benchWorker=${Date.now()}`);
  process.env.NODE_ENV = "production";
  if (prevNodeEnv !== undefined && prevNodeEnv !== "production") {
    process.env.NODE_ENV = prevNodeEnv;
  }
  const fn = mod.renderToString ?? mod.default?.renderToString;
  if (typeof fn !== "function") {
    throw new Error("react-dom/server missing renderToString in worker");
  }
  renderToStringFn = fn;
  return fn;
}

async function renderOnce(): Promise<void> {
  const renderToString = await getRenderToString();
  const { createElement } = await import("react");
  spiralApp ??= await importPrecompiledReactTsx(competitorSource("spiral", "react.tsx"), "spiral-react");
  renderToString(createElement(spiralApp));
}

onBenchWorkerMessage(async () => {
  try {
    await renderOnce();
    postBenchWorkerResult({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    postBenchWorkerResult({ ok: false, error: message });
  }
});
