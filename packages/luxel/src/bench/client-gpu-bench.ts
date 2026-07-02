import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { detectClientGpuCapabilities } from "../client-gpu/capabilities.ts";
import { computeSpiralLayoutCoordsSync } from "../client-gpu/spiral-layout.ts";
import { computeSpiralTileCoordsWebgpuWithParity } from "../client-gpu/spiral-layout-webgpu.ts";
import { resolveNativeGpuClient } from "../config/native-gpu.ts";
import { getLuxelRepoRoot } from "../paths.ts";

export type ClientGpuBenchLine = {
  fixture: "client-gpu";
  metric: string;
  value: number;
};

type WebgpuE2ePreflight = {
  skip: boolean;
  reason?: string;
};

function readWebgpuE2ePreflight(repoRoot: string): WebgpuE2ePreflight | null {
  const path = join(repoRoot, "packages/luxel/.cache/webgpu-e2e-preflight.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as WebgpuE2ePreflight;
}

function webgpuBenchSkipReason(repoRoot: string): string | null {
  if (process.env.LUXEL_WEBGPU_SKIP === "1" || process.env.LUXEL_WEBGPU_SKIP === "true") {
    return "LUXEL_WEBGPU_SKIP=1";
  }
  const preflight = readWebgpuE2ePreflight(repoRoot);
  if (preflight?.skip) {
    return preflight.reason ?? "Chromium preflight failed";
  }
  return null;
}

export async function runClientGpuBench(
  repoRoot: string = getLuxelRepoRoot(),
): Promise<ClientGpuBenchLine[]> {
  const lines: ClientGpuBenchLine[] = [];
  const capabilities = detectClientGpuCapabilities();
  const cpu = computeSpiralLayoutCoordsSync({
    gpu: resolveNativeGpuClient({ client: "off" }, capabilities),
    capabilities,
  });
  lines.push({ fixture: "client-gpu", metric: "cpu_layout_tile_count", value: cpu.metrics.tileCount });
  lines.push({ fixture: "client-gpu", metric: "cpu_layout_compute_ms", value: cpu.metrics.computeMs });

  const skipReason = webgpuBenchSkipReason(repoRoot);
  if (skipReason) {
    lines.push({ fixture: "client-gpu", metric: "webgpu_parity_ok", value: 0 });
    return lines;
  }

  if (capabilities.webgpu) {
    try {
      const gpu = await computeSpiralTileCoordsWebgpuWithParity();
      lines.push({ fixture: "client-gpu", metric: "webgpu_warmup_ms", value: gpu.metrics.warmupMs });
      lines.push({ fixture: "client-gpu", metric: "webgpu_compute_ms", value: gpu.metrics.computeMs });
      lines.push({ fixture: "client-gpu", metric: "webgpu_parity_ok", value: 1 });
    } catch {
      lines.push({ fixture: "client-gpu", metric: "webgpu_parity_ok", value: 0 });
    }
    return lines;
  }

  const preflight = readWebgpuE2ePreflight(repoRoot);
  lines.push({
    fixture: "client-gpu",
    metric: "webgpu_parity_ok",
    value: preflight && !preflight.skip ? 1 : 0,
  });
  return lines;
}
