import { isLuxelCoreNodeArtifactPresent, isLuxelCoreNodeLoadable } from "../bench/ensure-core-node.ts";
import { canSpawnRenderdChild } from "../renderd/spawn.ts";
import type { NativeMode, NativeModeConfig, NativeModeResolution } from "./native-mode.ts";
import { resolveNativeMode } from "./native-mode.ts";

export type NativeRuntimeKind = "inline" | "process";

export type NativeRuntimeConfig = {
  runtime?: NativeRuntimeKind | "auto";
};

function isLuxelCoreNodeAvailableForRenderd(): boolean {
  if (process.env.LUXEL_NATIVE_FORCE_UNAVAILABLE === "1") return false;
  if (isLuxelCoreNodeLoadable()) return true;
  return isLuxelCoreNodeArtifactPresent();
}

export function isRenderdRuntimeAvailable(): boolean {
  if (process.env.LUXEL_RENDERD_FORCE_UNAVAILABLE === "1") {
    return false;
  }
  if (!canSpawnRenderdChild()) return false;
  return isLuxelCoreNodeAvailableForRenderd();
}

export function resolveNativeRuntime(
  nativeMode: NativeModeResolution,
  configured: NativeRuntimeConfig["runtime"] = "auto",
): NativeRuntimeKind {
  if (nativeMode.effective === "off") return "inline";
  if (configured === "inline") return "inline";
  if (configured === "process") return "process";
  return isRenderdRuntimeAvailable() ? "process" : "inline";
}

export function assertNativeRuntimeStartup(
  nativeMode: NativeModeResolution,
  runtime: NativeRuntimeKind,
): void {
  if (nativeMode.configured !== "strict") return;
  if (runtime !== "process") return;
  if (isRenderdRuntimeAvailable()) return;
  throw new Error(
    "luxel-native strict mode requires luxel-renderd runtime when native.runtime=process — install @luxel/core-node or set native.runtime to inline/auto",
  );
}

export function resolveRouteNativeRuntime(
  options: {
    nativeMode?: NativeMode;
    nativeRuntime?: NativeRuntimeKind;
    nativeRuntimePreference?: NativeModeConfig["runtime"];
  } = {},
): NativeRuntimeKind {
  if (options.nativeRuntime === "inline" || options.nativeRuntime === "process") {
    return options.nativeRuntime;
  }
  const resolution = resolveNativeMode({
    mode: options.nativeMode,
    runtime: options.nativeRuntimePreference ?? "auto",
  });
  return resolution.nativeRuntime;
}

export function spiralUsesRenderdProcess(
  ssrBackend: "ts" | "native",
  nativeKind: "spiral" | "counter" | null,
  runtime: NativeRuntimeKind,
): boolean {
  return ssrBackend === "native" && nativeKind === "spiral" && runtime === "process";
}
