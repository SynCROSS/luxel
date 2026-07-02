import { chromium, expect, type Page } from "@playwright/test";
import { createNavDemoTestServer, createTestServer } from "../test/server.ts";

function median(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

const INP_TIMEOUT_MS = Number(process.env.LUXEL_INP_TIMEOUT_MS ?? (process.env.CI ? 30_000 : 15_000));

async function waitForCounterHydration(page: Page): Promise<void> {
  const count = page.locator('[data-luxel-text="count"]');
  await count.waitFor({ state: "visible" });
  await page
    .waitForResponse((r) => r.url().includes("/assets/client.dev0.js") && r.ok(), {
      timeout: 10_000,
    })
    .catch(() => undefined);
  await page
    .waitForFunction(
      () =>
        (window as { __LUXEL_HYDRATION_READY?: boolean }).__LUXEL_HYDRATION_READY === true,
      undefined,
      { timeout: 10_000 },
    )
    .catch(() => undefined);
}

async function measureInteraction(
  url: string,
  warmup: (page: Page) => Promise<void>,
  interact: (page: Page) => Promise<void>,
  samples = 7,
): Promise<number> {
  const browser = await chromium.launch({
    headless: true,
    timeout: INP_TIMEOUT_MS,
    args: process.env.CI ? ["--disable-dev-shm-usage"] : [],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(INP_TIMEOUT_MS);
  try {
    const timings: number[] = [];
    for (let i = 0; i < samples; i++) {
      await page.goto(url, { waitUntil: "load" });
      await warmup(page);
      const start = performance.now();
      await interact(page);
      timings.push(performance.now() - start);
    }
    return median(timings);
  } finally {
    await browser.close();
  }
}

export type InpBenchRow =
  | { fixture: string; interaction: string; inpMs: number }
  | { fixture: string; interaction: string; status: "pending"; reason: string };

export async function runLuxelInpBench(): Promise<InpBenchRow[]> {
  const rows: InpBenchRow[] = [];

  const counterServer = await createTestServer(0, { routeSsrBackends: { "/": "ts" } });
  try {
    const counterMs = await measureInteraction(
      counterServer.url,
      async (page) => {
        await waitForCounterHydration(page);
      },
      async (page) => {
        const count = page.locator('[data-luxel-text="count"]');
        await count.click();
        await expect(count).toHaveText("1", { timeout: INP_TIMEOUT_MS });
      },
      5,
    );
    rows.push({ fixture: "counter", interaction: "counter_click", inpMs: counterMs });
  } catch (err) {
    rows.push({
      fixture: "counter",
      interaction: "counter_click",
      status: "pending",
      reason: err instanceof Error ? err.message : "counter inp failed",
    });
  } finally {
    counterServer.close();
  }

  const navServer = await createNavDemoTestServer();
  try {
    const navMs = await measureInteraction(
      navServer.url,
      async (page) => {
        await page.waitForFunction(
          () => (window as { __LUXEL_CLIENT_NAV_READY?: boolean }).__LUXEL_CLIENT_NAV_READY === true,
        );
      },
      async (page) => {
        await page.click('a[data-luxel-nav][href="/detail"]', { noWaitAfter: true });
        await page.locator("h1").filter({ hasText: "Detail route" }).waitFor({ state: "visible" });
      },
      5,
    );
    rows.push({ fixture: "nav-demo", interaction: "client_nav_forward", inpMs: navMs });
  } catch (err) {
    rows.push({
      fixture: "nav-demo",
      interaction: "client_nav_forward",
      status: "pending",
      reason: err instanceof Error ? err.message : "nav inp failed",
    });
  } finally {
    navServer.close();
  }

  return rows;
}
