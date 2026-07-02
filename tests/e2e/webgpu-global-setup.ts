import { chromium, type FullConfig } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { WEBGPU_E2E_PREFLIGHT_PATH, type WebgpuE2ePreflight } from "./webgpu-preflight.ts";

function writePreflight(result: WebgpuE2ePreflight): void {
  mkdirSync(dirname(WEBGPU_E2E_PREFLIGHT_PATH), { recursive: true });
  writeFileSync(WEBGPU_E2E_PREFLIGHT_PATH, JSON.stringify(result));
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  if (process.env.LUXEL_WEBGPU_SKIP === "1") {
    writePreflight({ skip: true, reason: "LUXEL_WEBGPU_SKIP=1" });
    return;
  }

  const channel = process.env.PLAYWRIGHT_CHROMIUM_CHANNEL ?? "chromium";
  const headless = process.env.LUXEL_WEBGPU_HEADED !== "1";

  let browser;
  try {
    browser = await chromium.launch({
      channel,
      headless,
      timeout: 30_000,
    });
    const page = await browser.newPage();
    const adapterOk = await page.evaluate(async () => {
      const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
      if (!gpu) return false;
      const adapter = await gpu.requestAdapter();
      return adapter !== null;
    });
    await page.close();
    if (!adapterOk) {
      writePreflight({ skip: true, reason: "WebGPU adapter unavailable" });
      return;
    }
    writePreflight({ skip: false });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    writePreflight({ skip: true, reason });
  } finally {
    await browser?.close();
  }
}
