import { expect, test } from "@playwright/test";

const METHOD_CODE = "AR-ACM0003";
const VERSION = "v02-0";

function seedVerifyState(input: { methodCode: string; version: string }) {
  const { methodCode, version } = input;
  const createdAt = "2026-03-01T00:00:00.000Z";
  const runId = `${methodCode}-${version}-20260301000000000`;

  window.localStorage.setItem(
    `aoi:v2:${methodCode}:${version}:current`,
    JSON.stringify({
      id: "aoi-e2e-1",
      name: "E2E AOI",
      bbox: [103.8, 1.2, 104.1, 1.5],
      area_km2: 123.45,
      aoi_fingerprint: "aoi-fp-e2e",
      geojson: {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [103.8, 1.2],
              [104.1, 1.2],
              [104.1, 1.5],
              [103.8, 1.5],
              [103.8, 1.2],
            ],
          ],
        },
        properties: {},
      },
    }),
  );

  window.localStorage.setItem(
    `pins:${methodCode}:${version}`,
    JSON.stringify([
      {
        id: "pin-e2e-1",
        kind: "note",
        title: "E2E Pin",
        created_at: createdAt,
        cited_ids: ["R-1"],
        stac_item_ids: [],
      },
    ]),
  );

  window.localStorage.setItem(
    `verify:${methodCode}:${version}`,
    JSON.stringify({
      runContext: { runId, createdAt },
      exportedAt: null,
      minutes: "",
      checklist: [
        { id: "read-overview", label: "Read method overview", checked: false, updatedAt: createdAt },
        { id: "reviewed-sections", label: "Reviewed relevant sections", checked: false, updatedAt: createdAt },
        { id: "checked-anchors", label: "Checked rule anchors", checked: false, updatedAt: createdAt },
        { id: "verified-layer-inputs", label: "Verified spatial evidence layer inputs", checked: false, updatedAt: createdAt },
        { id: "exported-snapshot", label: "Exported snapshot", checked: false, updatedAt: createdAt },
      ],
      delta: "",
      impact: "",
      tasks: [],
    }),
  );
}

test("run lifecycle: export marker + new run reset keeps pins", async ({ page }) => {
  await page.addInitScript(seedVerifyState, { methodCode: METHOD_CODE, version: VERSION });
  await page.goto(`/m/${METHOD_CODE}/v/${VERSION}?tab=verify&mode=list`, { waitUntil: "domcontentloaded" });

  const minutes = page.getByTestId("verifier-minutes-textarea");
  const runId = page.getByTestId("verifier-run-id");
  const runStartedAt = page.getByTestId("verifier-run-started-at");
  const checklistItem = page.getByLabel("Read method overview");
  const readPinsCount = async () =>
    page.evaluate(([method, version]) => {
      const raw = window.localStorage.getItem(`pins:${method}:${version}`);
      if (!raw) return 0;
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        return 0;
      }
    }, [METHOD_CODE, VERSION] as const);

  await expect(minutes).toBeVisible();
  const pinsBefore = await readPinsCount();
  expect(pinsBefore).toBeGreaterThanOrEqual(1);

  const runBefore = (await runId.textContent()) ?? "";
  const startedBefore = (await runStartedAt.textContent()) ?? "";

  await minutes.fill("Verifier notes for lifecycle test.");
  await checklistItem.check();

  await page.getByRole("button", { name: "Export snapshot" }).first().click();

  await expect(page.getByTestId("snapshot-exported-badge")).toBeVisible();
  await expect(minutes).toBeDisabled();

  await page.getByRole("button", { name: "New run" }).first().click();

  await expect(page.getByText("New run started — pins kept: 1")).toBeVisible();
  await expect(minutes).toHaveValue("");
  await expect(minutes).toBeFocused();
  await expect(checklistItem).not.toBeChecked();
  const pinsAfter = await readPinsCount();
  expect(pinsAfter).toBe(pinsBefore);

  const runAfter = (await runId.textContent()) ?? "";
  const startedAfter = (await runStartedAt.textContent()) ?? "";
  expect(runAfter).not.toBe(runBefore);
  expect(startedAfter).not.toBe(startedBefore);
});
