import { describe, expect, test } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";
import {
  clearProofMapStorage,
  clearStoredMapView,
  saveAoi,
  saveEvidenceSnapshots,
  savePins,
  saveVerificationRuns,
} from "@/lib/proofMap/storage";

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
}

describe("demo stability regression harness", () => {
  test("/manifest stays methods-first (no rules UI by default)", () => {
    const manifestPage = read("src/app/manifest/page.tsx");
    expect(manifestPage).toContain("MethodsInventoryApp");

    const inventoryApp = read("src/components/manifest/MethodsInventoryApp.tsx");
    expect(inventoryApp).toContain('Start with methods.');
    expect(inventoryApp).toContain("Search methods");
  });

  test("method list routes into /m/<code>/v/<ver> with a stable tab param", () => {
    const inventoryApp = read("src/components/manifest/MethodsInventoryApp.tsx");
    expect(inventoryApp).toContain("function methodHref");
    expect(inventoryApp).toContain("`/m/${code}/v/");
    expect(inventoryApp).toContain("?tab=overview");
  });

  test("method detail tab state is URL-authoritative (no local setTab state)", () => {
    const detail = read("src/app/m/_components/MethodDetailPane.tsx");
    expect(detail).toContain('parseDetailTab(new URLSearchParams(searchString).get("tab"))');
    expect(detail).not.toMatch(/\bconst\s+\[tab,\s*setTab\]/);
  });

  test("map view state does not write bbox into URL", () => {
    const detail = read("src/app/m/_components/MethodDetailPane.tsx");
    expect(detail).not.toContain("bbox");

    const mapTab = read("src/components/map/ProofMapTab.tsx");
    expect(mapTab).not.toContain('searchParams.set("bbox"');
    expect(mapTab).not.toContain("history.replaceState");
    expect(mapTab).not.toContain("router.replace");
  });

  test("start over clears method+version scoped storage (aoi/pins/runs/snapshots + map view)", () => {
    const local = new Map<string, string>();
    const originalWindow = (globalThis as unknown as { window?: unknown }).window;

    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => local.get(k) ?? null,
        setItem: (k: string, v: string) => void local.set(k, v),
        removeItem: (k: string) => void local.delete(k),
      },
    };

    const code = "AR-AM0014";
    const version = "v03-0";
    saveAoi(code, version, {
      id: "aoi-1",
      name: "AOI",
      bbox: [0, 0, 1, 1],
      area_km2: 1,
      geojson: { type: "Feature", geometry: { type: "Polygon", coordinates: [] }, properties: {} } as any,
    });
    savePins(code, version, [{ id: "pin-1", title: "pin", kind: "rule", cited_ids: ["R-1"] } as any]);
    saveVerificationRuns(code, version, [{ id: "run-1" } as any]);
    saveEvidenceSnapshots(code, version, [{ id: "snap-1" } as any]);
    local.set(`a6:mapview:${code}@${version}`, JSON.stringify({ zoom: 4 }));

    clearProofMapStorage(code, version);
    clearStoredMapView(`${code}@${version}`);

    expect(local.has(`aoi:${code}:${version}`)).toBe(false);
    expect(local.has(`pins:${code}:${version}`)).toBe(false);
    expect(local.has(`runs:${code}:${version}`)).toBe(false);
    expect(local.has(`snapshots:${code}:${version}`)).toBe(false);
    expect(local.has(`a6:mapview:${code}@${version}`)).toBe(false);

    (globalThis as unknown as { window?: unknown }).window = originalWindow;
  });
});

