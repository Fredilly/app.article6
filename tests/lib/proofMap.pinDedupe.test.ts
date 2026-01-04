import { describe, expect, test } from "@jest/globals";
import type { EvidencePin } from "@/lib/proofMap/types";
import { isDuplicateEvidencePin } from "@/lib/proofMap/pins";

describe("evidence pin dedupe", () => {
  test("same pin_fingerprint does not create a duplicate pin", async () => {
    const existing: EvidencePin[] = [
      {
        id: "pin-1",
        kind: "note",
        title: "Assistant evidence",
        cited_ids: ["S-1", "R-1"],
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const duplicate = await isDuplicateEvidencePin(existing, { title: "Assistant evidence", cited_ids: ["R-1", "S-1"] });
    expect(duplicate).toBe(true);
  });
});

