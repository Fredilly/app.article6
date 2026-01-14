import { expect, test } from "@playwright/test";

test("Assistant evidence permalinks restore focus on reload", async ({ page }) => {
  await page.goto("/m/AR-ACM0003/v/v02-0");

  await page.getByRole("button", { name: "Assistant" }).click();

  const evidenceChip = page.getByRole("button", { name: /^Section: / }).first();
  await expect(evidenceChip).toBeVisible({ timeout: 30_000 });
  const chipText = (await evidenceChip.textContent()) ?? "";
  const match = chipText.match(/Section:\s*(S-\d+)/);
  const sectionId = match?.[1] ?? "S-1";

  await evidenceChip.click();

  await expect(page).toHaveURL(new RegExp(`\\btab=sections\\b`));
  await expect(page).toHaveURL(new RegExp(`\\bfocus=${sectionId}\\b`));
  await expect(page.getByText("Section preview", { exact: true })).toBeVisible();
  await expect(page.locator(`#section-${sectionId}.assistant-focus-highlight`)).toBeVisible({ timeout: 30000 });

  await page.reload();

  await expect(page).toHaveURL(new RegExp(`\\btab=sections\\b`));
  await expect(page).toHaveURL(new RegExp(`\\bfocus=${sectionId}\\b`));
  await expect(page.getByText("Section preview", { exact: true })).toBeVisible();
  await expect(page.locator(`#section-${sectionId}.assistant-focus-highlight`)).toBeVisible({ timeout: 30000 });
});
