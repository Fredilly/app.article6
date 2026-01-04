/** @jest-environment jsdom */

import { describe, expect, test } from "@jest/globals";
import { buildProofBundleV1 } from "@/lib/proof/bundle";
import { importProofBundleText } from "@/lib/proof/import";
import { loadAoi, loadEvidenceSnapshots, loadPins } from "@/lib/proofMap/storage";

describe("proof bundle import", () => {
  test("rejects bundle when integrity sha mismatch", async () => {
    const bundle = await buildProofBundleV1({
      code: "AR-ACM0003",
      version: "v02-0",
      source: "Article6 Methodologies",
      provenance: {},
      rules: [],
      sections: [],
      evidence_pins: [],
    });

    const tampered = { ...bundle, method: { ...bundle.method, source: "tampered" } };
    const res = await importProofBundleText(JSON.stringify(tampered), { code: "AR-ACM0003", version: "v02-0" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("INTEGRITY_FAILED");
  });

  test("accepts bundle and writes AOI + pins to storage", async () => {
    window.localStorage.clear();

    const bundle = await buildProofBundleV1({
      code: "AR-ACM0003",
      version: "v02-0",
      source: "Article6 Methodologies",
      provenance: {},
      rules: [{ id: "R-1", title: "Rule", snippet: "Snippet" }],
      sections: [{ id: "S-1", title: "Section", textSnippet: "Text" }],
      aoi: {
        id: "aoi-1",
        name: "AOI",
        geojson: {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [[[0, 0],[0, 1],[1, 1],[1, 0],[0, 0]]] },
          properties: {},
        },
        bbox: [0, 0, 1, 1],
        area_km2: 1,
        created_at: "2026-01-01T00:00:00Z",
      },
      evidence_pins: [
        { id: "pin-1", kind: "note", title: "Q", cited_ids: ["S-1"], created_at: "2026-01-01T00:00:00Z" },
      ],
    });

    const res = await importProofBundleText(JSON.stringify(bundle), { code: "AR-ACM0003", version: "v02-0" });
    expect(res.ok).toBe(true);

    expect(loadAoi("AR-ACM0003", "v02-0")?.id).toBe("aoi-1");
    expect(loadPins("AR-ACM0003", "v02-0")[0]?.id).toBe("pin-1");
    expect(loadEvidenceSnapshots("AR-ACM0003", "v02-0")[0]?.id).toBe("S-1");
  });

  test("mismatch method/version triggers switch required state", async () => {
    const bundle = await buildProofBundleV1({
      code: "AR-ACM0003",
      version: "v02-0",
      source: "Article6 Methodologies",
      provenance: {},
      rules: [],
      sections: [],
      evidence_pins: [],
    });

    const res = await importProofBundleText(JSON.stringify(bundle), { code: "AR-AM0014", version: "v03-0" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("SWITCH_REQUIRED");
    expect(res.target).toEqual({ code: "AR-ACM0003", version: "v02-0" });
  });
});

