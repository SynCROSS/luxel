import { defineConfig } from "@playwright/test";

const e2eServerTimeout = 120_000;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "spiral-webgpu.spec.ts",
  globalSetup: "tests/e2e/webgpu-global-setup.ts",
  webServer: {
    command: "bun packages/luxel/scripts/e2e-webgpu-server.ts",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: process.env.LUXEL_WEBGPU_REUSE_SERVER === "1" && !process.env.CI,
    timeout: e2eServerTimeout,
  },
  use: {
    baseURL: "http://127.0.0.1:4175",
    channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL ?? "chromium",
    headless: process.env.LUXEL_WEBGPU_HEADED !== "1",
    launchOptions: {
      timeout: 30_000,
    },
  },
  timeout: 60_000,
  expect: {
    timeout: 30_000,
  },
});
