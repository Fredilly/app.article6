import { test, expect } from '@playwright/test';

const fixturePath = 'services/vlm/tests/fixtures/test.png';

test('chat with image returns response', async ({ page }) => {
  await page.goto('/labs/vlm');
  await page.setInputFiles('input[type="file"]', fixturePath);
  await page.fill('input[placeholder="Ask a question..."]', 'hello');
  await page.click('text=Send');
  await expect(page.locator('text=mock response')).toBeVisible();
});
