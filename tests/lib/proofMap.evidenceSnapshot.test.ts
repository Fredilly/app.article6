import { describe, expect, test } from "@jest/globals";
import { buildEvidenceSnapshot } from "@/lib/proofMap/evidenceSnapshot";

describe("evidence snapshot exporter", () => {
  test("includes linked_rules per evidence item", async () => {
    const snapshot = await buildEvidenceSnapshot({
      method: { code: "AR-ACM0003", version: "v02-0" },
      evidence_source: { type: "unknown", ref: "unknown" },
      items: [
        { id: "item-b", linked_rules: ["R-2", "R-1", "R-1"] },
        { id: "item-a", linked_rules: [] },
      ],
    });

    expect(snapshot.items).toEqual([
      { id: "item-a", linked_rules: [] },
      { id: "item-b", linked_rules: ["R-1", "R-2"] },
    ]);
  });
});
