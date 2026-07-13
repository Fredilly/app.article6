import type { Vm0007EvidenceMapDraftPackage } from "./vm0007EvidenceMapDraft";
import type { ReviewedEvidenceMapSnapshot } from "./reviewedEvidenceMapTypes";

export type ReviewedEvidenceMapRegistryEntry = Readonly<{
  canonicalAuditId: string;
  stableProjectId: string;
  sourcePdfSha256: string;
}>;

export type ReviewedEvidenceMapIdentity = Readonly<{
  auditId?: string | null;
  sourcePdfSha256?: string | null;
  sourceDocumentId?: string | null;
  stableProjectId?: string | null;
}>;

export function matchesReviewedEvidenceMapIdentity(
  identity: ReviewedEvidenceMapIdentity,
  snapshot: ReviewedEvidenceMapSnapshot,
): boolean {
  const sourceHash = identity.sourcePdfSha256?.trim();
  const sourceDocumentId = identity.sourceDocumentId?.trim();
  const stableProjectId = identity.stableProjectId?.trim();
  return (
    Boolean(sourceHash) &&
    sourceHash === snapshot.sourceDocument.contentSha256 &&
    (!sourceDocumentId ||
      sourceDocumentId === snapshot.sourceDocument.documentId) &&
    (!stableProjectId || stableProjectId === snapshot.stableProjectId)
  );
}

export function matchesReviewedEvidenceMapCase(
  pkg: Vm0007EvidenceMapDraftPackage,
  snapshot: ReviewedEvidenceMapSnapshot,
): boolean {
  return matchesReviewedEvidenceMapIdentity(
    {
      auditId: pkg.auditId,
      sourcePdfSha256: pkg.sourceDocument.contentSha256,
      sourceDocumentId: pkg.sourceDocument.documentId,
    },
    snapshot,
  );
}

export function findReviewedEvidenceMapEntry(
  entries: readonly ReviewedEvidenceMapRegistryEntry[],
  identity: ReviewedEvidenceMapIdentity,
): ReviewedEvidenceMapRegistryEntry | null {
  return (
    entries.find(
      (entry) =>
        Boolean(identity.sourcePdfSha256) &&
        entry.sourcePdfSha256 === identity.sourcePdfSha256 &&
        (!identity.stableProjectId ||
          entry.stableProjectId === identity.stableProjectId),
    ) ?? null
  );
}
