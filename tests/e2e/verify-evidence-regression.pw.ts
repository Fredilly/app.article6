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
  await page.waitForSelector("text=Save reviewer artifact", { timeout: 30_000 });
  await page.waitForSelector("text=Finalize run", { timeout: 30_000 });
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

  const currentRunBefore = await page.getByTestId("current-run-indicator").textContent();

  const newRunButton = page.getByRole("button", { name: "New run" }).first();
  await newRunButton.click();

  await expect(page.getByText("Started new run")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Fresh review workspace created")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("In progress")).toBeVisible({ timeout: 30_000 });
  const currentRunAfter = await page.getByTestId("current-run-indicator").textContent();
  expect(currentRunAfter).not.toBe(currentRunBefore);
});

test("Verify run history load restores state and highlights current row", async ({ page }) => {
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
    window.localStorage.setItem(
      "verify:AR-ACM0003:v02-0",
      JSON.stringify({
        runContext: { runId: "run-current", createdAt: "2026-03-01T00:00:00Z" },
        exportedAt: "2026-03-01T00:05:00Z",
        savedReviewerArtifactAt: "2026-03-01T00:06:00Z",
        finalizedAt: null,
        loadedFromRunId: null,
        derivedFromRunId: null,
        isEditedDraft: false,
        minutes: "Current draft minutes",
        draftMinutes: "Current draft minutes",
        outcomeNote: "",
        draftOutcomeNote: "",
        checklist: [],
        delta: "",
        impact: "",
        tasks: [],
      }),
    );
    window.localStorage.setItem(
      "verifyRunHistory:AR-ACM0003:v02-0",
      JSON.stringify([
        {
          runId: "run-loaded",
          createdAt: "2026-02-28T00:00:00Z",
          bundle: {
            runContext: { runId: "run-loaded", createdAt: "2026-02-28T00:00:00Z" },
            exportedAt: "2026-02-28T00:05:00Z",
            savedReviewerArtifactAt: "2026-02-28T00:06:00Z",
            finalizedAt: "2026-02-28T00:07:00Z",
            loadedFromRunId: null,
            derivedFromRunId: null,
            isEditedDraft: false,
            minutes: "Loaded run minutes",
            draftMinutes: "Loaded run minutes",
            outcomeNote: "Loaded outcome",
            draftOutcomeNote: "Loaded outcome",
            checklist: [],
            delta: "",
            impact: "",
            tasks: [],
            selectedRuleId: "R-1",
            linkedRuleIds: ["R-1"],
            aoi,
            evidencePins: [],
            verificationRuns: [],
            selectedStacItemId: null,
          },
        },
      ]),
    );
  }, seededAoi);

  await page.goto("/m/AR-ACM0003/v/v02-0?tab=verify&mode=list", { waitUntil: "domcontentloaded" });
  await page.getByTestId("secondary-context-toggle").click();
  await page.getByText("Run history").click();

  await page.getByTestId("verifier-minutes-textarea").fill("Unsaved change");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Load" }).first().click();

  await expect(page.getByText("Loaded run")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Saved evidence and review state restored")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("secondary-context")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("active-run-history-row")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Loaded from Run loaded")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("current-run-indicator")).not.toContainText("loaded");
  await expect(page.getByTestId("verifier-minutes-textarea")).toHaveValue("Loaded run minutes");
  await page.getByTestId("verifier-minutes-textarea").fill("Edited loaded run minutes");
  await expect(page.getByText("Edited draft")).toBeVisible({ timeout: 30_000 });
});

test("Finalize lands on a readable review summary and keeps it after refresh", async ({ page }) => {
  const rulesResponse = await page.request.get("/api/methods/AR-ACM0003/v/v02-0/rules");
  expect(rulesResponse.ok()).toBeTruthy();
  const rulesPayload = (await rulesResponse.json()) as { rules?: Array<{ id?: string }> };
  const ruleId = rulesPayload.rules?.find((entry) => typeof entry.id === "string")?.id ?? "R-1";

  const seededAoi = {
    id: "aoi_review_summary",
    name: "Review Summary AOI",
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
    window.localStorage.removeItem("pins:AR-ACM0003:v02-0");
    window.localStorage.removeItem("runs:AR-ACM0003:v02-0");
    window.localStorage.removeItem("snapshots:AR-ACM0003:v02-0");
    window.localStorage.removeItem("verifyRunHistory:AR-ACM0003:v02-0");
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
              "eo:cloud_cover": 5.5,
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

  await page.getByRole("button", { name: /^Search STAC$/ }).first().click();
  await page.getByRole("button", { name: stacItemId }).first().click();
  await page.getByRole("button", { name: "Create pin" }).first().click();
  await page.getByTestId("verifier-minutes-textarea").fill("Saved review summary note");
  await page.getByPlaceholder("Outcome note: one concise sentence if minutes are unnecessary.").fill("Outcome is stable");
  await page.getByRole("button", { name: "Save reviewer artifact" }).click();
  await page.getByRole("button", { name: "Finalize run" }).click();

  await expect(page.getByTestId("review-summary-card")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Review Summary")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Saved review summary note")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Download JSON artifact" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Download PDF summary" })).toBeVisible({ timeout: 30_000 });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("review-summary-card")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Saved review summary note")).toBeVisible({ timeout: 30_000 });
});
