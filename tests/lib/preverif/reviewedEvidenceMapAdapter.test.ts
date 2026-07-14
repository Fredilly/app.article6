import { adaptReviewedEvidenceMap } from "@/lib/preverif/reviewedEvidenceMapAdapter";
import { summarizeEvidenceMapPresentation, buildReviewedEvidenceMapPresentation } from "@/components/preverif/evidence-map/evidenceMapPresentationModel";
import reviewed from "../../fixtures/preverif/marcondes-vm0007-v18-evidence-map/gold.json";
import draft from "../../fixtures/preverif/marcondes-vm0007-v18-evidence-map/gold.draft.json";
import metadata from "../../fixtures/preverif/marcondes-vm0007-v18-evidence-map/metadata.json";

describe("reviewed Evidence Map adapter", () => {
  test("adapts every completed canonical row and derives reviewed counts", () => {
    const snapshot = adaptReviewedEvidenceMap({ reviewed, draft, metadata });
    expect(snapshot).not.toBeNull();
    expect(snapshot?.rows).toHaveLength(58);
    expect(summarizeEvidenceMapPresentation(buildReviewedEvidenceMapPresentation(snapshot!).rows)).toEqual({
      total: 58,
      found: 6,
      unclear: 20,
      missing: 10,
      notApplicable: 22,
      actionRequired: 30,
    });
  });

  test("drift-checks canonical rows against metadata counts and preserves evidence provenance", () => {
    const snapshot = adaptReviewedEvidenceMap({ reviewed, draft, metadata })!;
    const summary = summarizeEvidenceMapPresentation(buildReviewedEvidenceMapPresentation(snapshot).rows);
    expect({ FOUND: summary.found, UNCLEAR: summary.unclear, MISSING: summary.missing, "N/A": summary.notApplicable }).toEqual(metadata.review.evidenceStateCounts);
    expect(summary.actionRequired).toBe(metadata.review.reviewerOutcomes.ACTION_REQUIRED);
    const evidence = snapshot.rows.flatMap((row) => row.reviewerEvidence);
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.every((item) => item.quote && item.spanId && item.provenance.docId && item.provenance.spanId)).toBe(true);
    expect(snapshot.rows.flatMap((row) => row.rejectedEvidence).every((item) => item.rejectionReason)).toBe(true);
  });

  test("does not present partial draft rows as reviewed truth", () => {
    expect(adaptReviewedEvidenceMap({ reviewed: draft, draft, metadata })).toBeNull();
  });
});
