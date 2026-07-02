import { chromium, type Page } from "@playwright/test";
import { createNavDemoTestServer, createTestServer } from "../test/server.ts";

function median(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

const INP_TIMEOUT_MS = Number(process.env.LUXEL_INP_TIMEOUT_MS ?? (process.env.CI ? 30_000 : 15_000));

async function measureInteraction(
  url: string,
  warmup: (page: Page) => Promise<void>,
  interact: (page: Page) => Promise<void>,
  samples = 7,
): Promise<number> {
  const browser = await chromium.launch({ headless: true, timeout: INP_TIMEOUT_MS });
  const page = await browser.newPage();
  page.setDefaultTimeout(INP_TIMEOUT_MS);
  try {
    const timings: number[] = [];
    for (let i = 0; i < samples; i++) {
      await page.goto(url, { waitUntil: "networkidle" });
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

export async function runLuxelInpBench(): Promise<
  Array<{ fixture: string; interaction: string; inpMs: number }>
> {
  const counterServer = await createTestServer();
  const navServer = await createNavDemoTestServer();
  try {
    const counterMs = await measureInteraction(
      counterServer.url,
      async (page) => {
        const count = page.locator('[data-luxel-text="count"]');
        await count.waitFor({ state: "visible" });
        await page.waitForFunction(() => {
          const el = document.querySelector('[data-luxel-text="count"]');
          return el instanceof HTMLButtonElement && !el.disabled;
        });
      },
      async (page) => {
        await page.locator('[data-luxel-text="count"]').click();
        await page.waitForFunction(() => {
          const el = document.querySelector('[data-luxel-text="count"]');
          return el?.textContent === "1";
        });
      },
      5,
    );

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

    return [
      { fixture: "counter", interaction: "counter_click", inpMs: counterMs },
      { fixture: "nav-demo", interaction: "client_nav_forward", inpMs: navMs },
    ];
  } finally {
    counterServer.close();
    navServer.close();
  }
}
