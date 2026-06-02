import { test, expect } from "@playwright/test";

test("counter hydrates and increments on click", async ({ page }) => {
  await page.goto("/");
  const button = page.locator('[data-luxel-text="count"]');
  await expect(button).toHaveText("0");
  await button.click();
  await expect(button).toHaveText("1");
});
