import { expect, test } from "@playwright/test";

test.setTimeout(90_000);

test("Section permalink restores preview on reload", async ({ page }) => {
  await page.goto("/m/AR-ACM0003/v/v02-0", { waitUntil: "domcontentloaded" });

  await page.waitForSelector("button:has-text('Read')", { timeout: 30_000 });
  await page.click("button:has-text('Read')");
  await page.waitForTimeout(500);

  const response = await page.request.get("/api/methods/AR-ACM0003/v/v02-0/sections");
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { sections?: Array<{ id?: string }> };
  const sectionId = payload.sections?.find((entry) => typeof entry.id === "string")?.id ?? "S-1";

  await page.goto(`/m/AR-ACM0003/v/v02-0?tab=sections&section=${sectionId}`, { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(new RegExp(`\\bsection=${sectionId}\\b`));
  const preview = page.getByText("Section preview", { exact: true }).locator("..");
  await expect(preview).toContainText(sectionId);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`\\bsection=${sectionId}\\b`));
  await expect(preview).toContainText(sectionId);
});
