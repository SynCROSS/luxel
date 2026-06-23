import { defineConfig } from "@playwright/test";

const e2eServerTimeout = 120_000;

export default defineConfig({
  testDir: "tests/e2e",
  webServer: [
    {
      command: "bun packages/luxel/scripts/e2e-server.ts",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
      timeout: e2eServerTimeout,
    },
    {
      command: "bun packages/luxel/scripts/e2e-nav-demo-server.ts",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: !process.env.CI,
      timeout: e2eServerTimeout,
    },
  ],
  projects: [
    {
      name: "counter",
      testMatch: "counter.spec.ts",
      use: { baseURL: "http://127.0.0.1:4173" },
    },
    {
      name: "nav-demo",
      testMatch: "nav-demo.spec.ts",
      use: { baseURL: "http://127.0.0.1:4174" },
    },
  ],
});
