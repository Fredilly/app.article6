import {
  findReviewedEvidenceMapEntry,
  matchesReviewedEvidenceMapCase,
  matchesReviewedEvidenceMapIdentity,
} from "@/lib/preverif/reviewedEvidenceMapRegistry";
import type { Vm0007EvidenceMapDraftPackage } from "@/lib/preverif/vm0007EvidenceMapDraft";
import type { ReviewedEvidenceMapSnapshot } from "@/lib/preverif/reviewedEvidenceMapTypes";

const entry = {
  canonicalAuditId: "audit-1",
  stableProjectId: "project-1",
  sourcePdfSha256: "hash-1",
};

test("registry matches reviewed cases by stable audit and source identity", () => {
  expect(
    findReviewedEvidenceMapEntry([entry], {
      auditId: "generated-live-audit",
      sourcePdfSha256: "hash-1",
    }),
  ).toEqual(entry);
  expect(
    findReviewedEvidenceMapEntry([entry], { sourcePdfSha256: "different" }),
  ).toBeNull();
  const pkg = {
    auditId: "generated-live-audit",
    sourceDocument: { documentId: "doc-1", contentSha256: "hash-1" },
  } as Vm0007EvidenceMapDraftPackage;
  const snapshot = {
    canonicalAuditId: "historical-audit",
    stableProjectId: "project-1",
    sourceDocument: { documentId: "doc-1", contentSha256: "hash-1" },
  } as ReviewedEvidenceMapSnapshot;
  expect(matchesReviewedEvidenceMapCase(pkg, snapshot)).toBe(true);
  expect(
    matchesReviewedEvidenceMapCase({ ...pkg, auditId: "other" }, snapshot),
  ).toBe(true);
  expect(
    matchesReviewedEvidenceMapCase(
      {
        ...pkg,
        sourceDocument: { ...pkg.sourceDocument, contentSha256: "other" },
      },
      snapshot,
    ),
  ).toBe(false);
  expect(
    matchesReviewedEvidenceMapIdentity(
      {
        sourcePdfSha256: "hash-1",
        sourceDocumentId: "doc-1",
        stableProjectId: "project-1",
      },
      snapshot,
    ),
  ).toBe(true);
  expect(
    matchesReviewedEvidenceMapIdentity(
      { sourcePdfSha256: "hash-1", sourceDocumentId: "different" },
      snapshot,
    ),
  ).toBe(false);
});
