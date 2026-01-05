import { EvidenceSnapshotSchema, buildEvidenceSnapshot } from "@/lib/proofMap/evidenceSnapshot";

describe("buildEvidenceSnapshot", () => {
  test("returns deterministic ordering for ids + hash inputs", async () => {
    const generated_at = "2026-01-01T00:00:00Z";

    const a = await buildEvidenceSnapshot({
      method: { code: "m", version: "v1" },
      evidence_source: {
        type: "upload",
        ref: "local_pins",
        hash_inputs: ["att:b", "att:a", "cited:z", "cited:a", "att:a"],
      },
      selected: { ids: ["z", "a", "z", "b"] },
      generated_at,
      app: { commit: "deadbeef" },
    });

    const b = await buildEvidenceSnapshot({
      method: { code: "m", version: "v1" },
      evidence_source: {
        type: "upload",
        ref: "local_pins",
        hash_inputs: ["cited:a", "att:a", "att:b", "cited:z"],
      },
      selected: { ids: ["b", "z", "a"] },
      generated_at,
      app: { commit: "deadbeef" },
    });

    expect(a.selected?.ids).toEqual(["a", "b", "z"]);
    expect(b.selected?.ids).toEqual(["a", "b", "z"]);
    expect(a.evidence_source.hash).toBeTruthy();
    expect(a.evidence_source.hash).toEqual(b.evidence_source.hash);
  });

  test("schema validates snapshot payload", async () => {
    const snap = await buildEvidenceSnapshot({
      method: { code: "method", version: "1.0.0" },
      evidence_source: { type: "unknown", ref: "unknown" },
      generated_at: "2026-01-01T00:00:00Z",
    });

    expect(EvidenceSnapshotSchema.safeParse(snap).success).toBe(true);
  });
});

