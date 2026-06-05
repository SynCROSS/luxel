import { test, expect } from "@playwright/test";

test("forward nav between routes without document reload", async ({ page }) => {
  let loadCount = 0;
  page.on("load", () => {
    loadCount++;
  });
  await page.goto("/");
  await page.waitForFunction(() => (window as { __LUXEL_CLIENT_NAV_READY?: boolean }).__LUXEL_CLIENT_NAV_READY === true);
  await expect(page.locator("h1")).toHaveText("A");
  expect(loadCount).toBe(1);

  await page.click('a[data-luxel-nav][href="/detail"]', { noWaitAfter: true });
  await expect(page.locator("h1")).toHaveText("Detail route");
  expect(loadCount).toBe(1);

  await page.click('a[data-luxel-nav][href="/"]', { noWaitAfter: true });
  await expect(page.locator("h1")).toHaveText("A");
  expect(loadCount).toBe(1);
});

test("luxel-sw.js embeds offline policies from manifest", async ({ request }) => {
  const res = await request.get("/luxel-sw.js");
  expect(res.ok()).toBeTruthy();
  const js = await res.text();
  expect(js).toContain("OFFLINE");
  expect(js).toContain('"/detail"');
  expect(js).toContain('"none"');
});
