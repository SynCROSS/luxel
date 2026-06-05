import type { BundleBackend } from "../host/backends/types.ts";
import { bunBundleBackend } from "../host/backends/bun-bundle-backend.ts";
import { esbuildBackend } from "../host/backends/esbuild-backend.ts";

export function pickBundleBackend(override?: BundleBackend): BundleBackend {
  if (override) return override;
  if (typeof Bun !== "undefined") return bunBundleBackend;
  return esbuildBackend;
}
