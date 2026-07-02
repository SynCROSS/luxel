export type GpuClientMode = "auto" | "off" | "strict";

export type NativeGpuConfig = {
  client?: GpuClientMode;
  backend?: "webgpu" | "webgl";
  scope?: "layout-math";
};

export type GpuCapabilities = {
  webgpu: boolean;
  webgl: boolean;
};

export type GpuResourceSample = {
  warmupMs: number;
  computeMs: number;
  cpuComputeMs: number;
  inpProxyMs: number;
  memoryMb: number;
  /** Optional browser Battery API proxy — higher means GPU path costs more than CPU. */
  batteryDrainProxy?: number;
};

export type GpuResourceGate = {
  ok: boolean;
  diagnostics: string[];
};

export type NativeGpuResolution = {
  configured: GpuClientMode;
  effective: "on" | "off";
  diagnostics: string[];
};

export type ManifestGpuDiagnostics = {
  client: GpuClientMode;
  effective: "on" | "off";
  diagnostics: string[];
};

const DEFAULT_CLIENT: GpuClientMode = "auto";

const MAX_WARMUP_MS = 16;
const MAX_INP_PROXY_MS = 200;
const MAX_MEMORY_MB = 48;
const MAX_COMPUTE_REGRESSION_RATIO = 1.25;
const MAX_BATTERY_DRAIN_PROXY = 50;

export function evaluateGpuResourceGates(sample: GpuResourceSample): GpuResourceGate {
  const diagnostics: string[] = [];
  if (sample.warmupMs > MAX_WARMUP_MS) {
    diagnostics.push(`gpu gate: warmup ${sample.warmupMs}ms > ${MAX_WARMUP_MS}ms`);
  }
  if (sample.inpProxyMs > MAX_INP_PROXY_MS) {
    diagnostics.push(`gpu gate: inp proxy ${sample.inpProxyMs}ms > ${MAX_INP_PROXY_MS}ms`);
  }
  if (sample.memoryMb > MAX_MEMORY_MB) {
    diagnostics.push(`gpu gate: memory ${sample.memoryMb}MB > ${MAX_MEMORY_MB}MB`);
  }
  if (sample.computeMs > sample.cpuComputeMs * MAX_COMPUTE_REGRESSION_RATIO) {
    diagnostics.push(
      `gpu gate: compute ${sample.computeMs}ms slower than cpu ${sample.cpuComputeMs}ms`,
    );
  }
  if (sample.batteryDrainProxy !== undefined && sample.batteryDrainProxy > MAX_BATTERY_DRAIN_PROXY) {
    diagnostics.push(
      `gpu gate: battery drain proxy ${sample.batteryDrainProxy} > ${MAX_BATTERY_DRAIN_PROXY}`,
    );
  }
  return { ok: diagnostics.length === 0, diagnostics };
}

export function resolveNativeGpuClient(
  config?: NativeGpuConfig,
  capabilities: GpuCapabilities = { webgpu: false, webgl: false },
  gates: GpuResourceGate = { ok: true, diagnostics: [] },
): NativeGpuResolution {
  const configured = config?.client ?? DEFAULT_CLIENT;
  const diagnostics: string[] = [`gpu.client=${configured}`];

  if (configured === "off") {
    diagnostics.push("client gpu disabled by config");
    return { configured, effective: "off", diagnostics };
  }

  const hasGpu = capabilities.webgpu || capabilities.webgl;
  if (!hasGpu) {
    diagnostics.push("no WebGPU/WebGL capability; cpu fallback");
    if (configured === "strict") {
      diagnostics.push("strict client gpu requires WebGPU or WebGL");
    }
    return { configured, effective: "off", diagnostics };
  }

  if (configured === "auto" && !gates.ok) {
    diagnostics.push("client gpu disabled by resource gates");
    diagnostics.push(...gates.diagnostics);
    return { configured, effective: "off", diagnostics };
  }

  diagnostics.push(capabilities.webgpu ? "WebGPU available" : "WebGL narrow fallback only");
  return { configured, effective: "on", diagnostics };
}

export function toManifestGpuDiagnostics(resolution: NativeGpuResolution): ManifestGpuDiagnostics {
  return {
    client: resolution.configured,
    effective: resolution.effective,
    diagnostics: resolution.diagnostics,
  };
}
