import { test, expect } from "@playwright/test";
import { spiralTileCount } from "../../packages/luxel/src/bench/fixtures/spiral-html.ts";
import { webgpuE2eSkipReason } from "./webgpu-preflight.ts";

async function navigatorHasWebGpu(page: import("@playwright/test").Page): Promise<boolean> {
  return page.evaluate(
    () => typeof navigator !== "undefined" && typeof (navigator as Navigator & { gpu?: unknown }).gpu !== "undefined",
  );
}

test.describe("spiral WebGPU browser parity", () => {
  test.beforeEach(({ browserName }, testInfo) => {
    const skipReason = webgpuE2eSkipReason();
    if (skipReason) {
      testInfo.skip(true, skipReason);
      return;
    }
    test.skip(browserName !== "chromium", "WebGPU parity harness requires Chromium");
  });

  test("WebGPU spiral layout matches f32 reference and paints tiles", async ({ page }) => {
    await page.goto("/");
    const hasWebgpu = await navigatorHasWebGpu(page);
    test.skip(!hasWebgpu, "navigator.gpu unavailable in this browser — skip WebGPU parity");

    const result = await page.evaluate(async () => {
      const run = (window as Window & { __luxelWebgpuParity?: () => Promise<unknown> }).__luxelWebgpuParity;
      if (typeof run !== "function") {
        throw new Error("luxel spiral GPU harness not loaded");
      }
      return (await run()) as {
        ok: boolean;
        backend: string;
        tileCount: number;
        appliedTiles: number;
      };
    });

    expect(result.ok).toBe(true);
    expect(result.backend).toBe("webgpu");
    expect(result.tileCount).toBe(spiralTileCount());
    expect(result.appliedTiles).toBe(spiralTileCount());
    await expect(page.locator("#wrapper .tile")).toHaveCount(spiralTileCount());
    await expect(page.locator("#wrapper")).toHaveAttribute("data-luxel-gpu-backend", "webgpu");
  });
});
