import { expect, test } from "@playwright/test";

const stacItemId = "stac-item-1";

test.setTimeout(90_000);

test("Verify evidence workflow creates pin and enables start run CTA", async ({ page }) => {
  const rulesResponse = await page.request.get("/api/methods/AR-ACM0003/v/v02-0/rules");
  expect(rulesResponse.ok()).toBeTruthy();
  const rulesPayload = (await rulesResponse.json()) as { rules?: Array<{ id?: string }> };
  const ruleId = rulesPayload.rules?.find((entry) => typeof entry.id === "string")?.id ?? "R-1";

  const seededAoi = {
    id: "aoi_test_seeded",
    name: "seeded-aoi",
    geojson: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-122.5, 37.7],
            [-122.3, 37.7],
            [-122.3, 37.9],
            [-122.5, 37.9],
            [-122.5, 37.7],
          ],
        ],
      },
    },
    bbox: [-122.5, 37.7, -122.3, 37.9],
    area_km2: 391.77,
    aoi_source_type: "Feature",
    aoi_source_feature_count: 1,
    aoi_policy: "reject_multi",
    created_at: "2026-02-25T00:00:00.000Z",
  };

  await page.addInitScript((aoi) => {
    window.localStorage.setItem("aoi:v2:AR-ACM0003:v02-0:current", JSON.stringify(aoi));
    window.localStorage.removeItem("aoi:v2:AR-ACM0003:v02-0:draft");
    window.localStorage.removeItem("pins:AR-ACM0003:v02-0");
    window.localStorage.removeItem("runs:AR-ACM0003:v02-0");
    window.localStorage.removeItem("snapshots:AR-ACM0003:v02-0");
  }, seededAoi);

  await page.route("**/api/stac/search", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: stacItemId,
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-122.5, 37.7],
                  [-122.3, 37.7],
                  [-122.3, 37.9],
                  [-122.5, 37.9],
                  [-122.5, 37.7],
                ],
              ],
            },
            bbox: [-122.5, 37.7, -122.3, 37.9],
            properties: {
              id: stacItemId,
              datetime: "2024-01-01T00:00:00Z",
            },
          },
        ],
        provenance: {
          endpoint: "https://stac.example/search",
        },
      }),
    });
  });

  await page.goto(`/m/AR-ACM0003/v/v02-0?tab=verify&mode=list&rule=${encodeURIComponent(ruleId)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("text=Evidence workflow", { timeout: 30_000 });
  await page.waitForSelector("text=Pick rule", { timeout: 30_000 });
  await page.waitForTimeout(500);

  await expect(page.getByText("AOI ready")).toBeVisible({ timeout: 30_000 });
  const searchButton = page.getByRole("button", { name: /^Search STAC$/ }).first();
  await expect(searchButton).toBeEnabled({ timeout: 30_000 });
  await searchButton.click();

  const featureButton = page.getByRole("button", { name: stacItemId }).first();
  await expect(featureButton).toBeVisible({ timeout: 30_000 });
  await featureButton.click();

  const createPinButton = page.getByRole("button", { name: "Create pin" }).first();
  await expect(createPinButton).toBeEnabled({ timeout: 30_000 });
  await createPinButton.click();

  await expect(page.getByText(new RegExp(`↔\\s*${stacItemId}`))).toBeVisible({ timeout: 30_000 });

  const startRunButton = page.getByRole("button", { name: /Start run with 1 pin/ }).first();
  await expect(startRunButton).toBeEnabled({ timeout: 30_000 });
  await startRunButton.click();
  await expect(page.getByText("Run details", { exact: true }).first()).toBeVisible();
});
