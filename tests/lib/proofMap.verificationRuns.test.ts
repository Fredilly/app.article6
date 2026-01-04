import { describe, expect, test } from "@jest/globals";
import type { VerificationRun } from "@/lib/proofMap/types";
import { aoiFingerprint, mapGeoVistaVerificationToRunStatus, runInputFingerprint, splitRunsByAoiFingerprint } from "@/lib/proofMap/verificationRuns";

describe("verification runs", () => {
  test("mock response maps to status=ok", () => {
    const status = mapGeoVistaVerificationToRunStatus({
      ok: true,
      mode: "mock",
      status: "not_run",
      severity: "ok",
      summary: "Mock",
      artifacts: [],
      generated_at: "2026-01-01T00:00:00Z",
    });
    expect(status).toBe("ok");
  });

  test("runInputFingerprint changes when AOI changes", async () => {
    const geojson1 = {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [[[0, 0],[0, 1],[1, 1],[1, 0],[0, 0]]] },
      properties: {},
    } as const;
    const geojson2 = {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [[[0, 0],[0, 2],[2, 2],[2, 0],[0, 0]]] },
      properties: {},
    } as const;

    const [aoiFp1, aoiFp2] = await Promise.all([aoiFingerprint(geojson1 as any), aoiFingerprint(geojson2 as any)]);
    const fp1 = await runInputFingerprint({ aoi_fp: aoiFp1, cited_ids: ["S-1"], attachment_sha256: ["x"] });
    const fp2 = await runInputFingerprint({ aoi_fp: aoiFp2, cited_ids: ["S-1"], attachment_sha256: ["x"] });
    expect(fp1).not.toBe(fp2);
  });

  test("runs split into current AOI vs stale", () => {
    const currentFp = "aoi-current";
    const runs: VerificationRun[] = [
      {
        id: "run-current",
        method: { code: "AR-ACM0003", version: "v02-0" },
        aoi_id: "aoi-1",
        aoi_fingerprint: currentFp,
        input_fingerprint: "input-1",
        cited_ids: ["S-1"],
        cited_ids_count: 1,
        attachment_sha256: [],
        attachment_count: 0,
        provider: "geovista",
        status: "ok",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "run-stale",
        method: { code: "AR-ACM0003", version: "v02-0" },
        aoi_id: "aoi-2",
        aoi_fingerprint: "aoi-old",
        input_fingerprint: "input-2",
        cited_ids: ["S-2"],
        cited_ids_count: 1,
        attachment_sha256: [],
        attachment_count: 0,
        provider: "geovista",
        status: "warn",
        created_at: "2026-01-01T00:00:01Z",
      },
    ];

    const split = splitRunsByAoiFingerprint({ runs, currentAoiFingerprint: currentFp });
    expect(split.current.map((r) => r.id)).toEqual(["run-current"]);
    expect(split.stale.map((r) => r.id)).toEqual(["run-stale"]);
  });
});
