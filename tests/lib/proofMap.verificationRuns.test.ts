import { describe, expect, test } from "@jest/globals";
import type { VerificationRun } from "@/lib/proofMap/types";
import { isDuplicateRunAttempt, mapGeoVistaVerificationToRunStatus } from "@/lib/proofMap/verificationRuns";

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

  test("same run_fingerprint within window does not enqueue again", async () => {
    const nowMs = Date.now();
    const latest: VerificationRun = {
      id: "run-1",
      method: { code: "AR-ACM0003", version: "v02-0" },
      aoi_id: "aoi-1",
      cited_ids: ["S-1", "R-1"],
      attachment_sha256: ["b", "a"],
      provider: "geovista",
      status: "ok",
      created_at: new Date(nowMs - 10_000).toISOString(),
    };

    const duplicate = await isDuplicateRunAttempt({
      latest,
      next: { aoi_id: "aoi-1", cited_ids: ["R-1", "S-1"], attachment_sha256: ["a", "b"] },
      nowMs,
      windowMs: 60_000,
    });
    expect(duplicate).toBe(true);
  });
});

