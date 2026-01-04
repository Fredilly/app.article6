import { describe, expect, test } from "@jest/globals";
import type { VerificationRun } from "@/lib/proofMap/types";
import selectRunsForAoi from "@/lib/export/selectRunsForAoi";

describe("selectRunsForAoi", () => {
  test("prefers aoi_fingerprint match", () => {
    const runs: VerificationRun[] = [
      {
        id: "run-old",
        method: { code: "M", version: "1" },
        aoi_id: "aoi-old",
        aoi_fingerprint: "fp-old",
        input_fingerprint: "x",
        cited_ids: [],
        cited_ids_count: 0,
        attachment_sha256: [],
        attachment_count: 0,
        provider: "geovista",
        status: "ok",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "run-fp",
        method: { code: "M", version: "1" },
        aoi_id: "aoi-new",
        aoi_fingerprint: "fp-current",
        input_fingerprint: "y",
        cited_ids: [],
        cited_ids_count: 0,
        attachment_sha256: [],
        attachment_count: 0,
        provider: "stac",
        status: "ok",
        created_at: "2026-01-01T00:00:01Z",
      },
    ];

    const selected = selectRunsForAoi({ runs, aoiFingerprint: "fp-current", aoiId: "aoi-old" });
    expect(selected.map((r) => r.id)).toEqual(["run-fp"]);
  });

  test("falls back to aoi_id match when fingerprint missing", () => {
    const runs: VerificationRun[] = [
      {
        id: "run-1",
        method: { code: "M", version: "1" },
        aoi_id: "aoi-1",
        aoi_fingerprint: "fp-1",
        input_fingerprint: "x",
        cited_ids: [],
        cited_ids_count: 0,
        attachment_sha256: [],
        attachment_count: 0,
        provider: "geovista",
        status: "ok",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const selected = selectRunsForAoi({ runs, aoiFingerprint: null, aoiId: "aoi-1" });
    expect(selected.map((r) => r.id)).toEqual(["run-1"]);
  });
});

