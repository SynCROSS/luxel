import { isLuxelCoreNodeLoadable } from "../bench/ensure-core-node.ts";
import { loadLuxelConfig } from "./load.ts";

export type NativeMode = "auto" | "off" | "strict";

import type { NativeGpuConfig } from "./native-gpu.ts";
import type { NativeSchemasConfig } from "./native-schemas.ts";
import type { NativeRuntimeKind } from "./native-runtime.ts";
import {
  assertNativeRuntimeStartup,
  resolveNativeRuntime,
} from "./native-runtime.ts";

export type NativeModeConfig = {
  mode?: NativeMode;
  gpu?: NativeGpuConfig;
  runtime?: NativeRuntimeKind | "auto";
  schemas?: NativeSchemasConfig;
};

export type NativeModeResolution = {
  configured: NativeMode;
  effective: "on" | "off";
  coreNodeLoadable: boolean;
  diagnostics: string[];
  nativeRuntime: NativeRuntimeKind;
};

export type ManifestNativeDiagnostics = {
  mode: NativeMode;
  effective: "on" | "off";
  diagnostics: string[];
};

const DEFAULT_MODE: NativeMode = "auto";

export function resolveNativeMode(config?: NativeModeConfig): NativeModeResolution {
  const configured = config?.mode ?? DEFAULT_MODE;
  const coreNodeLoadable = isLuxelCoreNodeLoadable();
  const diagnostics: string[] = [`native.mode=${configured}`];
  let effective: "on" | "off";

  if (configured === "off") {
    diagnostics.push("native disabled by config");
    effective = "off";
  } else if (!coreNodeLoadable) {
    diagnostics.push("luxel-core addon unavailable; JS/TS fallback");
    if (configured === "strict") {
      diagnostics.push("strict mode requires loadable luxel-core addon");
    }
    effective = "off";
  } else {
    diagnostics.push("luxel-core addon loadable");
    effective = "on";
  }

  const base = { configured, effective, coreNodeLoadable, diagnostics };
  const nativeRuntime = resolveNativeRuntime(base as NativeModeResolution, config?.runtime);
  diagnostics.push(`native.runtime=${nativeRuntime}`);
  return { ...base, nativeRuntime };
}

export function assertNativeModeStartup(resolution: NativeModeResolution): void {
  if (resolution.configured !== "strict") return;
  if (resolution.coreNodeLoadable) return;
  throw new Error(
    "luxel-native strict mode requires loadable @luxel/core-node — install platform addon or set native.mode to auto/off",
  );
}

export async function assertNativeModeForAppRoot(appRoot: string): Promise<NativeModeResolution> {
  const config = await loadLuxelConfig(appRoot);
  const resolution = resolveNativeMode(config.native);
  assertNativeModeStartup(resolution);
  assertNativeRuntimeStartup(resolution, resolution.nativeRuntime);
  return resolution;
}

export function shouldFailFastOnNativeSsrError(configured: NativeMode = DEFAULT_MODE): boolean {
  return configured === "strict" || process.env.LUXEL_BENCH_STRICT_NATIVE === "1";
}

export function formatNativeSsrFailure(configured: NativeMode, err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (configured === "strict") {
    return new Error(`luxel-native strict mode: native SSR failed: ${msg}`);
  }
  return new Error(`luxel-core native SSR required in bench but failed: ${msg}`);
}

export function routeSsrBackendForNativeMode(
  nativeMode: NativeModeResolution,
  configured?: "ts" | "native" | "auto",
): "ts" | "native" | "auto" {
  if (nativeMode.effective === "off") return "ts";
  return configured ?? "auto";
}

export function toManifestNativeDiagnostics(
  resolution: NativeModeResolution,
): ManifestNativeDiagnostics {
  return {
    mode: resolution.configured,
    effective: resolution.effective,
    diagnostics: resolution.diagnostics,
  };
}
