import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const WEBGPU_E2E_PREFLIGHT_PATH = join(
  process.cwd(),
  "packages/luxel/.cache/webgpu-e2e-preflight.json",
);

export type WebgpuE2ePreflight = {
  skip: boolean;
  reason?: string;
};

export function readWebgpuE2ePreflight(): WebgpuE2ePreflight | null {
  if (!existsSync(WEBGPU_E2E_PREFLIGHT_PATH)) return null;
  return JSON.parse(readFileSync(WEBGPU_E2E_PREFLIGHT_PATH, "utf8")) as WebgpuE2ePreflight;
}

export function webgpuE2eSkipReason(): string | null {
  if (process.env.LUXEL_WEBGPU_SKIP === "1") {
    return "LUXEL_WEBGPU_SKIP=1";
  }
  const preflight = readWebgpuE2ePreflight();
  if (preflight?.skip) {
    return preflight.reason ?? "Chromium preflight failed";
  }
  return null;
}
