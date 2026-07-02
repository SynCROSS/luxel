import type { RenderIr } from "../compiler/render-ir.ts";
import { nativeSsrRouteKind } from "../compiler/spiral-native.ts";
import { getLuxelCoreNodeModule, isLuxelCoreNodeLoadable } from "../bench/ensure-core-node.ts";

export type ConfiguredSsrBackend = "ts" | "native" | "auto";

export function resolveSsrBackend(
  configured: ConfiguredSsrBackend,
  renderIr: RenderIr,
): "ts" | "native" {
  if (configured === "ts" || configured === "native") {
    return configured;
  }
  return autoNativeSsrBackend(renderIr);
}

function autoNativeSsrBackend(renderIr: RenderIr): "ts" | "native" {
  if (!isLuxelCoreNodeLoadable()) return "ts";
  const kind = nativeSsrRouteKind(renderIr);
  if (!kind) return "ts";
  const mod = getLuxelCoreNodeModule();
  if (!mod) return "ts";
  if (kind === "counter" && typeof mod?.renderCounterBody === "function") return "native";
  if (kind === "spiral" && typeof mod?.renderSpiralDocument === "function") return "native";
  if (kind === "spiral" && typeof mod?.renderSpiralBody === "function") return "native";
  if (kind === "spiral" && typeof mod?.renderSpiralBodyFromTiles === "function") return "native";
  return "ts";
}
