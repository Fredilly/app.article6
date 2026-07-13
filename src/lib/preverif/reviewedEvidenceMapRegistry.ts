import type { Vm0007EvidenceMapDraftPackage } from "./vm0007EvidenceMapDraft";
import type { ReviewedEvidenceMapSnapshot } from "./reviewedEvidenceMapTypes";

export type ReviewedEvidenceMapRegistryEntry = Readonly<{
  canonicalAuditId: string;
  stableProjectId: string;
  sourcePdfSha256: string;
}>;

export function matchesReviewedEvidenceMapCase(
  pkg: Vm0007EvidenceMapDraftPackage,
  snapshot: ReviewedEvidenceMapSnapshot,
): boolean {
  return (
    pkg.auditId === snapshot.canonicalAuditId &&
    pkg.sourceDocument.contentSha256 ===
      snapshot.sourceDocument.contentSha256 &&
    pkg.sourceDocument.documentId === snapshot.sourceDocument.documentId
  );
}

export function findReviewedEvidenceMapEntry(
  entries: readonly ReviewedEvidenceMapRegistryEntry[],
  identity: { auditId: string; sourcePdfSha256: string | null },
): ReviewedEvidenceMapRegistryEntry | null {
  return (
    entries.find(
      (entry) =>
        entry.canonicalAuditId === identity.auditId &&
        entry.sourcePdfSha256 === identity.sourcePdfSha256,
    ) ?? null
  );
}
