import { describe, expect, test } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";
import type { ProofEvidenceItem } from "@/lib/proof/bundle";
import type { AOI, EvidencePin, VerificationRun } from "@/lib/proofMap/types";
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

  test("method detail keeps the rich rule modal in the existing workflow", () => {
    const detail = read("src/app/m/_components/MethodDetailPane.tsx");
    expect(detail).toContain("RequirementCoverageWorkspace");
    expect(detail).toContain("RuleDetailModal");
    expect(detail).toContain("openRuleModal");
    expect(detail).not.toContain("window.open(");
  });

  test("rule detail modal keeps close behavior local to the workflow", () => {
    const modal = read("src/app/m/_components/RuleDetailModal.tsx");
    expect(modal).toContain('role="dialog"');
    expect(modal).toContain('aria-modal="true"');
    expect(modal).toContain('if (event.key === "Escape") onClose();');
    expect(modal).toContain('onClick={onClose}');
    expect(modal).toContain('onClick={(event) => event.stopPropagation()}');
  });

  test("map view state does not write bbox into URL", () => {
    const detail = read("src/app/m/_components/MethodDetailPane.tsx");
    expect(detail).not.toContain('searchParams.set("bbox"');

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
    const aoi: AOI = {
      id: "aoi-1",
      name: "AOI",
      bbox: [0, 0, 1, 1],
      area_km2: 1,
      created_at: "2026-01-01T00:00:00Z",
      geojson: {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
        },
        properties: {},
      },
    };
    const pin: EvidencePin = {
      id: "pin-1",
      title: "pin",
      kind: "note",
      cited_ids: ["R-1"],
      created_at: "2026-01-01T00:00:00Z",
    };
    const run: VerificationRun = {
      id: "run-1",
      method: { code, version },
      aoi_fingerprint: "aoi-hash",
      input_fingerprint: "input-hash",
      cited_ids: ["R-1"],
      cited_ids_count: 1,
      attachment_sha256: [],
      attachment_count: 0,
      provider: "stac",
      status: "ok",
      created_at: "2026-01-01T00:00:00Z",
    };
    const snapshot: ProofEvidenceItem = { id: "snap-1", kind: "rule", title: "Snapshot" };
    saveAoi(code, version, aoi);
    savePins(code, version, [pin]);
    saveVerificationRuns(code, version, [run]);
    saveEvidenceSnapshots(code, version, [snapshot]);
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
