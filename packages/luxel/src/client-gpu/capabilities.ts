import type { GpuCapabilities } from "../config/native-gpu.ts";

export type ClientGpuBackend = "cpu" | "webgpu" | "webgl";

export type ClientGpuMetrics = {
  backend: ClientGpuBackend;
  warmupMs: number;
  computeMs: number;
  tileCount: number;
};

export function detectClientGpuCapabilities(
  globalObj: typeof globalThis = globalThis,
): GpuCapabilities {
  const nav = (globalObj as { navigator?: { gpu?: unknown } }).navigator;
  const webgpu = typeof nav?.gpu !== "undefined";
  let webgl = false;
  if (typeof (globalObj as { document?: { createElement?: (tag: string) => unknown } }).document
    ?.createElement === "function") {
    const canvas = (
      globalObj as { document: { createElement: (tag: string) => HTMLCanvasElement } }
    ).document.createElement("canvas");
    webgl = Boolean(canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl"));
  }
  return { webgpu, webgl };
}
