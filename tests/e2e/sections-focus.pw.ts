import { test, expect } from "@playwright/test";

/**
 * Regression: URL-driven section focus must control the Section preview.
 */
test("Sections tab honors ?section= (S-2 then S-3)", async ({ page }) => {
  await page.goto("/m/AR-ACM0003/v/v02-0?tab=sections&section=S-2", { waitUntil: "domcontentloaded" });
  const preview = page.getByText("Section preview", { exact: true }).locator("..");
  await expect(preview).toContainText("S-2");

  await page.goto("/m/AR-ACM0003/v/v02-0?tab=sections&section=S-3", { waitUntil: "domcontentloaded" });
  await expect(preview).toContainText("S-3");
});
