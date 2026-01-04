import { describe, expect, test } from "@jest/globals";
import type { VerificationRun } from "@/lib/proofMap/types";
import selectLatestOkStacRunForActiveAoi from "@/lib/runs/selectLatestOkStacRunForActiveAoi";

describe("selectLatestOkStacRunForActiveAoi", () => {
  test("picks newest ok stac run for matching AOI fingerprint", () => {
    const runs: VerificationRun[] = [
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

    const selected = selectLatestOkStacRunForActiveAoi({ runs, activeAoiFingerprint: "aoi-1" });
    expect(selected?.id).toBe("stac-new");
  });
});

