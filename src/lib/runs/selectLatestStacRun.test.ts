import { describe, expect, test } from "@jest/globals";
import type { VerificationRun } from "@/lib/proofMap/types";
import selectLatestStacRun from "@/lib/runs/selectLatestStacRun";

describe("selectLatestStacRun", () => {
  test("picks newest ok stac run for matching AOI", () => {
    const runs: VerificationRun[] = [
      {
        id: "stac-error-old",
        method: { code: "M", version: "1" },
        aoi_fingerprint: "aoi-1",
        input_fingerprint: "x",
        cited_ids: [],
        cited_ids_count: 0,
        attachment_sha256: [],
        attachment_count: 0,
        provider: "stac",
        status: "error",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "stac-old",
        method: { code: "M", version: "1" },
        aoi_fingerprint: "aoi-1",
        input_fingerprint: "y",
        cited_ids: [],
        cited_ids_count: 0,
        attachment_sha256: [],
        attachment_count: 0,
        provider: "stac",
        status: "ok",
        created_at: "2026-01-01T00:00:00Z",
        ended_at: "2026-01-01T00:00:01Z",
      },
      {
        id: "stac-new",
        method: { code: "M", version: "1" },
        aoi_fingerprint: "aoi-1",
        input_fingerprint: "z",
        cited_ids: [],
        cited_ids_count: 0,
        attachment_sha256: [],
        attachment_count: 0,
        provider: "stac",
        status: "ok",
        created_at: "2026-01-01T00:00:02Z",
      },
    ];

    const selected = selectLatestStacRun({ runs, aoiFingerprint: "aoi-1" });
    expect(selected?.id).toBe("stac-new");
  });

  test("ignores wrong provider / non-ok / different AOI", () => {
    const runs: VerificationRun[] = [
      {
        id: "stac-warn",
        method: { code: "M", version: "1" },
        aoi_fingerprint: "aoi-1",
        input_fingerprint: "x",
        cited_ids: [],
        cited_ids_count: 0,
        attachment_sha256: [],
        attachment_count: 0,
        provider: "stac",
        status: "warn",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "stac-other-aoi",
        method: { code: "M", version: "1" },
        aoi_fingerprint: "aoi-2",
        input_fingerprint: "x",
        cited_ids: [],
        cited_ids_count: 0,
        attachment_sha256: [],
        attachment_count: 0,
        provider: "stac",
        status: "ok",
        created_at: "2026-01-01T00:00:01Z",
      },
    ];

    const selected = selectLatestStacRun({ runs, aoiFingerprint: "aoi-1" });
    expect(selected).toBeNull();
  });
});
