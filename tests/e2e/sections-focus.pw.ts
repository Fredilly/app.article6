import { test, expect } from "@playwright/test";

test.setTimeout(90_000);

/**
 * Regression: URL-driven section focus must control the Section preview.
 */
test("Sections tab honors ?section= (S-2 then S-3)", async ({ page }) => {
  const response = await page.request.get("/api/methods/AR-ACM0003/v/v02-0/sections");
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { sections?: Array<{ id?: string }> };
  const ids = (payload.sections ?? []).map((entry) => entry.id).filter((value): value is string => Boolean(value));
  expect(ids.length).toBeGreaterThan(1);
  const first = ids[0];
  const second = ids[1];

  await page.goto(`/m/AR-ACM0003/v/v02-0?tab=sections&section=${encodeURIComponent(first)}`, { waitUntil: "domcontentloaded" });
  const preview = page.getByText("Section preview", { exact: true }).locator("..");
  await expect(preview).toContainText(first);

  await page.goto(`/m/AR-ACM0003/v/v02-0?tab=sections&section=${encodeURIComponent(second)}`, { waitUntil: "domcontentloaded" });
  await expect(preview).toContainText(second);
});
